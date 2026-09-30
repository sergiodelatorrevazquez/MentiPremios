import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_IDS } from '../../../src/features/survey/domain/survey.types';
import { preguntas } from '../../../src/features/survey/domain/questions';

/*
 * Estas reglas son la única barrera que queda entre las palabras secretas y
 * cualquier persona con un navegador. El test las fija por texto para que una
 * edición accidental no vuelva a abrir la colección entera.
 */

const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');

/**
 * Devuelve el texto de un bloque `match`. No basta con buscar el primer `}`:
 * la propia ruta lleva llaves (`codes/{invitationId}`), así que hay que
 * emparejar la llave que abre el bloque con su cierre.
 */
function block(path: string): string {
  const start = rules.indexOf(`match /${path}`);
  expect(start, `no encuentro el bloque de ${path}`).toBeGreaterThan(-1);

  const pathEnd = rules.indexOf('}', start);
  const open = rules.indexOf('{', pathEnd);

  let depth = 0;
  for (let i = open; i < rules.length; i += 1) {
    if (rules[i] === '{') depth += 1;
    if (rules[i] === '}') {
      depth -= 1;
      if (depth === 0) return rules.slice(start, i + 1);
    }
  }

  throw new Error(`bloque sin cerrar: ${path}`);
}

describe('reglas que protegen las palabras secretas', () => {
  it('permite leer una invitación concreta, que es lo que hace el login', () => {
    expect(block('codes/{invitationId}')).toMatch(/allow get:\s*if true/);
  });

  it('prohíbe enumerar las invitaciones: sin list no se descubren las palabras', () => {
    expect(block('codes/{invitationId}')).toMatch(/allow list:\s*if false/);
  });

  it('no deja crear ni borrar invitaciones desde el cliente', () => {
    expect(block('codes/{invitationId}')).toMatch(/allow create, delete:\s*if false/);
  });

  it('solo admite pasar la invitación de sin votar a votada', () => {
    const codes = block('codes/{invitationId}');

    expect(codes).toMatch(/resource\.data\.voted == false/);
    expect(codes).toMatch(/request\.resource\.data\.voted == true/);
  });

  it('acota el cambio a `voted` y a los campos de las preguntas', () => {
    // `diff` acota el cambio a esa lista, así que no se pueden escribir campos
    // inventados ni devolver una invitación a sin votar.
    expect(block('codes/{invitationId}')).toMatch(/affectedKeys\(\)\.hasOnly\(\[/);
  });

  it('la lista de campos que puede escribir coincide con las preguntas reales', () => {
    // Si se añade una pregunta al catálogo y no se añade a las reglas, el voto
    // se guardaría y las reglas lo rechazarían. Este test es el que avisa.
    const [, lista] = block('codes/{invitationId}')
      .match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/) ?? [];

    const permitidos = (lista ?? '').match(/'([^']+)'/g)?.map((c) => c.slice(1, -1)) ?? [];

    expect(permitidos).toEqual(['voted', ...Object.values(QUESTION_IDS)]);
  });
});

describe('una sola colección', () => {
  it('ya no existe la colección de respuestas', () => {
    // Los votes se guardan en el propio documento de la persona, así que no
    // debe quedar ni el bloque de reglas ni el nombre en el repositorio.
    expect(rules).not.toContain('/respuestas/');
    expect(rules).not.toContain('match /respuestas');
  });
});

