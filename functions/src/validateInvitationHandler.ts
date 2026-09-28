import { parseInvitationDocument } from './firestoreSchemas.js';

export type InvitationLookupErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'not-found'
  | 'failed-precondition';

export class InvitationLookupError extends Error {
  constructor(public readonly code: InvitationLookupErrorCode, message: string) {
    super(message);
    this.name = 'InvitationLookupError';
  }
}

export interface InvitationSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface InvitationLookupStore {
  document(id: string): unknown;
  get(reference: unknown): Promise<InvitationSnapshot>;
}

export interface ValidateInvitationRequest {
  data: unknown;
  auth: { uid: string } | null;
}

export function createValidateInvitationHandler(store: InvitationLookupStore) {
  return async ({ data, auth }: ValidateInvitationRequest): Promise<{ participantName: string }> => {
    if (!auth?.uid) {
      throw new InvitationLookupError('unauthenticated', 'Authentication is required.');
    }

    if (!data || typeof data !== 'object' || !('secret' in data)
      || typeof data.secret !== 'string') {
      throw new InvitationLookupError('invalid-argument', 'Invalid invitation code.');
    }

    const secret = data.secret.trim().toLowerCase();
    if (!secret || secret.length > 128 || secret.includes('/')) {
      throw new InvitationLookupError('invalid-argument', 'Invalid invitation code.');
    }

    const snapshot = await store.get(store.document(secret));
    if (!snapshot.exists) {
      throw new InvitationLookupError('not-found', 'Invalid invitation code.');
    }

    const invitation = parseInvitationDocument(snapshot.data());
    if (!invitation) {
      throw new InvitationLookupError('not-found', 'Invalid invitation code.');
    }

    if (invitation.usado) {
      throw new InvitationLookupError('failed-precondition', 'Invitation already used.');
    }

    return { participantName: invitation.nombre };
  };
}