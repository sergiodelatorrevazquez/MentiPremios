import { parseSurveySubmission } from './surveyValidation.js';

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
  newId(collection: string): string;
  serverTimestamp(): unknown;
  runTransaction<T>(operation: (transaction: SubmissionTransaction) => Promise<T>): Promise<T>;
}

export interface SubmitSurveyRequest {
  data: unknown;
  auth: { uid: string } | null;
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

function getStoredAnswers(response: Record<string, unknown>): Record<string, unknown> | null {
  if (response.schemaVersion === 2
    && response.answers !== null
    && typeof response.answers === 'object'
    && !Array.isArray(response.answers)) {
    return response.answers as Record<string, unknown>;
  }

  if (response.schemaVersion === undefined) {
    return response;
  }

  return null;
}

export function createSubmitSurveyHandler(store: SubmissionStore) {
  return async ({ data, auth }: SubmitSurveyRequest): Promise<{ submitted: true }> => {
    if (!auth?.uid) {
      throw new SubmissionEndpointError('unauthenticated', 'Authentication is required.');
    }

    const submission = parseSurveySubmission(data);
    if (!submission) {
      throw new SubmissionEndpointError('invalid-argument', 'Invalid survey submission.');
    }

    const { invitationId, answers } = submission;
    const invitationReference = store.document('codigos', invitationId);
    const generatedResponseId = store.newId('respuestas');

    return store.runTransaction(async (transaction) => {
      const invitation = await transaction.get(invitationReference);
      const invitationData = invitation.data();

      if (!invitation.exists
        || !invitationData
        || typeof invitationData.nombre !== 'string'
        || invitationData.nombre.trim().length === 0
        || typeof invitationData.usado !== 'boolean') {
        throw new SubmissionEndpointError('not-found', 'Invitation not found.');
      }

      const invitationUsed = invitationData.usado;
      const linkedResponseId = invitationData.responseId;
      const isLinkedResponseIdValid = typeof linkedResponseId === 'string'
        && linkedResponseId.length > 0
        && !linkedResponseId.includes('/');
      if (linkedResponseId !== undefined && !isLinkedResponseIdValid) {
        throw new SubmissionEndpointError('failed-precondition', 'Invitation data is invalid.');
      }

      const responseId = isLinkedResponseIdValid ? linkedResponseId : generatedResponseId;
      const responseDocumentId = invitationUsed && !isLinkedResponseIdValid
        ? invitationId
        : responseId;
      const responseReference = store.document('respuestas', responseDocumentId);
      const previousResponse = await transaction.get(responseReference);

      if (previousResponse.exists) {
        const persistedResponse = previousResponse.data();
        const persistedAnswers = persistedResponse && getStoredAnswers(persistedResponse);
        if (invitationUsed && persistedAnswers && haveSameAnswers(persistedAnswers, answers)) {
          return { submitted: true };
        }
        throw new SubmissionEndpointError('failed-precondition', 'Invitation already used.');
      }

      if (invitationUsed) {
        throw new SubmissionEndpointError('failed-precondition', 'Invitation already used.');
      }

      transaction.create(responseReference, {
        schemaVersion: 2,
        participantName: invitationData.nombre,
        answers,
        createdAt: store.serverTimestamp(),
        submittedAt: store.serverTimestamp(),
      });
      transaction.update(invitationReference, { usado: true, responseId });

      return { submitted: true };
    });
  };
}