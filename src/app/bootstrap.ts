import { FirestoreInvitationRepository } from '../infrastructure/firebase/firestoreInvitationRepository';
import { FirestoreSurveySubmissionRepository } from '../infrastructure/firebase/firestoreSurveySubmissionRepository';
import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { SubmitSurveyInput } from '../features/survey/application/submitSurvey';
import type { InvitationRecord } from '../features/survey/application/validateInvitation';
import type { SurveySubmission } from '../features/survey/domain/survey.types';
import type { Firestore } from 'firebase/firestore';
import type { InjectionKey } from 'vue';

export type SubmitSurveyRequest = Omit<SubmitSurveyInput, 'persist' | 'markInvitationUsed'>;

export interface AppServices {
  validateInvitation(secret: string): Promise<InvitationRecord>;
  submitSurvey(input: SubmitSurveyRequest): Promise<SurveySubmission>;
}

export const APP_SERVICES_KEY: InjectionKey<AppServices> = Symbol('app-services');

export function createAppServices(db: Firestore): AppServices {
  const invitationRepository = new FirestoreInvitationRepository(db);
  const surveySubmissionRepository = new FirestoreSurveySubmissionRepository(db);

  return {
    validateInvitation: (secret: string) => validateInvitation(secret, (normalizedSecret) =>
      invitationRepository.findBySecret(normalizedSecret),
    ),
    submitSurvey: (input) => submitSurvey({
      invitationId: input.invitationId,
      participantName: input.participantName,
      questions: input.questions,
      answers: input.answers,
      persist: (submission) => surveySubmissionRepository.submit(submission),
      markInvitationUsed: (invitationId) => invitationRepository.markAsUsed(invitationId),
    }),
  };
}
