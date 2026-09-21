import type {
  OptionId,
  Paso,
  Pregunta,
  RespuestasEncuesta,
} from '../domain/survey.types';

export interface SurveyWizardState {
  paso: Paso;
  indicePregunta: number;
  respuestas: RespuestasEncuesta;
  respuestaSeleccionada: OptionId | null;
}

export function createSurveyWizardState(): SurveyWizardState {
  return {
    paso: 'login',
    indicePregunta: 0,
    respuestas: {},
    respuestaSeleccionada: null,
  };
}

export function startSurvey(state: SurveyWizardState): SurveyWizardState {
  return {
    ...state,
    paso: 'questions',
    indicePregunta: 0,
    respuestaSeleccionada: state.respuestas.tonto ?? null,
  };
}

export function selectAnswer(
  state: SurveyWizardState,
  opcionId: OptionId,
): SurveyWizardState {
  return {
    ...state,
    respuestaSeleccionada: opcionId,
  };
}

export function goToNextQuestion(
  state: SurveyWizardState,
  preguntas: readonly Pregunta[],
): SurveyWizardState {
  const preguntaActual = preguntas[state.indicePregunta];
  if (!preguntaActual || !state.respuestaSeleccionada) return state;

  const respuestas = {
    ...state.respuestas,
    [preguntaActual.id]: state.respuestaSeleccionada,
  };

  if (state.indicePregunta >= preguntas.length - 1) {
    return { ...state, respuestas };
  }

  const siguienteIndice = state.indicePregunta + 1;
  const siguientePregunta = preguntas[siguienteIndice];

  return {
    ...state,
    indicePregunta: siguienteIndice,
    respuestas,
    respuestaSeleccionada: siguientePregunta
      ? respuestas[siguientePregunta.id] ?? null
      : null,
  };
}

export function goToPreviousQuestion(
  state: SurveyWizardState,
  preguntas: readonly Pregunta[],
): SurveyWizardState {
  if (state.indicePregunta <= 0) return state;

  const previousIndex = state.indicePregunta - 1;
  const preguntaAnterior = preguntas[previousIndex];

  return {
    ...state,
    indicePregunta: previousIndex,
    respuestaSeleccionada: preguntaAnterior
      ? state.respuestas[preguntaAnterior.id] ?? null
      : null,
  };
}

export function getCurrentQuestion(
  state: SurveyWizardState,
  preguntas: readonly Pregunta[],
): Pregunta | undefined {
  return preguntas[state.indicePregunta];
}

export function getProgress(
  state: SurveyWizardState,
  preguntas: readonly Pregunta[],
): number {
  if (preguntas.length === 0) return 0;
  return Math.round(((state.indicePregunta + 1) / preguntas.length) * 100);
}