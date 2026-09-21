import { computed, reactive, ref } from 'vue';
import {
  createSurveyWizardState,
  goToNextQuestion,
  goToPreviousQuestion,
  selectAnswer,
  startSurvey,
} from './surveyWizard';
import type {
  OptionId,
  Paso,
  Pregunta,
  RespuestasEncuesta,
} from '../domain/survey.types';

export function useSurveyWizard(preguntas: readonly Pregunta[]) {
  const state = ref(createSurveyWizardState());
  const respuestas = reactive<RespuestasEncuesta>({});

  function syncState(nextState: typeof state.value) {
    state.value = nextState;

    for (const questionId of Object.keys(respuestas)) {
      if (!(questionId in nextState.respuestas)) {
        delete respuestas[questionId as keyof RespuestasEncuesta];
      }
    }

    Object.assign(respuestas, nextState.respuestas);
  }

  function getState() {
    return {
      ...state.value,
      respuestas: { ...respuestas },
    };
  }

  function iniciarEncuesta() {
    syncState(startSurvey(getState(), preguntas));
  }

  function cambiarPaso(paso: Paso) {
    syncState({ ...getState(), paso });
  }

  function seleccionarRespuesta(opcionId: OptionId) {
    syncState(selectAnswer(getState(), opcionId));
  }

  function registrarRespuestaActual() {
    syncState(goToNextQuestion(getState(), preguntas));
  }

  function volverPregunta() {
    syncState(goToPreviousQuestion(getState(), preguntas));
  }

  return {
    pasoActual: computed<Paso>(() => state.value.paso),
    indicePreguntaActual: computed(() => state.value.indicePregunta),
    respuestaSeleccionada: computed(() => state.value.respuestaSeleccionada),
    respuestas,
    cambiarPaso,
    iniciarEncuesta,
    seleccionarRespuesta,
    registrarRespuestaActual,
    volverPregunta,
  };
}