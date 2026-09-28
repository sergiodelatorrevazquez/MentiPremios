import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import {
  FirestoreKeywordsRepository,
  type KeywordsRepository,
} from '../../../src/infrastructure/firebase/firestoreKeywordsRepository';
import type { KeywordSubmission } from '../../../src/features/keywords/domain/keywords.types';
import {
  createValidateInvitationHandler,
  type InvitationLookupStore,
} from '../../../functions/src/validateInvitationHandler';
import {
  createSubmitSurveyHandler,
  type SubmissionStore,
} from '../../../functions/src/submitSurveyHandler';
import { parseSurveySubmission } from '../../../functions/src/surveyValidation';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { SURVEY_OPTION_IDS } from '../../../functions/src/surveySchema';

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adaptador de palabras clave', () => {
  it('cumple la interfaz de repositorio de la aplicación', () => {
    const db = {} as Firestore;
    const repository: KeywordsRepository = new FirestoreKeywordsRepository(db);

    expect(typeof repository.save).toBe('function');
    expect(repository.save.length).toBe(1);
  });

  it('recibe el tipo de envío del dominio, no un DTO propio', () => {
    // Si el adaptador declarara su propia forma, esta asignación no compilaría.
    const submission: KeywordSubmission = { usuario: 'Sergio', palabrasClave: ['leal'] };
    const guardar: (s: KeywordSubmission) => Promise<void> = new FirestoreKeywordsRepository(
      {} as Firestore,
    ).save.bind(new FirestoreKeywordsRepository({} as Firestore));

    expect(typeof guardar).toBe('function');
    expect(submission).toEqual({ usuario: 'Sergio', palabrasClave: ['leal'] });
  });
});

describe('adaptadores de Cloud Function', () => {
  it('el store de validación satisface la interfaz declarada', () => {
    const store: InvitationLookupStore = {
      document: vi.fn((id: string) => `codigos/${id}`),
      get: vi.fn(),
    };
    const handler = createValidateInvitationHandler(store);

    expect(typeof handler).toBe('function');
    expect(typeof store.document).toBe('function');
    expect(typeof store.get).toBe('function');
  });

  it('el store de envío satisface la interfaz declarada', () => {
    const store: SubmissionStore = {
      document: vi.fn(),
      newId: vi.fn(),
      serverTimestamp: vi.fn(),
      runTransaction: vi.fn(),
    };

    expect(typeof createSubmitSurveyHandler(store)).toBe('function');
    expect(store).toMatchObject({
      document: expect.any(Function),
      newId: expect.any(Function),
      serverTimestamp: expect.any(Function),
      runTransaction: expect.any(Function),
    });
  });

  it('el endpoint de envío acepta exactamente lo que produce el caso de uso', () => {
    const answers = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );
    const submission = {
      invitationId: 'secret-1',
      participantName: 'Sergio',
      answers,
    };

    // El contrato del endpoint no acepta participantName: solo id y respuestas.
    expect(parseSurveySubmission({ invitationId: submission.invitationId, answers: submission.answers }))
      .toEqual({ invitationId: 'secret-1', answers });
    expect(parseSurveySubmission(submission)).toBeNull();
  });

  it('la allowlist del servidor coincide con el catálogo del cliente', () => {
    const catalogo = Object.fromEntries(
      preguntas.map((pregunta) => [pregunta.id, pregunta.opciones.map((opcion) => opcion.id)]),
    );

    expect(catalogo).toEqual(SURVEY_OPTION_IDS);
  });
});
