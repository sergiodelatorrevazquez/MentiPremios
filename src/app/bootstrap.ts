import { FirestoreInvitationRepository } from '../infrastructure/firebase/firestoreInvitationRepository';
import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { SubmitSurveyInput } from '../features/survey/application/submitSurvey';
import type { InvitationRecord } from '../features/survey/application/validateInvitation';
import type { SurveySubmission } from '../features/survey/domain/survey.types';
import { signInAnonymously, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';
import type { InjectionKey } from 'vue';

export type SubmitSurveyRequest = Omit<SubmitSurveyInput, 'persist'>;

export interface AppServices {
  validateInvitation(secret: string): Promise<InvitationRecord>;
  submitSurvey(input: SubmitSurveyRequest): Promise<SurveySubmission>;
}

export const APP_SERVICES_KEY: InjectionKey<AppServices> = Symbol('app-services');

export function createAppServices(db: Firestore, auth: Auth, functions: Functions): AppServices {
  const invitationRepository = new FirestoreInvitationRepository(db);
  const remoteSubmitSurvey = httpsCallable<
    { invitationId: string; answers: Readonly<Record<string, string | undefined>> },
    { submitted: true }
  >(functions, 'submitSurvey');

  async function ensureAnonymousAuthentication(): Promise<void> {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  }

  return {
    validateInvitation: async (secret: string) => {
      await ensureAnonymousAuthentication();
      return validateInvitation(secret, (normalizedSecret) =>
        invitationRepository.findBySecret(normalizedSecret),
      );
    },
    submitSurvey: async (input) => {
      await ensureAnonymousAuthentication();
      return submitSurvey({
        invitationId: input.invitationId,
        participantName: input.participantName,
        questions: input.questions,
        answers: input.answers,
        persist: async (submission) => {
          await remoteSubmitSurvey({
            invitationId: submission.invitationId,
            answers: submission.answers,
          });
        },
      });
    },
  };
}
