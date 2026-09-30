import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore';
import { FirestoreSurveyRepository } from '../../../src/infrastructure/firebase/firestoreSurveyRepository';
import { preguntas } from '../../../src/features/survey/domain/questions';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segmentos: string[]) => `/${segmentos.join('/')}`),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
}));

const db = {} as Firestore;

/** Lo que hay guardado, por ruta de documento. */
type Estado = Record<string, Record<string, unknown>>;

/** Las escrituras que hizo la última transacción, en orden. */
let escrituras: { ruta: string; datos: Record<string, unknown> }[] = [];

/**
 * Emulador de lo justo: una transacción lee por ruta y escribe por ruta. Las
 * escrituras se aplican al instante para que un segundo voto vea el resumen que
 * dejó el primero, como ocurre en Firestore.
 */
function instalar(estado: Estado): void {
  vi.mocked(runTransaction).mockImplementation((async (
    _db: Firestore,
    callback: (transaction: unknown) => Promise<unknown>,
  ) => {
    const transaction = {
      get: async (referencia: string) => {
        const datos = estado[referencia];

        return { exists: () => datos !== undefined, data: () => datos };
      },
      update: (referencia: string, datos: Record<string, unknown>) => {
        escrituras.push({ ruta: referencia, datos });
        estado[referencia] = { ...(estado[referencia] ?? {}), ...datos };
      },
    };

    return callback(transaction as never);
  }) as never);
}

const RESUMEN_VACIO = '/resumen/actual';

/** Voto completo y válido, con la primera opción de cada pregunta. */
function votoCompleto(invitacionId = 'admindltv') {
  return {
    invitationId: invitacionId,
    answers: Object.fromEntries(preguntas.map((pregunta) => [pregunta.id, pregunta.opciones[0]!.id])),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  escrituras = [];
});

describe('guardar un voto', () => {
  it('escribe el voto y los contadores en la misma transacción', async () => {
    // Si fueran dos transacciones, podría quedar el voto guardado sin su
    // contador, y la gala enseñaría un reparto que no cuadra.
    instalar({ '/codes/admindltv': { voted: false }, [RESUMEN_VACIO]: {} });

    await expect(new FirestoreSurveyRepository(db).saveSurvey(votoCompleto())).resolves.toBe('saved');

    expect(vi.mocked(runTransaction)).toHaveBeenCalledTimes(1);
    expect(escrituras.map((escritura) => escritura.ruta)).toEqual(['/codes/admindltv', RESUMEN_VACIO]);
  });

  it('suma uno a los contadores que ya había', async () => {
    instalar({
      '/codes/admindltv': { voted: false },
      [RESUMEN_VACIO]: { 'tonto-1': 4, 'tonto-2': 1 },
    });

    await new FirestoreSurveyRepository(db).saveSurvey(votoCompleto());

    const [, resumen] = escrituras;

    expect(resumen?.datos['tonto-1']).toBe(5);
  });

  it('empieza los contadores que aún no existen a uno, no a cero', async () => {
    instalar({ '/codes/admindltv': { voted: false }, [RESUMEN_VACIO]: {} });

    await new FirestoreSurveyRepository(db).saveSurvey(votoCompleto());

    const [, resumen] = escrituras;

    // Un cero en el resumen sería indistinguible de "nadie ha votedido".
    expect(resumen?.datos[preguntas[0]!.opciones[0]!.id]).toBe(1);
  });

  it('va contando uno a uno con cada voto que llega', async () => {
    const estado: Estado = { '/codes/a': { voted: false }, '/codes/b': { voted: false }, [RESUMEN_VACIO]: {} };
    instalar(estado);
    const repository = new FirestoreSurveyRepository(db);

    await repository.saveSurvey(votoCompleto('a'));
    await repository.saveSurvey(votoCompleto('b'));

    expect(estado[RESUMEN_VACIO]?.[preguntas[0]!.opciones[0]!.id]).toBe(2);
  });

  it('escribe un contador por pregunta contestada y ninguno más', async () => {
    instalar({ '/codes/secreta': { voted: false }, [RESUMEN_VACIO]: {} });

    await new FirestoreSurveyRepository(db).saveSurvey({
      invitationId: 'secreta',
      answers: { tonto: 'tonto-2', casper: 'casper-3' },
    });

    const [, resumen] = escrituras;

    expect(Object.keys(resumen?.datos ?? {}).sort()).toEqual(['casper-3', 'tonto-2']);
  });

  it('marca la invitación como votada y guarda solo el identificador y las respuestas', async () => {
    instalar({ '/codes/secreta': { voted: false }, [RESUMEN_VACIO]: {} });

    await new FirestoreSurveyRepository(db).saveSurvey({
      invitationId: 'secreta',
      answers: { tonto: 'tonto-1' },
    });

    const [voto] = escrituras;

    expect(voto?.datos).toEqual({ voted: true, tonto: 'tonto-1' });
  });

  it('redondea hacia abajo un contador raro antes de sumarle uno', async () => {
    // Las reglas exigen `+ 1` exacto. Si un contador llega a 2.7 y se escribiera
    // 3.7, la regla rechazaría la escritura entera y nadie podría votar.
    instalar({
      '/codes/secreta': { voted: false },
      [RESUMEN_VACIO]: { 'tonto-1': 2.7, 'tonto-2': 'muchos', 'casper-1': -4 },
    });

    await new FirestoreSurveyRepository(db).saveSurvey({
      invitationId: 'secreta',
      answers: { tonto: 'tonto-1', casper: 'casper-1', meme: 'meme-1' },
    });

    const [, resumen] = escrituras;

    expect(resumen?.datos['tonto-1']).toBe(3);
    expect(resumen?.datos['casper-1']).toBe(1);
    expect(resumen?.datos['meme-1']).toBe(1);
  });
});

