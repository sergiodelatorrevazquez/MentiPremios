import type { Firestore } from 'firebase/firestore';
import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { SubmitSurveyInput } from '../features/survey/application/submitSurvey';
import type { InvitationRecord } from '../features/survey/application/validateInvitation';
import type { SurveySubmission } from '../features/survey/domain/survey.types';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../features/survey/application/errors';
import {
  FirestoreSurveyRepository,
  type SaveSurveyOutcome,
  type SurveyStore,
} from '../infrastructure/firebase/firestoreSurveyRepository';
import type { InjectionKey } from 'vue';

export type SubmitSurveyRequest = Omit<SubmitSurveyInput, 'persist'>;

export interface AppServices {
  validateInvitation(secret: string): Promise<InvitationRecord>;
  submitSurvey(input: SubmitSurveyRequest): Promise<SurveySubmission>;
}

export const APP_SERVICES_KEY: InjectionKey<AppServices> = Symbol('app-services');

function throwForOutcome(outcome: SaveSurveyOutcome): void {
  if (outcome === 'not-found') {
    throw new InvalidInvitationError('invitation-not-found', 'invitation-not-found');
  }
  if (outcome === 'already-used') {
    throw new InvitationAlreadyUsedError('invitation-already-used', 'invitation-already-used');
  }
}

/**
 * Composition root: decide de dónde vienen los datos y traducir los fallos del
 * almacén a los errores que la aplicación ya entiende. Toda la lógica de
 * negocio sigue en `features/`; aquí solo se conectan las piezas.
 */
export function createAppServices(db: Firestore): AppServices {
  const store: SurveyStore = new FirestoreSurveyRepository(db);

  return {
    validateInvitation: (secret: string) => validateInvitation(
      secret,
      (normalizedSecret) => store.findInvitation(normalizedSecret),
    ),

    submitSurvey: async (input) => {
      let outcome: SaveSurveyOutcome = 'saved';

      const submission = await submitSurvey({
        invitationId: input.invitationId,
        questions: input.questions,
        answers: input.answers,
        persist: async (toSave) => {
          outcome = await store.saveSurvey({
            invitationId: toSave.invitationId,
            answers: toSave.answers,
          });
        },
      });

      throwForOutcome(outcome);

      return submission;
    },
  };
}