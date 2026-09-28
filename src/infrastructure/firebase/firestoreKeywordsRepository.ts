import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { KeywordSubmission } from '../../features/keywords/domain/keywords.types';

export interface KeywordsRepository {
  save(submission: KeywordSubmission): Promise<void>;
}

export class FirestoreKeywordsRepository implements KeywordsRepository {
  constructor(private readonly db: Firestore) {}

  async save(submission: KeywordSubmission): Promise<void> {
    const ref = collection(this.db, 'palabrasClave');
    await addDoc(ref, {
      ...submission,
      createdAt: serverTimestamp(),
    });
  }
}