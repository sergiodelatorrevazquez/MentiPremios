import type { Pregunta } from './survey.types';

export type SurveyValidationErrorCode =
  | 'missing-answer'
  | 'unknown-question'
  | 'invalid-option'
  | 'unexpected-answer-count';

export interface SurveyValidationError {
  code: SurveyValidationErrorCode;
  questionId?: string;
  optionId?: string;
}

export interface SurveyValidationResult {
  valid: boolean;
  errors: SurveyValidationError[];
}

export function validateSurveyAnswers(
  preguntas: readonly Pregunta[],
  respuestas: Readonly<Record<string, string | undefined>>,
): SurveyValidationResult {
  const errors: SurveyValidationError[] = [];
  const questionById = new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));
  const questionIds = new Set<string>(questionById.keys());

  for (const pregunta of preguntas) {
    const respuesta = respuestas[pregunta.id];

    if (!respuesta) {
      errors.push({ code: 'missing-answer', questionId: pregunta.id });
      continue;
    }

    const optionExists = pregunta.opciones.some((opcion) => opcion.id === respuesta);
    if (!optionExists) {
      errors.push({
        code: 'invalid-option',
        questionId: pregunta.id,
        optionId: respuesta,
      });
    }
  }

  for (const [questionId, optionId] of Object.entries(respuestas)) {
    if (!questionIds.has(questionId)) {
      errors.push({ code: 'unknown-question', questionId, optionId });
    }
  }

  if (Object.keys(respuestas).length !== preguntas.length) {
    errors.push({ code: 'unexpected-answer-count' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}