import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTION_IDS } from '../../../src/features/survey/domain/survey.types';

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

describe('red de seguridad', () => {
  it('todo lo no declarado queda denegado', () => {
    const wildcard = block('{document=**}');

    expect(wildcard).toMatch(/allow read, write:\s*if false/);
  });
});