describe('los totales de la gala', () => {
  /** Todos los identificadores de opción del catálogo, en orden. */
  const opciones = preguntas.flatMap((pregunta) => pregunta.opciones.map((opcion) => opcion.id));

  it('declara `changed` al nivel del servicio, no dentro de un `match`', () => {
    // Las reglas no se pueden compilar en este entorno, así que el sitio donde
    // se declara la función no se puede comprobar con el emulador. Se usa el
    // que el lenguaje documenta: junto a los `match`, dentro de
    // `/databases/{database}/documents`. Si alguien la deja anidada en un bloque,
    // el despliegue entero puede dejar de aceptarse y no hay ningún otro test
    // que se entere.
    const antesDelPrimerMatch = rules.slice(0, rules.indexOf('match /codes/'));

    expect(antesDelPrimerMatch).toMatch(/function changed\(\)/);
    expect(antesDelPrimerMatch).toMatch(/return request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)/);

    const resumen = block('resumen/{resumenId}');
    expect(resumen).not.toMatch(/function changed\(\)/);
  });

  it('deja leer el documento de totales y no enumerar la colección', () => {
    const resumen = block('resumen/{resumenId}');

    expect(resumen).toMatch(/allow get:\s*if resumenId == 'actual'/);
    expect(resumen).toMatch(/allow list:\s*if false/);
  });

  it('no deja crearlo ni borrarlo desde el cliente', () => {
    // Crear el documento con contadores inventados amañaría la gala de salida,
    // así que solo el organizador, desde la consola, puede crearlo.
    expect(block('resumen/{resumenId}')).toMatch(/allow create, delete:\s*if false/);
  });

  it('exige que cada voto toque una sola opción por pregunta', () => {
    // Diez contadores, uno por pregunta: es lo que produce una encuesta
    // validada. Sin esto, un cliente podría sumar su voto solo a las preguntas
    // que le convienen y dejar el resto sin contar.
    const resumen = block('resumen/{resumenId}');

    expect(resumen).toMatch(/changed\(\)\.size\(\) == \d+/);
    expect(Number(/changed\(\)\.size\(\) == (\d+)/.exec(resumen)?.[1])).toBe(preguntas.length);
  });

  it('la lista blanca de contadores coincide con las opciones del catálogo', () => {
    // Si se añade una opción y no se añade aquí, su voto se guardaría en el
    // cliente y lo rechazaría la regla. Este test es el que avisa.
    const [, lista] = block('resumen/{resumenId}')
      .match(/changed\(\)\.hasOnly\(\[([\s\S]*?)\]\)/) ?? [];

    const permitidos = (lista ?? '').match(/'([^']+)'/g)?.map((c) => c.slice(1, -1)) ?? [];

    expect(permitidos).toEqual(opciones);
  });

  it('cada pregunta tiene su propia lista, y son las opciones de esa pregunta', () => {
    // La lista por pregunta es lo que garantiza que un voto no se concentre en
    // dos opciones del mismo premio.
    const resumen = block('resumen/{resumenId}');
    const encontradas = [...resumen.matchAll(/changed\.hasAny\(\[([^\]]*)\]\)/g)]
      .map(([, lista]) => (lista.match(/'([^']+)'/g) ?? []).map((c) => c.slice(1, -1)));

    expect(encontradas).toEqual(preguntas.map((pregunta) => pregunta.opciones.map((opcion) => opcion.id)));
  });

  it('comprueba que cada contador que toca el voto valga su valor anterior más uno', () => {
    const resumen = block('resumen/{resumenId}');

    for (const opcionId of opciones) {
      const comprobacion = new RegExp(
        `!changed\\.has\\('${opcionId}'\\)\\s*\\n?\\s*\\|\\| request\\.resource\\.data\\.get\\('${opcionId}', 0\\) == resource\\.data\\.get\\('${opcionId}', 0\\) \\+ 1`,
      );

      expect(resumen, `falta la comprobación de ${opcionId}`).toMatch(comprobacion);
    }
  });

  it('agrupa las comprobaciones en paréntesis', () => {
    // Sin el paréntesis, `a && b || c || d` se lee como `((a && b) || c) || d`:
    // como casi todas las comprobaciones son ciertas, el `||` final dejaría
    // pasar la escritura entera y la regla no comprobaría nada. Este test
    // existe porque esa regla ya falló una vez al escribirse.
    const resumen = block('resumen/{resumenId}');

    expect(resumen).toMatch(/&&\s*\(\(!changed\.has\(/);
    expect(resumen).toMatch(/\+ 1\)\n\s*\);/);
  });

  it('no toca nada fuera del documento que escribe el voto', () => {
    // La condición entera tiene que cerrar el `allow`, sin comas sueltas ni
    // condiciones que se escapen al bloque de reglas siguiente.
    const resumen = block('resumen/{resumenId}');
    const abre = (resumen.match(/\(/g) ?? []).length;
    const cierra = (resumen.match(/\)/g) ?? []).length;

    expect(abre).toBe(cierra);
  });
});

describe('la marca del organizador', () => {
  it('no se puede escribir con un voto normal', () => {
    // `admin` decide si una palabra abre la gala. Si se pudiera tocar con la
    // escritura del voto, cualquiera se nominaría organizador con su propia
    // invitación.
    const [, lista] = block('codes/{invitationId}')
      .match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/) ?? [];

    const permitidos = (lista ?? '').match(/'([^']+)'/g)?.map((c) => c.slice(1, -1)) ?? [];

    expect(permitidos).not.toContain('admin');
  });
});

describe('red de seguridad', () => {
  it('todo lo no declarado queda denegado', () => {
    const wildcard = block('{document=**}');

    expect(wildcard).toMatch(/allow read, write:\s*if false/);
  });
});