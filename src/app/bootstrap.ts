import type { Firestore } from 'firebase/firestore';
import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { SubmitSurveyInput } from '../features/survey/application/submitSurvey';
import type { InvitationRecord } from '../features/survey/application/validateInvitation';
import type { SurveySubmission } from '../features/survey/domain/survey.types';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../features/survey/application/errors';
import { getResults, type ResultsStore } from '../features/results/application/getResults';
import type { ResultadoEncuesta } from '../features/results/domain/results.types';
import { preguntas } from '../features/survey/domain/questions';
import {
  FirestoreSurveyRepository,
  type SaveSurveyOutcome,
  type SurveyStore,
} from '../infrastructure/firebase/firestoreSurveyRepository';
import { FirestoreResultsRepository } from '../infrastructure/firebase/firestoreResultsRepository';
import type { InjectionKey } from 'vue';

export type SubmitSurveyRequest = Omit<SubmitSurveyInput, 'persist'>;

export interface AppServices {
  validateInvitation(secret: string): Promise<InvitationRecord>;
  submitSurvey(input: SubmitSurveyRequest): Promise<SurveySubmission>;
  /** La fotografía de la encuesta, o `null` si esta palabra no es la del organizador. */
  getResults(secret: string): Promise<ResultadoEncuesta | null>;
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
  const resultsStore: ResultsStore = new FirestoreResultsRepository(db);

  return {
    validateInvitation: (secret: string) => validateInvitation(
      secret,
      (normalizedSecret) => store.findInvitation(normalizedSecret),
    ),

    // La gala es una pregunta más del login, no una ruta aparte: si la palabra
    // no es la del organizador, esto devuelve `null` y sigue el cuestionario.
    getResults: (secret: string) => getResults(
      { secret, questions: preguntas },
      resultsStore,
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