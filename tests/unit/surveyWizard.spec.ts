import { describe, expect, it } from 'vitest';
import { preguntas } from '../../src/features/survey/domain/questions';
import {
  createSurveyWizardState,
  getProgress,
  goToNextQuestion,
  goToPreviousQuestion,
  selectAnswer,
  startSurvey,
} from '../../src/features/survey/application/surveyWizard';

describe('surveyWizard', () => {
  it('crea el estado inicial del wizard', () => {
    expect(createSurveyWizardState()).toEqual({
      paso: 'login',
      indicePregunta: 0,
      respuestas: {},
      respuestaSeleccionada: null,
    });
  });

  it('inicia la encuesta en la primera pregunta', () => {
    const state = startSurvey(createSurveyWizardState());

    expect(state.paso).toBe('questions');
    expect(state.indicePregunta).toBe(0);
    expect(state.respuestaSeleccionada).toBeNull();
  });

  it('guarda la respuesta y avanza a la siguiente pregunta', () => {
    const state = selectAnswer(startSurvey(createSurveyWizardState()), 'tonto-1');
    const nextState = goToNextQuestion(state, preguntas);

    expect(nextState.indicePregunta).toBe(1);
    expect(nextState.respuestas).toEqual({ tonto: 'tonto-1' });
    expect(nextState.respuestaSeleccionada).toBeNull();
  });

  it('retrocede y restaura la respuesta anterior', () => {
    const firstState = selectAnswer(startSurvey(createSurveyWizardState()), 'tonto-1');
    const secondState = goToNextQuestion(firstState, preguntas);
    const previousState = goToPreviousQuestion(secondState, preguntas);

    expect(previousState.indicePregunta).toBe(0);
    expect(previousState.respuestaSeleccionada).toBe('tonto-1');
  });

  it('calcula el progreso y no avanza más allá de la última pregunta', () => {
    let state = startSurvey(createSurveyWizardState());

    for (let questionIndex = 0; questionIndex < preguntas.length; questionIndex += 1) {
      const question = preguntas[questionIndex];
      state = selectAnswer(state, question.opciones[0].id);
      state = goToNextQuestion(state, preguntas);
    }

    expect(state.indicePregunta).toBe(preguntas.length - 1);
    expect(Object.keys(state.respuestas)).toHaveLength(preguntas.length);
    expect(getProgress(state, preguntas)).toBe(100);
  });
});