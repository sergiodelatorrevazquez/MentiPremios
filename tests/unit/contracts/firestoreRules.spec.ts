import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Estas reglas son la única barrera que queda entre las palabras secretas y
 * cualquier persona con un navegador. El test las fija por texto para que una
 * edición accidental no vuelva a abrir la colección entera.
 */

const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');

/**
 * Devuelve el texto de un bloque `match`. No basta con buscar el primer `}`:
 * la propia ruta lleva llaves (`codigos/{invitationId}`), así que hay que
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
    expect(block('codigos/{invitationId}')).toMatch(/allow get:\s*if true/);
  });

  it('prohíbe enumerar las invitaciones: sin list no se descubren las palabras', () => {
    expect(block('codigos/{invitationId}')).toMatch(/allow list:\s*if false/);
  });

  it('no deja crear ni borrar invitaciones desde el cliente', () => {
    expect(block('codigos/{invitationId}')).toMatch(/allow create, delete:\s*if false/);
  });

  it('solo admite pasar la invitación de sin usar a usada', () => {
    const codigos = block('codigos/{invitationId}');

    expect(codigos).toMatch(/resource\.data\.usado == false/);
    expect(codigos).toMatch(/request\.resource\.data\.usado == true/);
    // `diff` acota el cambio al campo `usado`, así que no se puede tocar el
    // nombre ni devolver una invitación usada a sin usar.
    expect(codigos).toMatch(/affectedKeys\(\)\.hasOnly\(\['usado'\]\)/);
  });
});

describe('reglas que protegen los votos', () => {
  it('permite guardar una respuesta nueva', () => {
    expect(block('respuestas/{responseId}')).toMatch(/allow create:/);
  });

  it('no deja leer, modificar ni borrar respuestas ya guardadas', () => {
    const respuestas = block('respuestas/{responseId}');

    expect(respuestas).toMatch(/allow read, update, delete:\s*if false/);
  });

  it('exige la forma exacta del documento para poder crearlo', () => {
    const respuestas = block('respuestas/{responseId}');

    expect(respuestas).toMatch(/hasOnly\(\[\s*'schemaVersion'/);
    for (const campo of ['participantName', 'answers', 'createdAt', 'submittedAt']) {
      expect(respuestas).toContain(`'${campo}'`);
    }
  });
});

describe('red de seguridad', () => {
  it('todo lo no declarado queda denegado', () => {
    const wildcard = block('{document=**}');

    expect(wildcard).toMatch(/allow read, write:\s*if false/);
  });
});