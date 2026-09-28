import { describe, expect, it } from 'vitest';
import { validateInvitation } from '../../src/features/survey/application/validateInvitation';

describe('validateInvitation', () => {
  it('normalizes the input and returns a valid invitation', async () => {
    const invitation = {
      id: 'abc-123',
      nombre: 'Sergio',
      usado: false,
    };

    const result = await validateInvitation('  secreto-123  ', async (secret) => {
      expect(secret).toBe('secreto-123');
      return invitation;
    });

    expect(result).toEqual(invitation);
  });

  it('throws when the invitation does not exist', async () => {
    await expect(
      validateInvitation('missing', async () => null),
    ).rejects.toThrow('invitation-not-found');
  });

  it('throws when the invitation was already used', async () => {
    await expect(
      validateInvitation('used', async () => ({
        id: 'abc-123',
        nombre: 'Sergio',
        usado: true,
      })),
    ).rejects.toThrow('invitation-already-used');
  });
});
