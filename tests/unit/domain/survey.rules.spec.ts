import { describe, expect, it } from 'vitest';
import type { Pregunta, RespuestasCompletas } from '../../../src/features/survey/domain/survey.types';
import { validateSurveyAnswers } from '../../../src/features/survey/domain/survey.rules';
import { preguntas } from '../../../src/features/survey/domain/questions';

const regla: Pregunta = {
  id: 'tonto',
  titulo: 'Tonto del Año',
  opciones: [
    { id: 'tonto-1', texto: 'Miguel' },
    { id: 'tonto-2', texto: 'Pablo' },
  ],
};
const otra: Pregunta = {
  id: 'casper',
  titulo: 'Casper del Año',
  opciones: [
    { id: 'casper-1', texto: 'Raúl' },
    { id: 'casper-2', texto: 'Jorge' },
  ],
};
const catalogo = [regla, otra];

const codes = (respuestas: Readonly<Record<string, string | undefined>>, preguntas = catalogo) =>
  validateSurveyAnswers(preguntas, respuestas).errors.map((error) => error.code);

describe('validateSurveyAnswers sobre el catálogo real', () => {
  const respondidas = (primerIndice = 0, ultimoIndice = preguntas.length - 1) =>
    Object.fromEntries(
      preguntas
        .slice(primerIndice, ultimoIndice + 1)
        .map((pregunta) => [pregunta.id, pregunta.opciones[primerIndice % pregunta.opciones.length].id]),
    ) as RespuestasCompletas;

  it('acepta las diez preguntas respondidas con la primera opción', () => {
    expect(validateSurveyAnswers(preguntas, respondidas())).toEqual({ valid: true, errors: [] });
  });

  it('acepta la última opción de cada pregunta', () => {
    const respuestas = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones.at(-1)!.id]),
    );

    expect(validateSurveyAnswers(preguntas, respuestas).valid).toBe(true);
  });

  it('no muta el catálogo ni las respuestas que recibe', () => {
    const respuestas = respondidas();
    const catalogoCopia = structuredClone(preguntas);
    const respuestasCopia = { ...respuestas };

    validateSurveyAnswers(preguntas, respuestas);

    expect(preguntas).toEqual(catalogoCopia);
    expect(respuestas).toEqual(respuestasCopia);
  });

  it('acumula un error por cada pregunta sin responder, sin detenerse en el primero', () => {
    const resultado = validateSurveyAnswers(preguntas, {});

    expect(resultado.valid).toBe(false);
    expect(resultado.errors.filter((error) => error.code === 'missing-answer')).toHaveLength(
      preguntas.length,
    );
  });

  it('no acepta una cadena vacía como respuesta', () => {
    const respuestas: Record<string, string> = respondidas();
    respuestas.tonto = '';

    expect(codes(respuestas, preguntas)).toContain('missing-answer');
  });

  it('señala la pregunta y la opción cuando el identificador no pertenece a ella', () => {
    const respuestas: Record<string, string> = respondidas();
    respuestas.casper = 'tonto-1';

    expect(validateSurveyAnswers(preguntas, respuestas).errors).toContainEqual({
      code: 'invalid-option',
      questionId: 'casper',
      optionId: 'tonto-1',
    });
  });

  it('separa los errores de varias preguntas en una sola pasada', () => {
    const respuestas: Record<string, string> = respondidas();
    delete respuestas.tonto;
    respuestas.meme = 'meme-99';
    respuestas.inventada = 'inventada-1';

    const resultado = validateSurveyAnswers(preguntas, respuestas);

    expect(resultado.valid).toBe(false);
    expect(resultado.errors).toEqual(expect.arrayContaining([
      { code: 'missing-answer', questionId: 'tonto' },
      { code: 'invalid-option', questionId: 'meme', optionId: 'meme-99' },
      { code: 'unknown-question', questionId: 'inventada', optionId: 'inventada-1' },
    ]));
  });

  it('exige exactamente una respuesta por pregunta del catálogo recibido', () => {
    const completas = respondidas();

    // Quitar una y añadir otra mantiene la cantidad, asi que no hay error de conteo.
    const sustitucion: Record<string, string> = { ...completas, inventada: 'inventada-1' };
    delete sustitucion.tonto;
    expect(codes(sustitucion, preguntas)).not.toContain('unexpected-answer-count');

    expect(codes({ ...completas, inventada: 'inventada-1' }, preguntas))
      .toContain('unexpected-answer-count');
    expect(codes({ ...completas, extra: 'extra-1' }, preguntas).filter((code) => (
      code === 'unexpected-answer-count'
    ))).toHaveLength(1);
  });

  it('rechaza un valor undefined explícito en una pregunta presente', () => {
    const respuestas: Record<string, string | undefined> = { ...respondidas(), tonto: undefined };

    expect(validateSurveyAnswers(preguntas, respuestas).errors).toContainEqual({
      code: 'missing-answer',
      questionId: 'tonto',
    });
  });
});

describe('validateSurveyAnswers sobre un catálogo arbitrario', () => {
  it('valida contra el catálogo recibido, no contra el catálogo global', () => {
    const respuestas: Record<string, string> = {
      tonto: 'tonto-1',
      casper: 'casper-1',
    };

    expect(validateSurveyAnswers(catalogo, respuestas).valid).toBe(true);
  });

  it('exige una respuesta por cada pregunta del subconjunto recibido', () => {
    expect(validateSurveyAnswers(catalogo, { tonto: 'tonto-2' }).errors).toEqual([
      { code: 'missing-answer', questionId: 'casper' },
      { code: 'unexpected-answer-count' },
    ]);
  });

  it('señala la cantidad incorrecta al responder de más', () => {
    const resultado = validateSurveyAnswers(catalogo, {
      tonto: 'tonto-1',
      casper: 'casper-1',
      otra: 'otra-1',
    });

    expect(resultado.errors).toEqual(expect.arrayContaining([
      { code: 'unknown-question', questionId: 'otra', optionId: 'otra-1' },
      { code: 'unexpected-answer-count' },
    ]));
  });

  it('acepta un catálogo vacío sin exigir respuestas', () => {
    expect(validateSurveyAnswers([], {})).toEqual({ valid: true, errors: [] });
  });

  it('rechaza responder a un catálogo vacío', () => {
    expect(validateSurveyAnswers([], { tonto: 'tonto-1' })).toEqual({
      valid: false,
      errors: [
        { code: 'unknown-question', questionId: 'tonto', optionId: 'tonto-1' },
        { code: 'unexpected-answer-count' },
      ],
    });
  });

  it('acepta el mismo juego de respuestas en catálogos de tamaño distinto', () => {
    const respuestas: Record<string, string> = { tonto: 'tonto-1', casper: 'casper-1' };

    expect(validateSurveyAnswers([regla], respuestas).valid).toBe(false);
    expect(validateSurveyAnswers([regla, otra], respuestas).valid).toBe(true);
  });
});
