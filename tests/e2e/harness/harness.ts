import { createApp } from 'vue';
import App from '../../../src/app/App.vue';
import {
  APP_SERVICES_KEY,
  type AppServices,
  type SubmitSurveyRequest,
} from '../../../src/app/bootstrap';
import {
  InvalidInvitationError,
  InvitationAlreadyUsedError,
  PersistenceError,
} from '../../../src/features/survey/application/errors';
import type { SurveySubmission } from '../../../src/features/survey/domain/survey.types';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { calcularResultadoEncuesta } from '../../../src/features/results/domain/results.rules';
import type { ResumenVotos } from '../../../src/features/results/domain/results.types';
import '../../../src/style.css';

type Scenario = 'ok' | 'invalid' | 'used' | 'slow' | 'submit-error' | 'results' | 'results-error';

const params = new URLSearchParams(window.location.search);
const scenario = (params.get('scenario') ?? 'ok') as Scenario;
const delay = Number(params.get('delay') ?? 0);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function submissionFrom(input: SubmitSurveyRequest): SurveySubmission {
  return {
    invitationId: input.invitationId,
    answers: { ...input.answers } as SurveySubmission['answers'],
  };
}

/**
 * Votos de mentira para probar la gala sin Firestore: reparte siete personas
 * entre las opciones de cada pregunta, y deja la última con empate a propósito
 * para que el aviso de empate aparezca en pantalla.
 */
function fakeSummary(): ResumenVotos {
  const resumen: Record<string, number> = {};

  preguntas.forEach((pregunta, indicePregunta) => {
    pregunta.opciones.forEach((opcion, indiceOpcion) => {
      const votos = indicePregunta === preguntas.length - 1
        ? (indiceOpcion < 2 ? 3 : 1)
        : (indiceOpcion === indicePregunta % 3 ? 4 : 1);
      resumen[opcion.id] = (resumen[opcion.id] ?? 0) + votos;
    });
  });

  return resumen;
}

const gala = calcularResultadoEncuesta(preguntas, fakeSummary());

const services: AppServices = {
  async getResults(secret) {
    if (delay > 0) await wait(delay);
    if (scenario === 'results-error') {
      throw new PersistenceError('results-unreadable', 'results-unreadable');
    }
    return scenario === 'results' ? gala : null;
  },
  async validateInvitation(secret) {
    if (delay > 0) await wait(delay);
    if (scenario === 'invalid') {
      throw new InvalidInvitationError('invalid-secret', 'invalid-secret');
    }
    if (scenario === 'used') {
      throw new InvitationAlreadyUsedError('invitation-already-used', 'invitation-already-used');
    }
    return { id: secret, voted: false };
  },
  async submitSurvey(input) {
    if (delay > 0) await wait(delay);
    if (scenario === 'submit-error') {
      throw new PersistenceError('persistence-error', 'persistence-error');
    }
    return submissionFrom(input);
  },
};

createApp(App).provide(APP_SERVICES_KEY, services).mount('#app');