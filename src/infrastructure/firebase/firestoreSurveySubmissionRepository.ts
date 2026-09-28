import { doc, setDoc, type Firestore } from 'firebase/firestore';

export interface SurveySubmissionRecord {
  invitationId: string;
  participantName: string;
  answers: Record<string, string>;
}

export interface SurveySubmissionRepository {
  submit(submission: SurveySubmissionRecord): Promise<void>;
}

export class FirestoreSurveySubmissionRepository implements SurveySubmissionRepository {
  constructor(private readonly db: Firestore) {}

  async submit(submission: SurveySubmissionRecord): Promise<void> {
    const ref = doc(this.db, 'respuestas', submission.invitationId);
    await setDoc(ref, submission);
  }
}
