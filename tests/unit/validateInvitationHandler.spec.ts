import { describe, expect, it, vi } from 'vitest';
import {
  createValidateInvitationHandler,
  InvitationLookupError,
  type InvitationLookupStore,
} from '../../functions/src/validateInvitationHandler';

function makeStore(data: Record<string, unknown> | undefined, exists = true) {
  const store: InvitationLookupStore = {
    document: vi.fn((id: string) => `codigos/${id}`),
    get: vi.fn().mockResolvedValue({ exists, data: () => data }),
  };
  return store;
}

describe('createValidateInvitationHandler', () => {
  it('requires authenticated callers', async () => {
    const handler = createValidateInvitationHandler(makeStore({ nombre: 'Sergio', usado: false }));

    await expect(handler({ data: { secret: 'secret-1' }, auth: null }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects malformed and unsafe invitation codes without reading Firestore', async () => {
    const store = makeStore(undefined, false);
    const handler = createValidateInvitationHandler(store);

    await expect(handler({ data: { secret: ' / ' }, auth: { uid: 'anonymous-1' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(store.get).not.toHaveBeenCalled();
  });

  it('normalizes the code and returns only the participant display name', async () => {
    const store = makeStore({ nombre: 'Sergio', usado: false });
    const handler = createValidateInvitationHandler(store);

    await expect(handler({
      data: { secret: '  SECRET-1  ' },
      auth: { uid: 'anonymous-1' },
    })).resolves.toEqual({ participantName: 'Sergio' });

    expect(store.document).toHaveBeenCalledWith('secret-1');
    expect(store.get).toHaveBeenCalledWith('codigos/secret-1');
  });

  it('rejects missing invitations', async () => {
    const handler = createValidateInvitationHandler(makeStore(undefined, false));

    await expect(handler({ data: { secret: 'missing' }, auth: { uid: 'anonymous-1' } }))
      .rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects used invitations', async () => {
    const handler = createValidateInvitationHandler(makeStore({ nombre: 'Sergio', usado: true }));

    await expect(handler({ data: { secret: 'used' }, auth: { uid: 'anonymous-1' } }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('rejects malformed invitation documents without returning their fields', async () => {
    const handler = createValidateInvitationHandler(makeStore({ nombre: 'Sergio', usado: 'false' }));

    await expect(handler({ data: { secret: 'corrupt' }, auth: { uid: 'anonymous-1' } }))
      .rejects.toBeInstanceOf(InvitationLookupError);
  });
});