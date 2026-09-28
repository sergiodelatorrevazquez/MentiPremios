import { describe, expect, it, vi } from 'vitest';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreInvitationRepository } from '../../src/infrastructure/firebase/firestoreInvitationRepository';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

describe('FirestoreInvitationRepository', () => {
  it('loads an invitation by secret', async () => {
    const db = {} as any;
    const repository = new FirestoreInvitationRepository(db);
    const snap = {
      exists: () => true,
      id: 'codigo-1',
      data: () => ({ nombre: 'Sergio', usado: false }),
    };

    vi.mocked(getDoc).mockResolvedValue(snap as any);

    const result = await repository.findBySecret('secret-1');

    expect(doc).toHaveBeenCalledWith(db, 'codigos', 'secret-1');
    expect(result).toEqual({
      id: 'codigo-1',
      nombre: 'Sergio',
      usado: false,
    });
  });

  it('returns null when the invitation does not exist', async () => {
    const db = {} as any;
    const repository = new FirestoreInvitationRepository(db);
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await expect(repository.findBySecret('missing')).resolves.toBeNull();
  });
});
