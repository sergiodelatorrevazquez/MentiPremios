import { describe, expect, it } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';
import {
  createSurveyWizardState,
  getCurrentQuestion,
  getProgress,
  goToNextQuestion,
  goToPreviousQuestion,
  selectAnswer,
  startSurvey,
  type SurveyWizardState,
} from '../../../src/features/survey/application/surveyWizard';
import { validateSurveyAnswers } from '../../../src/features/survey/domain/survey.rules';
import type { Opcion, Pregunta } from '../../../src/features/survey/domain/survey.types';

const DOS_PREGUNTAS: Pregunta[] = [
  {
    id: 'tonto',
    titulo: 'Tonto del Año',
    opciones: [
      { id: 'tonto-1', texto: 'Miguel' },
      { id: 'tonto-2', texto: 'Pablo' },
    ],
  },
  {
    id: 'casper',
    titulo: 'Casper del Año',
    opciones: [
      { id: 'casper-1', texto: 'Raúl' },
      { id: 'casper-2', texto: 'Jorge' },
    ],
  },
];

const ultimaOpcion = (pregunta: Pregunta): Opcion => pregunta.opciones.at(-1)!;

function responder(preguntas: readonly Pregunta[], opcion: (q: Pregunta) => Opcion['id']) {
  let state = startSurvey(createSurveyWizardState(), preguntas);
  for (const pregunta of preguntas) {
    state = selectAnswer(state, opcion(pregunta));
    state = goToNextQuestion(state, preguntas);
  }
  return state;
}

describe('transiciones del wizard sobre un catálogo de dos preguntas', () => {
  it('inicia en la primera pregunta y sin selección previa', () => {
    const state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);

    expect(state.paso).toBe('questions');
    expect(getCurrentQuestion(state, DOS_PREGUNTAS)).toBe(DOS_PREGUNTAS[0]);
    expect(state.respuestaSeleccionada).toBeNull();
  });

  it('no arranca la encuesta si el catálogo está vacío', () => {
    const state = startSurvey(createSurveyWizardState(), []);

    expect(state.paso).toBe('questions');
    expect(state.respuestaSeleccionada).toBeNull();
  });

  it('no avanza sin respuesta seleccionada', () => {
    const state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);

    expect(goToNextQuestion(state, DOS_PREGUNTAS)).toBe(state);
  });

  it('no avanza si el índice apunta fuera del catálogo', () => {
    const fueraDeRango: SurveyWizardState = {
      ...startSurvey(createSurveyWizardState(), DOS_PREGUNTAS),
      indicePregunta: 5,
      respuestaSeleccionada: 'tonto-1',
    };

    expect(goToNextQuestion(fueraDeRango, DOS_PREGUNTAS)).toBe(fueraDeRango);
  });

  it('no retrocede en la primera pregunta', () => {
    const state = selectAnswer(startSurvey(createSurveyWizardState(), DOS_PREGUNTAS), 'tonto-1');

    expect(goToPreviousQuestion(state, DOS_PREGUNTAS)).toBe(state);
  });

  it('no retrocede con índice negativo', () => {
    const negativo: SurveyWizardState = {
      ...startSurvey(createSurveyWizardState(), DOS_PREGUNTAS),
      indicePregunta: -1,
    };

    expect(goToPreviousQuestion(negativo, DOS_PREGUNTAS)).toBe(negativo);
  });

  it('conserva la respuesta al retroceder y la vuelve a mostrar', () => {
    let state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);
    state = selectAnswer(state, 'tonto-2');
    state = goToNextQuestion(state, DOS_PREGUNTAS);
    state = selectAnswer(state, 'casper-1');

    const atras = goToPreviousQuestion(state, DOS_PREGUNTAS);

    expect(atras.indicePregunta).toBe(0);
    expect(atras.respuestaSeleccionada).toBe('tonto-2');
    // La seleccion pendiente no se guarda hasta avanzar.
    expect(atras.respuestas).toEqual({ tonto: 'tonto-2' });
  });

  it('reavanza tras retroceder y mantiene la respuesta ya guardada', () => {
    let state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);
    state = selectAnswer(state, 'tonto-1');
    state = goToNextQuestion(state, DOS_PREGUNTAS);
    state = selectAnswer(state, 'casper-1');
    state = goToPreviousQuestion(state, DOS_PREGUNTAS);

    const adelante = goToNextQuestion(state, DOS_PREGUNTAS);

    expect(adelante.indicePregunta).toBe(1);
    expect(adelante.respuestas).toEqual({ tonto: 'tonto-1' });
  });

  it('sobrescribe la respuesta al volver a elegir otra opción', () => {
    let state = selectAnswer(startSurvey(createSurveyWizardState(), DOS_PREGUNTAS), 'tonto-1');
    state = goToNextQuestion(state, DOS_PREGUNTAS);
    state = goToPreviousQuestion(state, DOS_PREGUNTAS);
    state = selectAnswer(state, 'tonto-2');

    const final = goToNextQuestion(state, DOS_PREGUNTAS);

    expect(final.respuestas.tonto).toBe('tonto-2');
  });

  it('no arrastra respuestas entre catálogos distintos', () => {
    const soloMeme: Pregunta[] = [{
      id: 'meme',
      titulo: 'Meme del Año',
      opciones: [
        { id: 'meme-1', texto: 'A' },
        { id: 'meme-2', texto: 'B' },
      ],
    }];

    let state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);
    state = selectAnswer(state, 'tonto-1');
    state = goToNextQuestion(state, DOS_PREGUNTAS);

    // La segunda pregunta del catálogo original no existe en el nuevo catálogo.
    expect(getCurrentQuestion(state, soloMeme)).toBeUndefined();
    expect(goToNextQuestion(state, soloMeme)).toBe(state);
  });
});

