import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type { SurveySubmission } from '../../features/survey/domain/survey.types';

export interface SurveySubmissionRepository {
  submit(submission: SurveySubmission): Promise<void>;
}

export class FirestoreSurveySubmissionRepository implements SurveySubmissionRepository {
  constructor(private readonly db: Firestore) {}

  async submit(submission: SurveySubmission): Promise<void> {
    const ref = doc(this.db, 'respuestas', submission.invitationId);
    await setDoc(ref, submission.answers);
  }
}
