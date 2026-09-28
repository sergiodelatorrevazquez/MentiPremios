import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { SubmitSurveyInput } from '../features/survey/application/submitSurvey';
import type { InvitationRecord } from '../features/survey/application/validateInvitation';
import type { SurveySubmission } from '../features/survey/domain/survey.types';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../features/survey/application/errors';
import { signInAnonymously, type Auth } from 'firebase/auth';
import { httpsCallable, type Functions } from 'firebase/functions';
import type { InjectionKey } from 'vue';

export type SubmitSurveyRequest = Omit<SubmitSurveyInput, 'persist'>;

export interface AppServices {
  validateInvitation(secret: string): Promise<InvitationRecord>;
  submitSurvey(input: SubmitSurveyRequest): Promise<SurveySubmission>;
}

export const APP_SERVICES_KEY: InjectionKey<AppServices> = Symbol('app-services');

export function createAppServices(auth: Auth, functions: Functions): AppServices {
  const remoteValidateInvitation = httpsCallable<
    { secret: string },
    { participantName: string }
  >(functions, 'validateInvitation');
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
      try {
        return await validateInvitation(secret, async (normalizedSecret) => {
          await ensureAnonymousAuthentication();
          const result = await remoteValidateInvitation({ secret: normalizedSecret });
          if (!result.data || typeof result.data.participantName !== 'string') {
            throw new Error('Invalid invitation validation response.');
          }
          return {
            id: normalizedSecret,
            nombre: result.data.participantName,
            usado: false,
          };
        });
      } catch (error) {
        if (error instanceof InvalidInvitationError || error instanceof InvitationAlreadyUsedError) {
          throw error;
        }
        const code = error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
        if (code.endsWith('/not-found') || code.endsWith('/invalid-argument')) {
          throw new InvalidInvitationError('invalid-secret', 'invalid-secret');
        }
        if (code.endsWith('/failed-precondition')) {
          throw new InvitationAlreadyUsedError('invitation-already-used', 'invitation-already-used');
        }
        throw error;
      }
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
