import { describe, expect, it, vi } from 'vitest';
import { getResults, type ResultsStore } from '../../../src/features/results/application/getResults';
import { PersistenceError } from '../../../src/features/results/application/errors';
import { preguntas } from '../../../src/features/survey/domain/questions';

/** Almacén de mentira: acceso autorizado y contadores, sin Firestore. */
function almacen(overrides: Partial<ResultsStore> = {}): ResultsStore {
  return {
    canAccessResults: vi.fn().mockResolvedValue(false),
    findSummary: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const deOrganizador = (resumen: Record<string, number> | null) => almacen({
  canAccessResults: vi.fn().mockResolvedValue(true),
  findSummary: vi.fn().mockResolvedValue(resumen),
});

const CON_VOTOS = { 'tonto-1': 3, 'tonto-2': 1 };

describe('palabra que no es de quien organiza', () => {
  it('devuelve null y deja pasar la invitación hacia el cuestionario', async () => {
    // `null` no es un fallo: es lo que mantiene el login como estaba. Si
    // devolviera un error, una invitación normal se vería rota por tener
    // resultados de lectura en su camino.
    const store = almacen();

    await expect(getResults({ secret: 'admindltv', questions: preguntas }, store)).resolves.toBeNull();
  });

  it('ni siquiera busca los contadores si la marca no es de organizador', async () => {
    // Leer el resumen de cualquiera que entre sería trabajo de sobra, y la
    // consulta a Firestore también sale cara.
    const store = deOrganizador(CON_VOTOS);
    (store.canAccessResults as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(getResults({ secret: 'otra', questions: preguntas }, store)).resolves.toBeNull();
    expect(store.findSummary).not.toHaveBeenCalled();
  });

  it('devuelve null con la palabra vacía, sin preguntar a la base de datos', async () => {
    const store = deOrganizador(CON_VOTOS);

    await expect(getResults({ secret: '   ', questions: preguntas }, store)).resolves.toBeNull();
    expect(store.canAccessResults).not.toHaveBeenCalled();
  });
});

describe('la palabra del organizador', () => {
  it('devuelve la fotografía completa de la encuesta', async () => {
    const resultado = await getResults({ secret: 'admindltv', questions: preguntas }, deOrganizador(CON_VOTOS));

    expect(resultado?.total).toBe(4);
    expect(resultado?.resultados).toHaveLength(preguntas.length);
  });

  it('normaliza la palabra igual que el login', async () => {
    // El documento se busca por identificador y `admindltv` en mayúsculas no
    // existe: si esto no se normaliza, escribir en mayúsculas abriría la gala
    // sin abrir nada.
    const store = deOrganizador(CON_VOTOS);

    await getResults({ secret: '  AdminDLTV  ', questions: preguntas }, store);

    expect(store.canAccessResults).toHaveBeenCalledWith('admindltv');
  });

  it('devuelve null si el documento de totales todavía no existe', async () => {
    // La gala se prepara antes que los votos: sin contadores no hay nada que
    // enseñar, y eso no es un error.
    await expect(getResults({ secret: 'admindltv', questions: preguntas }, deOrganizador(null)))
      .resolves.toBeNull();
  });

  it('devuelve null si el documento de totales está vacío o todo a cero', async () => {
    await expect(getResults({ secret: 'admindltv', questions: preguntas }, deOrganizador({})))
      .resolves.toBeNull();
    await expect(getResults({ secret: 'admindltv', questions: preguntas }, deOrganizador({ 'tonto-1': 0 })))
      .resolves.toBeNull();
  });

  it('muestra la gala en cuanto hay un solo voto, sin esperar al resto', async () => {
    // Si el filtro exigiera muchos votos, el organizador vería una pantalla
    // vacía justo cuando acaba de empezar la fiesta.
    const resultado = await getResults({ secret: 'admindltv', questions: preguntas }, deOrganizador({ 'tonto-1': 1 }));

    expect(resultado?.total).toBe(1);
  });
});

describe('fallo al leer los resultados', () => {
  it('envuelve el fallo de la marca de organizador', async () => {
    const store = almacen({
      canAccessResults: vi.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(getResults({ secret: 'admindltv', questions: preguntas }, store))
      .rejects.toBeInstanceOf(PersistenceError);
  });

  it('envuelve el fallo de la lectura de contadores', async () => {
    const store = almacen({
      canAccessResults: vi.fn().mockResolvedValue(true),
      findSummary: vi.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(getResults({ secret: 'admindltv', questions: preguntas }, store))
      .rejects.toBeInstanceOf(PersistenceError);
  });

  it('conserva el fallo original en `cause`', async () => {
    // `classifyNetworkError` desenvuelve para leer el código real de Firebase:
    // un `permission-denied` sin cause se leería a la persona como "algo ha
    // ido mal" en lugar de "sin conexión".
    const original = Object.assign(new Error('offline'), { code: 'unavailable' });
    const store = almacen({
      canAccessResults: vi.fn().mockResolvedValue(true),
      findSummary: vi.fn().mockRejectedValue(original),
    });

    await expect(getResults({ secret: 'admindltv', questions: preguntas }, store))
      .rejects.toMatchObject({ code: 'results-unreadable', cause: original });
  });
});
