import { describe, expect, it, vi } from 'vitest';
import {
  createSubmitSurveyHandler,
  SubmissionEndpointError,
  type SubmissionStore,
  type SubmissionTransaction,
} from '../../../functions/src/submitSurveyHandler';
import { SURVEY_OPTION_IDS } from '../../../functions/src/surveySchema';
import { preguntas } from '../../../src/features/survey/domain/questions';

const validAnswers = Object.fromEntries(
  Object.entries(SURVEY_OPTION_IDS).map(([questionId, options]) => [questionId, options[0]]),
) as Record<string, string>;
const storedTimestamp = {
  seconds: 1,
  nanoseconds: 0,
  toDate: () => new Date(1000),
  toMillis: () => 1000,
};

function createStore(options: {
  invitationExists?: boolean;
  invitationUsed?: boolean;
  existingResponse?: Record<string, unknown>;
  invitationData?: Record<string, unknown>;
} = {}) {
  const {
    invitationExists = true,
    invitationUsed = false,
    existingResponse,
  } = options;
  const transaction: SubmissionTransaction = {
    get: vi.fn()
      .mockResolvedValueOnce({
        exists: invitationExists,
        data: () => options.invitationData ?? { nombre: 'Sergio', usado: invitationUsed },
      })
      .mockResolvedValueOnce({
        exists: existingResponse !== undefined,
        data: () => existingResponse,
      }),
    create: vi.fn(),
    update: vi.fn(),
  };
  const store: SubmissionStore = {
    document: vi.fn((collection, id) => `${collection}/${id}`),
    newId: vi.fn(() => 'random-response-id'),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    runTransaction: vi.fn((operation) => operation(transaction)),
  };

  return { store, transaction };
}

describe('submitSurvey callable handler', () => {
  it('keeps the server allowlist aligned with the frontend question catalog', () => {
    const frontendOptions = Object.fromEntries(
      preguntas.map((question) => [question.id, question.opciones.map((option) => option.id)]),
    );
    expect(frontendOptions).toEqual(SURVEY_OPTION_IDS);
  });

  it('creates the response and marks the invitation used in one transaction', async () => {
    const { store, transaction } = createStore();
    const handler = createSubmitSurveyHandler(store);
    const answers = validAnswers;

    await expect(handler({
      auth: { uid: 'anonymous-user' },
      data: { invitationId: 'secret-1', answers },
    })).resolves.toEqual({ submitted: true });

    expect(store.runTransaction).toHaveBeenCalledOnce();
    expect(transaction.create).toHaveBeenCalledWith('respuestas/random-response-id', {
      schemaVersion: 2,
      participantName: 'Sergio',
      answers,
      createdAt: 'server-timestamp',
      submittedAt: 'server-timestamp',
    });
    expect(transaction.update).toHaveBeenCalledWith('codigos/secret-1', {
      usado: true,
      responseId: 'random-response-id',
    });
  });

  it('returns success for an identical retry without writing again', async () => {
    const answers = { ...validAnswers, casper: 'casper-2' };
    const { store, transaction } = createStore({
      invitationUsed: true,
      existingResponse: answers,
    });
    const handler = createSubmitSurveyHandler(store);

    await expect(handler({
      auth: { uid: 'anonymous-user' },
      data: { invitationId: 'secret-1', answers },
    })).resolves.toEqual({ submitted: true });

    expect(transaction.create).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('uses the response ID linked from the invitation for identical versioned retries', async () => {
    const answers = { ...validAnswers };
    const { store, transaction } = createStore({
      invitationUsed: true,
      invitationData: { nombre: 'Sergio', usado: true, responseId: 'response-opaque-123' },
      existingResponse: {
        schemaVersion: 2,
        participantName: 'Sergio',
        answers,
        createdAt: storedTimestamp,
        submittedAt: storedTimestamp,
      },
    });
    const handler = createSubmitSurveyHandler(store);

    await expect(handler({
      auth: { uid: 'anonymous-user' },
      data: { invitationId: 'secret-1', answers },
    })).resolves.toEqual({ submitted: true });

    expect(store.document).toHaveBeenCalledWith('respuestas', 'response-opaque-123');
    expect(transaction.create).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('rejects a retry with answers different from the original submission', async () => {
    const { store, transaction } = createStore({
      invitationUsed: true,
      existingResponse: validAnswers,
    });
    const handler = createSubmitSurveyHandler(store);

    await expect(handler({
      auth: { uid: 'anonymous-user' },
      data: { invitationId: 'secret-1', answers: { ...validAnswers, tonto: 'tonto-2' } },
    })).rejects.toMatchObject({ code: 'failed-precondition' });

    expect(transaction.create).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before accessing Firestore', async () => {
    const { store } = createStore();
    const handler = createSubmitSurveyHandler(store);

    await expect(handler({
      auth: null,
      data: { invitationId: 'secret-1', answers: { tonto: 'tonto-1' } },
    })).rejects.toMatchObject({
      code: 'unauthenticated',
      name: 'SubmissionEndpointError',
    });
    expect(store.runTransaction).not.toHaveBeenCalled();
  });

  it('rejects malformed request data before starting a transaction', async () => {
    const { store } = createStore();
    const handler = createSubmitSurveyHandler(store);

    await expect(handler({
      auth: { uid: 'anonymous-user' },
      data: { invitationId: 'secret-1', answers: [] },
    })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(store.runTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing questions, invalid options, unexpected fields and oversized payloads', async () => {
    const invalidRequests = [
      { invitationId: 'secret-1', answers: { ...validAnswers, tonto: undefined } },
      { invitationId: 'secret-1', answers: { ...validAnswers, unknown: 'unknown-1' } },
      { invitationId: 'secret-1', answers: { ...validAnswers, tonto: 'casper-1' } },
      { invitationId: 'secret-1', answers: validAnswers, participantName: 'Sergio' },
      { invitationId: 'x'.repeat(5000), answers: validAnswers },
    ];

    for (const data of invalidRequests) {
      const { store } = createStore();
      const handler = createSubmitSurveyHandler(store);
      await expect(handler({ auth: { uid: 'anonymous-user' }, data }))
        .rejects.toMatchObject({ code: 'invalid-argument' });
      expect(store.runTransaction).not.toHaveBeenCalled();
    }
  });

  it('does not write when the invitation is missing or already used', async () => {
    for (const storeState of [
      { invitationExists: false },
      { invitationUsed: true },
      { invitationData: { nombre: '', usado: false } },
    ]) {
      const { store, transaction } = createStore(storeState);
      const handler = createSubmitSurveyHandler(store);

      await expect(handler({
        auth: { uid: 'anonymous-user' },
        data: { invitationId: 'secret-1', answers: validAnswers },
      })).rejects.toBeInstanceOf(SubmissionEndpointError);

      expect(transaction.create).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    }
  });
});