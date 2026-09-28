import {
  InvalidInvitationError,
  InvitationAlreadyUsedError,
} from './errors';

export interface InvitationRecord {
  id: string;
  nombre: string;
  usado: boolean;
}

export async function validateInvitation(
  secret: string,
  finder: (normalizedSecret: string) => Promise<InvitationRecord | null>,
): Promise<InvitationRecord> {
  const normalizedSecret = secret.trim().toLowerCase();

  if (!normalizedSecret) {
    throw new InvalidInvitationError('invalid-secret');
  }

  const invitation = await finder(normalizedSecret);

  if (!invitation) {
    throw new InvalidInvitationError('invitation-not-found');
  }

  if (invitation.usado) {
    throw new InvitationAlreadyUsedError('invitation-already-used');
  }

  return invitation;
}
