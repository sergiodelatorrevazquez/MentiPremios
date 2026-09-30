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
import '../../../src/style.css';

type Scenario = 'ok' | 'invalid' | 'used' | 'slow' | 'submit-error';

const params = new URLSearchParams(window.location.search);
const scenario = (params.get('scenario') ?? 'ok') as Scenario;
const participantName = params.get('name') ?? 'Amigo';
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

const services: AppServices = {
  async validateInvitation(secret) {
    if (delay > 0) await wait(delay);
    if (scenario === 'invalid') {
      throw new InvalidInvitationError('invalid-secret', 'invalid-secret');
    }
    if (scenario === 'used') {
      throw new InvitationAlreadyUsedError('invitation-already-used', 'invitation-already-used');
    }
    return { id: secret, nombre: participantName, haVotado: false };
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