describe('votos que no se guardan', () => {
  it('no toca los contadores si la invitación no existe', async () => {
    // Un contador subiendo sin voto detrás falsearía la gala entera.
    instalar({ [RESUMEN_VACIO]: {} });

    await expect(new FirestoreSurveyRepository(db).saveSurvey(votoCompleto('no-existe'))).resolves.toBe('not-found');
    expect(escrituras).toEqual([]);
  });

  it('no toca los contadores si la invitación ya se usó', async () => {
    instalar({ '/codes/usada': { voted: true }, [RESUMEN_VACIO]: {} });

    await expect(new FirestoreSurveyRepository(db).saveSurvey(votoCompleto('usada'))).resolves.toBe('already-used');
    expect(escrituras).toEqual([]);
  });

  it('no toca los contadores si el documento no parece una invitación', async () => {
    // Un documento sin `voted` no es una invitación válida: se trata como
    // inexistente en vez de escribir sobre algo raro.
    instalar({ '/codes/raro': {voted: 'no' }, [RESUMEN_VACIO]: {} });

    await expect(new FirestoreSurveyRepository(db).saveSurvey(votoCompleto('raro'))).resolves.toBe('not-found');
    expect(escrituras).toEqual([]);
  });
});

describe('leer una invitación', () => {
  it('devuelve el identificador y si ya votó', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ voted: false }) } as never);

    await expect(new FirestoreSurveyRepository(db).findInvitation('admindltv'))
      .resolves.toEqual({ id: 'admindltv', voted: false });
  });

  it('devuelve null si el documento no existe', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as never);

    await expect(new FirestoreSurveyRepository(db).findInvitation('nada')).resolves.toBeNull();
  });

  it('no lee la marca del organizador al validar una invitación normal', async () => {
    // El login solo necesita `voted`: leer la marca aquí mezclaría dos
    // responsabilidades y `validateInvitation` seguiría sin enterarse.
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ voted: true, admin: true }) } as never);

    const invitation = await new FirestoreSurveyRepository(db).findInvitation('admindltv');

    expect(invitation).toEqual({ id: 'admindltv', voted: true });
    expect(Object.keys(invitation!).sort()).toEqual(['id', 'voted']);
  });
});
