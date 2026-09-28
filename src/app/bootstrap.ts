import { FirestoreInvitationRepository } from '../infrastructure/firebase/firestoreInvitationRepository';
import { FirestoreSurveySubmissionRepository } from '../infrastructure/firebase/firestoreSurveySubmissionRepository';
import { validateInvitation } from '../features/survey/application/validateInvitation';
import { submitSurvey } from '../features/survey/application/submitSurvey';
import type { Firestore } from 'firebase/firestore';

export function createAppServices(db: Firestore) {
  const invitationRepository = new FirestoreInvitationRepository(db);
  const surveySubmissionRepository = new FirestoreSurveySubmissionRepository(db);

  return {
    validateInvitation: (secret: string) => validateInvitation(secret, (normalizedSecret) =>
      invitationRepository.findBySecret(normalizedSecret),
    ),
    submitSurvey: (input: {
      invitationId: string;
      participantName: string;
      questions: readonly any[];
      answers: Readonly<Record<string, string | undefined>>;
    }) => submitSurvey({
      invitationId: input.invitationId,
      participantName: input.participantName,
      questions: input.questions,
      answers: input.answers,
      persist: (submission) => surveySubmissionRepository.submit(submission),
      markInvitationUsed: async (invitationId) => {
        // intencionalmente no-op para mantener el contrato de infraestructura actual
        return Promise.resolve();
      },
    }),
  };
}
