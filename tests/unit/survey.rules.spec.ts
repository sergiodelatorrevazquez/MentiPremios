import { describe, expect, it } from 'vitest';
import { preguntas } from '../../src/features/survey/domain/questions';
import { validateSurveyAnswers } from '../../src/features/survey/domain/survey.rules';

describe('validateSurveyAnswers', () => {
  it('acepta una respuesta valida para cada pregunta', () => {
    const respuestas: Record<string, string> = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );

    expect(validateSurveyAnswers(preguntas, respuestas)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('detecta preguntas sin respuesta', () => {
    const respuestas: Record<string, string> = Object.fromEntries(
      preguntas
        .slice(1)
        .map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );

    const result = validateSurveyAnswers(preguntas, respuestas);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ code: 'missing-answer', questionId: 'tonto' });
    expect(result.errors).toContainEqual({ code: 'unexpected-answer-count' });
  });

  it('detecta una opcion que no pertenece a la pregunta', () => {
    const respuestas: Record<string, string> = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );
    respuestas.tonto = 'casper-1';

    const result = validateSurveyAnswers(preguntas, respuestas);

    expect(result.errors).toContainEqual({
      code: 'invalid-option',
      questionId: 'tonto',
      optionId: 'casper-1',
    });
  });

  it('detecta preguntas desconocidas', () => {
    const respuestas: Record<string, string> = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );
    respuestas.otra = 'otra-1';

    const result = validateSurveyAnswers(preguntas, respuestas);

    expect(result.errors).toContainEqual({
      code: 'unknown-question',
      questionId: 'otra',
      optionId: 'otra-1',
    });
    expect(result.errors).toContainEqual({ code: 'unexpected-answer-count' });
  });
});