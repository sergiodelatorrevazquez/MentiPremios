import { describe, expect, it, vi } from 'vitest';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirestoreKeywordsRepository } from '../../src/infrastructure/firebase/firestoreKeywordsRepository';

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
}));

describe('FirestoreKeywordsRepository', () => {
  it('persists optional keywords with a server timestamp', async () => {
    const db = {} as any;
    const repository = new FirestoreKeywordsRepository(db);
    vi.mocked(collection).mockReturnValue('collection-ref' as any);
    vi.mocked(serverTimestamp).mockReturnValue('server-time' as any);

    await repository.save({
      usuario: 'Sergio',
      palabrasClave: ['divertido', 'leal'],
    });

    expect(collection).toHaveBeenCalledWith(db, 'palabrasClave');
    expect(addDoc).toHaveBeenCalledWith('collection-ref', {
      usuario: 'Sergio',
      palabrasClave: ['divertido', 'leal'],
      createdAt: 'server-time',
    });
  });
});