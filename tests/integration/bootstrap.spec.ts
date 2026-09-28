import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInAnonymously, type Auth } from 'firebase/auth';
import { httpsCallable, type Functions } from 'firebase/functions';
import { createAppServices } from '../../src/app/bootstrap';
import { preguntas } from '../../src/features/survey/domain/questions';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../../src/features/survey/application/errors';

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

describe('createAppServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signInAnonymously).mockResolvedValue({ user: { uid: 'anonymous-user' } } as never);
  });

  it('validates a normalized invitation through the callable and returns its display name', async () => {
    const auth = { currentUser: null } as Auth;
    const functions = {} as Functions;
    const validateCallable = vi.fn().mockResolvedValue({ data: { participantName: 'Sergio' } });
    const submitCallable = vi.fn();
    vi.mocked(httpsCallable)
      .mockReturnValueOnce(validateCallable as never)
      .mockReturnValueOnce(submitCallable as never);

    const services = createAppServices(auth, functions);
    await expect(services.validateInvitation('  SECRET-1  ')).resolves.toEqual({
      id: 'secret-1',
      nombre: 'Sergio',
      usado: false,
    });

    expect(signInAnonymously).toHaveBeenCalledWith(auth);
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'validateInvitation');
    expect(validateCallable).toHaveBeenCalledWith({ secret: 'secret-1' });
  });

  it('submits through the callable endpoint after anonymous authentication', async () => {
    const auth = { currentUser: null } as Auth;
    const functions = {} as Functions;
    const validateCallable = vi.fn();
    const submitCallable = vi.fn().mockResolvedValue({ data: { submitted: true } });
    vi.mocked(httpsCallable)
      .mockReturnValueOnce(validateCallable as never)
      .mockReturnValueOnce(submitCallable as never);
    const answers = Object.fromEntries(
      preguntas.map((question) => [question.id, question.opciones[0].id]),
    );
    const services = createAppServices(auth, functions);

    await services.submitSurvey({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      questions: preguntas,
      answers,
    });

    expect(signInAnonymously).toHaveBeenCalledWith(auth);
    expect(httpsCallable).toHaveBeenNthCalledWith(1, functions, 'validateInvitation');
    expect(httpsCallable).toHaveBeenNthCalledWith(2, functions, 'submitSurvey');
    expect(submitCallable).toHaveBeenCalledWith({ invitationId: 'inv-1', answers });
  });

  it('maps callable invitation errors to the existing login error types', async () => {
    const auth = { currentUser: { uid: 'anonymous-user' } } as Auth;
    const validateCallable = vi.fn()
      .mockRejectedValueOnce({ code: 'functions/not-found' })
      .mockRejectedValueOnce({ code: 'functions/failed-precondition' });
    vi.mocked(httpsCallable).mockReturnValue(validateCallable as never);
    const services = createAppServices(auth, {} as Functions);

    await expect(services.validateInvitation('missing')).rejects.toBeInstanceOf(InvalidInvitationError);
    await expect(services.validateInvitation('used')).rejects.toBeInstanceOf(InvitationAlreadyUsedError);
  });
});