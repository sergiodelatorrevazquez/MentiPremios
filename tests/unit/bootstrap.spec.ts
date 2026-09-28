import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInAnonymously, type Auth } from 'firebase/auth';
import { httpsCallable, type Functions } from 'firebase/functions';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { createAppServices } from '../../src/app/bootstrap';
import { preguntas } from '../../src/features/survey/domain/questions';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

describe('createAppServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue('document-reference' as never);
    vi.mocked(signInAnonymously).mockResolvedValue({ user: { uid: 'anonymous-user' } } as never);
  });

  it('normalizes invitation secrets before looking them up', async () => {
    const db = {} as Firestore;
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'inv-1',
      data: () => ({ nombre: 'Sergio', usado: false }),
    } as never);

    const services = createAppServices(db, { currentUser: null } as Auth, {} as Functions);
    await expect(services.validateInvitation('  SECRET-1  ')).resolves.toEqual({
      id: 'inv-1',
      nombre: 'Sergio',
      usado: false,
    });

    expect(doc).toHaveBeenCalledWith(db, 'codigos', 'secret-1');
  });

  it('submits through the callable endpoint after anonymous authentication', async () => {
    const db = {} as Firestore;
    const auth = { currentUser: null } as Auth;
    const functions = {} as Functions;
    const callable = vi.fn().mockResolvedValue({ data: { submitted: true } });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
    const answers = Object.fromEntries(
      preguntas.map((question) => [question.id, question.opciones[0].id]),
    );
    const services = createAppServices(db, auth, functions);

    await services.submitSurvey({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      questions: preguntas,
      answers,
    });

    expect(signInAnonymously).toHaveBeenCalledWith(auth);
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'submitSurvey');
    expect(callable).toHaveBeenCalledWith({ invitationId: 'inv-1', answers });
    expect(doc).not.toHaveBeenCalled();
  });
});