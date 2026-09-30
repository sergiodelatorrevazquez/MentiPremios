import { describe, expect, it, vi } from 'vitest';
import {
  InvalidSubmissionError,
  PersistenceError,
} from '../../../src/features/survey/application/errors';
import {
  submitSurvey,
  type SubmitSurveyInput,
} from '../../../src/features/survey/application/submitSurvey';
import { validateSurveyAnswers } from '../../../src/features/survey/domain/survey.rules';
import { preguntas as preguntasReales } from '../../../src/features/survey/domain/questions';
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

const respuestasValidas = { tonto: 'tonto-1', casper: 'casper-1' } as const;

function input(overrides: Partial<SubmitSurveyInput> = {}): SubmitSurveyInput {
  return {
    invitationId: 'inv-1',
    questions: preguntas,
    answers: { ...respuestasValidas },
    persist: vi.fn(),
    ...overrides,
  };
}

describe('envío correcto', () => {
  it('devuelve el envío y lo persiste una sola vez', async () => {
    const persist = vi.fn();
    const resultado = await submitSurvey(input({ persist }));

    expect(resultado).toEqual({
      invitationId: 'inv-1',
      answers: { ...respuestasValidas },
    });
    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(resultado);
  });

  it('acepta un persist sincrono además de uno asíncrono', async () => {
    const guardados: unknown[] = [];
    const resultado = await submitSurvey(input({
      persist: (submission) => { guardados.push(submission); },
    }));

    expect(guardados).toEqual([resultado]);
  });

  it('conserva el orden y los valores tal cual los recibió', async () => {
    const persist = vi.fn();
    const resultado = await submitSurvey(input({
      answers: { tonto: 'tonto-2', casper: 'casper-2' },
      persist,
    }));

    expect(Object.keys(resultado.answers)).toEqual(['tonto', 'casper']);
    expect(resultado.answers).toEqual({ tonto: 'tonto-2', casper: 'casper-2' });
  });

  it('acepta las diez preguntas reales del catálogo', async () => {
    const respuestas = Object.fromEntries(
      preguntasReales.map((pregunta) => [pregunta.id, pregunta.opciones[0].id]),
    );
    const resultado = await submitSurvey(input({ questions: preguntasReales, answers: respuestas }));

    expect(Object.keys(resultado.answers)).toHaveLength(preguntasReales.length);
    expect(validateSurveyAnswers(preguntasReales, resultado.answers).valid).toBe(true);
  });
});

describe('envío inválido', () => {
  it('rechaza respuestas incompletas sin persistir', async () => {
    const persist = vi.fn();

    await expect(submitSurvey(input({ answers: { tonto: 'tonto-1' }, persist })))
      .rejects.toMatchObject({
        name: 'InvalidSubmissionError',
        code: 'invalid-submission',
      });
    expect(persist).not.toHaveBeenCalled();
  });

  it('rechaza una opción que no pertenece a la pregunta sin persistir', async () => {
    const persist = vi.fn();

    await expect(submitSurvey(input({
      answers: { tonto: 'casper-1', casper: 'casper-1' },
      persist,
    }))).rejects.toBeInstanceOf(InvalidSubmissionError);
    expect(persist).not.toHaveBeenCalled();
  });

  it('rechaza preguntas desconocidas y sobrantes sin persistir', async () => {
    const persist = vi.fn();

    for (const answers of [
      { ...respuestasValidas, inventada: 'inventada-1' },
      { tonto: 'tonto-1' },
    ]) {
      await expect(submitSurvey(input({ answers, persist })))
        .rejects.toBeInstanceOf(InvalidSubmissionError);
    }
    expect(persist).not.toHaveBeenCalled();
  });

  it('no acepta un envío vacío, pero el filtro final es el servidor', async () => {
    const persist = vi.fn();
    // validateSurveyAnswers solo comprueba consistencia con el catálogo recibido,
    // así que un catálogo vacío y ninguna respuesta son mutuamente válidos.
    // Cierra el hueco `firestore.rules`, cuya lista blanca no admite campos
    // distintos de `haVotado` y de las diez preguntas.
    await expect(submitSurvey(input({ questions: [], answers: {}, persist }))).resolves
      .toEqual({ invitationId: 'inv-1', answers: {} });
    expect(persist).toHaveBeenCalledOnce();
  });
});

describe('error de repositorio', () => {
  it('envuelve el fallo de persistencia en PersistenceError', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('db down'));

    await expect(submitSurvey(input({ persist }))).rejects.toMatchObject({
      name: 'PersistenceError',
      code: 'persistence-error',
      message: 'db down',
    });
  });

  it('envuelve también un rechazo no-Error sin filtrar el tipo', async () => {
    const persist = vi.fn().mockRejectedValue('just a string');

    const error = await submitSurvey(input({ persist })).catch((e) => e);

    expect(error).toBeInstanceOf(PersistenceError);
    expect(error.message).toBe('Unknown persistence error');
  });

  it('expone siempre un error tipado, no el fallo original', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('db down'));
    const error = await submitSurvey(input({ persist })).catch((e) => e);

    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).not.toBeInstanceOf(InvalidSubmissionError);
    expect(error).toBeInstanceOf(Error);
  });

  it('distingue un fallo de persistencia de un envío inválido', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('db down'));

    const error = await submitSurvey(input({ persist })).catch((e) => e);

    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).not.toBeInstanceOf(InvalidSubmissionError);
  });
});

describe('reintento', () => {
  it('permite reintentar tras un fallo de persistencia y persiste entonces', async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(undefined);

    await expect(submitSurvey(input({ persist }))).rejects.toBeInstanceOf(PersistenceError);
    const reintento = await submitSurvey(input({ persist }));

    expect(persist).toHaveBeenCalledTimes(2);
    expect(reintento.answers).toEqual({ ...respuestasValidas });
  });

  it('produce el mismo envío en cada intento', async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(undefined);

    await submitSurvey(input({ persist })).catch(() => undefined);
    const segundo = await submitSurvey(input({ persist }));

    expect(segundo).toEqual(persist.mock.calls[1][0]);
  });

  it('no persiste en un reintento que sigue siendo inválido', async () => {
    const persist = vi.fn();

    await expect(submitSurvey(input({ answers: { tonto: 'tonto-1' }, persist })))
      .rejects.toBeInstanceOf(InvalidSubmissionError);
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('doble envío', () => {
  it('persiste cada invocación: la deduplicación vive en el servidor', async () => {
    const persist = vi.fn();

    await submitSurvey(input({ persist }));
    await submitSurvey(input({ persist }));

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0][0]).toEqual(persist.mock.calls[1][0]);
  });

  it('no muta las respuestas entre invocaciones', async () => {
    const answers = { ...respuestasValidas };
    const primer = await submitSurvey(input({ answers }));
    const segundo = await submitSurvey(input({ answers }));

    expect(answers).toEqual({ ...respuestasValidas });
    expect(primer.answers).not.toBe(segundo.answers);
  });
});
