import { describe, expect, it } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { QUESTION_IDS, type Pregunta } from '../../../src/features/survey/domain/survey.types';

/** Grid sizes the presentation layer knows how to lay out. */
const SUPPORTED_OPTION_COUNTS = [4, 6, 8];

const MULTIMEDIA_QUESTION_IDS = [QUESTION_IDS.mensaje, QUESTION_IDS.foto, QUESTION_IDS.video];

const optionIdsOf = (pregunta: Pregunta) => pregunta.opciones.map((opcion) => opcion.id);

describe('catálogo de preguntas', () => {
  it('cubre exactamente los identificadores declarados en el dominio', () => {
    expect(preguntas.map((pregunta) => pregunta.id).sort()).toEqual(
      Object.values(QUESTION_IDS).sort(),
    );
  });

  it('no repite identificadores de pregunta', () => {
    const ids = preguntas.map((pregunta) => pregunta.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no repite identificadores de opcion dentro de una pregunta', () => {
    const offenders = preguntas
      .filter((pregunta) => new Set(optionIdsOf(pregunta)).size !== pregunta.opciones.length)
      .map((pregunta) => pregunta.id);

    expect(offenders).toEqual([]);
  });

  it('no repite identificadores de opcion entre preguntas distintas', () => {
    const ids = preguntas.flatMap(optionIdsOf);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deriva el identificador de opcion del identificador de su pregunta', () => {
    const offenders = preguntas.flatMap((pregunta) =>
      pregunta.opciones
        .filter((opcion) => !opcion.id.startsWith(`${pregunta.id}-`))
        .map((opcion) => opcion.id),
    );

    expect(offenders).toEqual([]);
  });

  it('ofrece un titulo y un texto visibles en cada pregunta y opcion', () => {
    const offenders = preguntas.flatMap((pregunta) => [
      ...(pregunta.titulo.trim().length > 0 ? [] : [`titulo:${pregunta.id}`]),
      ...pregunta.opciones
        .filter((opcion) => opcion.texto.trim().length === 0)
        .map((opcion) => `opcion:${opcion.id}`),
    ]);

    expect(offenders).toEqual([]);
  });

  it('mantiene el numero de opciones dentro de las retículas que la interfaz soporta', () => {
    const counts = preguntas.map((pregunta) => pregunta.opciones.length);

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(counts.every((count) => SUPPORTED_OPTION_COUNTS.includes(count))).toBe(true);
  });

  it('coloca el contenido multimedia solo en las preguntas previstas', () => {
    const conMultimedia = preguntas
      .filter((pregunta) => pregunta.opciones.some((opcion) => opcion.multimedia))
      .map((pregunta) => pregunta.id);

    expect(conMultimedia.sort()).toEqual([...MULTIMEDIA_QUESTION_IDS].sort());
  });

  it('describe el mismo tipo de medio en todas las opciones de su pregunta', () => {
    const offenders = preguntas
      .filter((pregunta) => new Set(
        pregunta.opciones.map((opcion) => opcion.multimedia?.tipo).filter(Boolean),
      ).size > 1)
      .map((pregunta) => pregunta.id);

    expect(offenders).toEqual([]);
  });

  it('no expone campos fuera de los declarados por el dominio', () => {
    const offenders = preguntas.flatMap((pregunta) => [
      ...Object.keys(pregunta)
        .filter((key) => !['id', 'opciones', 'titulo'].includes(key))
        .map((key) => `pregunta:${pregunta.id}.${key}`),
      ...pregunta.opciones.flatMap((opcion) => Object.keys(opcion)
        .filter((key) => !['id', 'texto', 'multimedia'].includes(key))
        .map((key) => `opcion:${opcion.id}.${key}`)),
    ]);

    expect(offenders).toEqual([]);
  });
});