describe('progreso del wizard', () => {
  it('devuelve 0 sin preguntas', () => {
    expect(getProgress(startSurvey(createSurveyWizardState(), []), [])).toBe(0);
  });

  it('cuenta la pregunta actual como completada', () => {
    const state = startSurvey(createSurveyWizardState(), preguntas);

    expect(getProgress(state, preguntas)).toBe(Math.round((1 / preguntas.length) * 100));
  });

  it('llega al 100% al responder la última', () => {
    const state = responder(preguntas, (pregunta) => pregunta.opciones[0].id);

    expect(getProgress(state, preguntas)).toBe(100);
  });

  it('ronda al entero más cercano y no baja de 1 con una sola pregunta', () => {
    expect(getProgress(startSurvey(createSurveyWizardState(), DOS_PREGUNTAS), DOS_PREGUNTAS))
      .toBe(50);
    expect(getProgress(startSurvey(createSurveyWizardState(), [DOS_PREGUNTAS[0]]), [DOS_PREGUNTAS[0]]))
      .toBe(100);
  });

  it('retrocede también el progreso', () => {
    let state = startSurvey(createSurveyWizardState(), DOS_PREGUNTAS);
    state = selectAnswer(state, 'tonto-1');
    state = goToNextQuestion(state, DOS_PREGUNTAS);

    expect(getProgress(state, DOS_PREGUNTAS)).toBe(100);
    expect(getProgress(goToPreviousQuestion(state, DOS_PREGUNTAS), DOS_PREGUNTAS)).toBe(50);
  });
});

describe('respuestas completas', () => {
  it('registra una respuesta por pregunta del catálogo real', () => {
    const state = responder(preguntas, (pregunta) => pregunta.opciones[0].id);

    expect(Object.keys(state.respuestas).sort()).toEqual(preguntas.map((p) => p.id).sort());
    expect(validateSurveyAnswers(preguntas, state.respuestas).valid).toBe(true);
  });

  it('produce un envío válido eligiendo la última opción de cada pregunta', () => {
    const state = responder(preguntas, (pregunta) => ultimaOpcion(pregunta).id);

    expect(validateSurveyAnswers(preguntas, state.respuestas)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('deja el cuestionario completo tras un ida y vuelta por todas las preguntas', () => {
    let state = startSurvey(createSurveyWizardState(), preguntas);
    state = responder(preguntas, (pregunta) => pregunta.opciones[0].id);
    for (const pregunta of preguntas.slice(0, -1)) {
      state = goToPreviousQuestion(state, preguntas);
      state = selectAnswer(state, pregunta.opciones[1].id);
      state = goToNextQuestion(state, preguntas);
    }

    expect(Object.keys(state.respuestas)).toHaveLength(preguntas.length);
    expect(validateSurveyAnswers(preguntas, state.respuestas).valid).toBe(true);
  });

  it('conserva respuestas que ya no corresponden al catálogo recibido', () => {
    let state = startSurvey(createSurveyWizardState(), preguntas);
    state = selectAnswer(state, 'tonto-1');
    state = goToNextQuestion(state, preguntas);

    const enOtro = goToNextQuestion(state, [preguntas[1]]);

    // El indice ya no apunta a una pregunta real, asi que la transicion no avanza,
    // pero la respuesta de la pregunta anterior sigue guardada.
    expect(enOtro.respuestas).toEqual({ tonto: 'tonto-1' });
  });
});
