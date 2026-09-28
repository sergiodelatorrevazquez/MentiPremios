import { describe, expect, it, vi } from 'vitest';
import { InvalidSubmissionError, PersistenceError } from '../../../src/features/survey/application/errors';
import { submitSurvey } from '../../../src/features/survey/application/submitSurvey';
import { QUESTION_IDS, type Pregunta } from '../../../src/features/survey/domain/survey.types';

const preguntas: Pregunta[] = [
  {
    id: QUESTION_IDS.tonto,
    titulo: 'Tonto del Año',
    opciones: [
      { id: 'tonto-1', texto: 'Miguel' },
      { id: 'tonto-2', texto: 'Pablo' },
    ],
  },
  {
    id: QUESTION_IDS.casper,
    titulo: 'Casper del Año',
    opciones: [
      { id: 'casper-1', texto: 'Raúl' },
      { id: 'casper-2', texto: 'Jorge' },
    ],
  },
];

describe('submitSurvey', () => {
  it('validates the answers, builds the submission DTO and persists it', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);

    const result = await submitSurvey({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      questions: preguntas,
      answers: {
        tonto: 'tonto-1',
        casper: 'casper-1',
      },
      persist,
    });

    expect(result).toEqual({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      answers: {
        tonto: 'tonto-1',
        casper: 'casper-1',
      },
    });
    expect(persist).toHaveBeenCalledWith({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      answers: {
        tonto: 'tonto-1',
        casper: 'casper-1',
      },
    });
  });

  it('rejects incomplete answers without persisting', async () => {
    const persist = vi.fn();

    await expect(
      submitSurvey({
        invitationId: 'inv-1',
        participantName: 'Sergio',
        questions: preguntas,
        answers: {
          tonto: 'tonto-1',
        },
        persist,
      }),
    ).rejects.toMatchObject({
      name: 'InvalidSubmissionError',
      code: 'invalid-submission',
    });

    expect(persist).not.toHaveBeenCalled();
  });

  it('wraps persistence failures in a domain error', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('db down'));

    await expect(
      submitSurvey({
        invitationId: 'inv-1',
        participantName: 'Sergio',
        questions: preguntas,
        answers: {
          tonto: 'tonto-1',
          casper: 'casper-1',
        },
        persist,
      }),
    ).rejects.toMatchObject({
      name: 'PersistenceError',
      code: 'persistence-error',
    });
  });
});
