import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import { FirestoreKeywordsRepository } from '../../../src/infrastructure/firebase/firestoreKeywordsRepository';

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function repository() {
  return new FirestoreKeywordsRepository({} as Firestore);
}

describe('FirestoreKeywordsRepository', () => {
  it('persists optional keywords with a server timestamp', async () => {
    vi.mocked(collection).mockReturnValue('collection-ref' as never);
    vi.mocked(serverTimestamp).mockReturnValue('server-time' as never);

    await repository().save({
      usuario: 'Sergio',
      palabrasClave: ['divertido', 'leal'],
    });

    expect(collection).toHaveBeenCalledWith({}, 'palabrasClave');
    expect(addDoc).toHaveBeenCalledWith('collection-ref', {
      usuario: 'Sergio',
      palabrasClave: ['divertido', 'leal'],
      createdAt: 'server-time',
    });
  });

  it('adds the timestamp without replacing submission fields', async () => {
    vi.mocked(collection).mockReturnValue('collection-ref' as never);
    vi.mocked(serverTimestamp).mockReturnValue('server-time' as never);

    await repository().save({ usuario: 'Ana', palabrasClave: ['leal'] });

    const payload = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(['createdAt', 'palabrasClave', 'usuario']);
    expect(payload.palabrasClave).toEqual(['leal']);
  });

  it('accepts a submission with no keywords', async () => {
    vi.mocked(collection).mockReturnValue('collection-ref' as never);

    await repository().save({ usuario: 'Ana', palabrasClave: [] });

    expect(addDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
      palabrasClave: [],
    }));
  });

  it('propagates an SDK failure instead of swallowing it', async () => {
    vi.mocked(collection).mockReturnValue('collection-ref' as never);
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('permission-denied'));

    await expect(repository().save({ usuario: 'Ana', palabrasClave: ['leal'] }))
      .rejects.toThrow('permission-denied');
  });

  it('does not write when the reference cannot be built', async () => {
    vi.mocked(collection).mockImplementationOnce(() => { throw new Error('app not initialised'); });

    await expect(repository().save({ usuario: 'Ana', palabrasClave: [] }))
      .rejects.toThrow('app not initialised');
    expect(addDoc).not.toHaveBeenCalled();
  });
});
