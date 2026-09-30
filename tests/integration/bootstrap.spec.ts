import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { createAppServices } from '../../src/app/bootstrap';
import { preguntas } from '../../src/features/survey/domain/questions';
import {
  InvitationAlreadyUsedError,
  InvalidInvitationError,
  InvalidSubmissionError,
  PersistenceError,
} from '../../src/features/survey/application/errors';
import { FirestoreSurveyRepository, type SurveyStore } from '../../src/infrastructure/firebase/firestoreSurveyRepository';

vi.mock('../../src/infrastructure/firebase/firestoreSurveyRepository', () => ({
  FirestoreSurveyRepository: vi.fn(),
}));

const db = {} as Firestore;

function withStore(store: Partial<SurveyStore>): ReturnType<typeof createAppServices> {
  vi.mocked(FirestoreSurveyRepository).mockImplementation(
    () => store as unknown as FirestoreSurveyRepository,
  );

  return createAppServices(db);
}

const respuestasCompletas = Object.fromEntries(
  preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createAppServices', () => {
  it('devuelve la invitación que encuentra en Firestore, con el secreto normalizado', async () => {
    const findInvitation = vi.fn().mockResolvedValue({ id: 'secret-1', nombre: 'Sergio', haVotado: false });
    const services = withStore({ findInvitation });

    await expect(services.validateInvitation('  SECRET-1  ')).resolves.toEqual({
      id: 'secret-1',
      nombre: 'Sergio',
      haVotado: false,
    });

    expect(findInvitation).toHaveBeenCalledWith('secret-1');
  });

  it('rechaza un secreto vacío sin preguntar a Firestore', async () => {
    const findInvitation = vi.fn();
    const services = withStore({ findInvitation });

    await expect(services.validateInvitation('   ')).rejects.toBeInstanceOf(InvalidInvitationError);
    expect(findInvitation).not.toHaveBeenCalled();
  });

  it('traduce una invitación inexistente al error de palabra incorrecta', async () => {
    const services = withStore({ findInvitation: vi.fn().mockResolvedValue(null) });

    await expect(services.validateInvitation('no-existe'))
      .rejects.toBeInstanceOf(InvalidInvitationError);
  });

  it('traduce una invitación ya usada al error de respuesta ya realizada', async () => {
    const services = withStore({
      findInvitation: vi.fn().mockResolvedValue({ id: 'secret-1', nombre: 'Sergio', haVotado: true }),
    });

    await expect(services.validateInvitation('secret-1'))
      .rejects.toBeInstanceOf(InvitationAlreadyUsedError);
  });

  it('guarda la encuesta y devuelve el envío', async () => {
    const saveSurvey = vi.fn().mockResolvedValue('saved');
    const services = withStore({ saveSurvey });

    await expect(services.submitSurvey({
      invitationId: 'inv-1',
      questions: preguntas,
      answers: respuestasCompletas,
    })).resolves.toEqual({
      invitationId: 'inv-1',
      answers: respuestasCompletas,
    });

    expect(saveSurvey).toHaveBeenCalledWith({
      invitationId: 'inv-1',
      answers: respuestasCompletas,
    });
  });

  it('no guarda nada si las respuestas no son válidas', async () => {
    const saveSurvey = vi.fn();
    const services = withStore({ saveSurvey });

    await expect(services.submitSurvey({
      invitationId: 'inv-1',
      questions: preguntas,
      answers: { tonto: 'tonto-1' },
    })).rejects.toBeInstanceOf(InvalidSubmissionError);

    expect(saveSurvey).not.toHaveBeenCalled();
  });

  it('traduce una invitación que desaparece entre el login y el envío', async () => {
    const services = withStore({ saveSurvey: vi.fn().mockResolvedValue('not-found') });

    await expect(services.submitSurvey({
      invitationId: 'inv-1',
      questions: preguntas,
      answers: respuestasCompletas,
    })).rejects.toBeInstanceOf(InvalidInvitationError);
  });

  it('traduce una invitación que alguien usaba por delante', async () => {
    const services = withStore({ saveSurvey: vi.fn().mockResolvedValue('already-used') });

    await expect(services.submitSurvey({
      invitationId: 'inv-1',
      questions: preguntas,
      answers: respuestasCompletas,
    })).rejects.toBeInstanceOf(InvitationAlreadyUsedError);
  });

  it('envuelve un fallo de Firestore y permite reintentar con las mismas respuestas', async () => {
    const saveSurvey = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('saved');
    const services = withStore({ saveSurvey });

    const request = {
      invitationId: 'inv-1',
      questions: preguntas,
      answers: respuestasCompletas,
    };

    await expect(services.submitSurvey(request)).rejects.toBeInstanceOf(PersistenceError);
    await expect(services.submitSurvey(request)).resolves.toMatchObject({ invitationId: 'inv-1' });
    expect(saveSurvey).toHaveBeenCalledTimes(2);
  });
});