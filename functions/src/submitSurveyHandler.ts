export type SubmissionErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'not-found'
  | 'failed-precondition';

export class SubmissionEndpointError extends Error {
  constructor(public readonly code: SubmissionErrorCode, message: string) {
    super(message);
    this.name = 'SubmissionEndpointError';
  }
}

export interface InvitationSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface SubmissionTransaction {
  get(reference: unknown): Promise<InvitationSnapshot>;
  create(reference: unknown, data: Record<string, unknown>): void;
  update(reference: unknown, data: Record<string, unknown>): void;
}

export interface SubmissionStore {
  document(collection: string, id: string): unknown;
  runTransaction<T>(operation: (transaction: SubmissionTransaction) => Promise<T>): Promise<T>;
}

export interface SubmitSurveyRequest {
  data: unknown;
  auth: { uid: string } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function haveSameAnswers(
  persistedAnswers: Record<string, unknown>,
  submittedAnswers: Record<string, unknown>,
): boolean {
  const persistedQuestionIds = Object.keys(persistedAnswers);
  const submittedQuestionIds = Object.keys(submittedAnswers);

  return persistedQuestionIds.length === submittedQuestionIds.length
    && submittedQuestionIds.every((questionId) => (
      persistedAnswers[questionId] === submittedAnswers[questionId]
    ));
}

export function createSubmitSurveyHandler(store: SubmissionStore) {
  return async ({ data, auth }: SubmitSurveyRequest): Promise<{ submitted: true }> => {
    if (!auth?.uid) {
      throw new SubmissionEndpointError('unauthenticated', 'Authentication is required.');
    }

    if (!isRecord(data)
      || typeof data.invitationId !== 'string'
      || data.invitationId.trim().length === 0
      || !isRecord(data.answers)) {
      throw new SubmissionEndpointError('invalid-argument', 'Invalid survey submission.');
    }

    const invitationId = data.invitationId;
    const answers = data.answers;
    const invitationReference = store.document('codigos', invitationId);
    const responseReference = store.document('respuestas', invitationId);

    return store.runTransaction(async (transaction) => {
      const invitation = await transaction.get(invitationReference);
      const previousResponse = await transaction.get(responseReference);

      if (!invitation.exists) {
        throw new SubmissionEndpointError('not-found', 'Invitation not found.');
      }

      const invitationUsed = invitation.data()?.usado === true;
      if (previousResponse.exists) {
        const persistedAnswers = previousResponse.data();
        if (invitationUsed && persistedAnswers && haveSameAnswers(persistedAnswers, answers)) {
          return { submitted: true };
        }
        throw new SubmissionEndpointError('failed-precondition', 'Invitation already used.');
      }

      if (invitationUsed) {
        throw new SubmissionEndpointError('failed-precondition', 'Invitation already used.');
      }

      transaction.create(responseReference, answers);
      transaction.update(invitationReference, { usado: true });

      return { submitted: true };
    });
  };
}