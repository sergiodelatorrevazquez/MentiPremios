import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { FirestoreResultsRepository } from '../../../src/infrastructure/firebase/firestoreResultsRepository';

vi.mock('firebase/firestore', () => ({
  // La ruta es la clave con la que se responde en cada test: la instancia de
  // Firestore no aporta nada y se descarta.
  doc: vi.fn((_db: unknown, ...segmentos: string[]) => `/${segmentos.join('/')}`),
  getDoc: vi.fn(),
}));

const db = {} as Firestore;
const repository = () => new FirestoreResultsRepository(db);

/** `getDoc` que responde distinto según el documento que se le pida. */
function respondeCon(documentos: Record<string, unknown>): void {
  vi.mocked(getDoc).mockImplementation(async (referencia) => {
    const datos = documentos[String(referencia)];

    return {
      exists: () => datos !== undefined,
      data: () => datos,
    } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('el acceso de quien organiza a la gala', () => {
  it('lee la invitación por identificador, en la colección de códigos', async () => {
    // Se lee el documento cuya clave es la palabra, no se busca en la
    // colección: `list` está prohibido en las reglas y aquí no se usa.
    respondeCon({ '/codes/admindltv': { voted: true, admin: true } });

    await expect(repository().canAccessResults('admindltv')).resolves.toBe(true);
    expect(getDoc).toHaveBeenCalledWith('/codes/admindltv');
  });

  it('no da la gala si la invitación no es de organización', async () => {
    respondeCon({ '/codes/admindltv': { voted: true, admin: false } });
    await expect(repository().canAccessResults('admindltv')).resolves.toBe(false);

    respondeCon({ '/codes/admindltv': { voted: true, admin: 'true' } });
    await expect(repository().canAccessResults('admindltv')).resolves.toBe(false);
  });

  it('no da la gala a organización hasta que haya votado', async () => {
    respondeCon({ '/codes/admindltv': { voted: false, admin: true } });
    await expect(repository().canAccessResults('admindltv')).resolves.toBe(false);

    respondeCon({ '/codes/admindltv': { voted: 'true', admin: true } });
    await expect(repository().canAccessResults('admindltv')).resolves.toBe(false);
  });

  it('no da la gala a una invitación votada que no sea de organización', async () => {
    respondeCon({ '/codes/invitado': { voted: true, admin: false } });
    await expect(repository().canAccessResults('invitado')).resolves.toBe(false);
  });

  it('trata como normal una invitación que no existe', async () => {
    // Que no exista no es un error de permisos: es que la palabra no vale.
    respondeCon({});

    await expect(repository().canAccessResults('nada')).resolves.toBe(false);
  });
});

describe('el documento de totales', () => {
  it('lee el documento fijo de resumen, sin enumerar nada', async () => {
    respondeCon({ '/resumen/actual': { 'tonto-1': 3 } });

    await expect(repository().findSummary()).resolves.toEqual({ 'tonto-1': 3 });
    expect(getDoc).toHaveBeenCalledWith('/resumen/actual');
  });

  it('devuelve null si el documento todavía no existe', async () => {
    // El organizador lo crea en la consola antes de la fiesta; hasta entonces
    // no hay gala, y eso no es un fallo.
    respondeCon({});

    await expect(repository().findSummary()).resolves.toBeNull();
  });

  it('devuelve null si el documento existe pero está vacío', async () => {
    respondeCon({ '/resumen/actual': {} });

    await expect(repository().findSummary()).resolves.toBeNull();
  });

  it('descarta los contadores que no son números enteros positivos', async () => {
    // Lo raro que se cuele en el documento no puede acabar en un `NaN` dentro
    // de la tarta.
    respondeCon({
      '/resumen/actual': {
        'tonto-1': 3,
        'tonto-2': 'muchos',
        'tonto-3': null,
        'tonto-4': Number.NaN,
        'tonto-5': -2,
        'tonto-6': 2.9,
        'tonto-7': { count: 1 },
      },
    });

    await expect(repository().findSummary()).resolves.toEqual({ 'tonto-1': 3, 'tonto-6': 2 });
  });

  it('devuelve null si todos los contadores eran inservibles', async () => {
    // Un documento lleno de basura no es un resultado: es mejor no pintar nada
    // que pintar una tarta a cero.
    respondeCon({ '/resumen/actual': { 'tonto-1': 'x', 'tonto-2': -1 } });

    await expect(repository().findSummary()).resolves.toBeNull();
  });

  it('deja pasar los contadores tal cual, sin inventar un total', async () => {
    // El total se deduce en el dominio sumando los votos; guardarlo aquí
    // duplicaría la fuente de verdad y podría desincronizarse.
    respondeCon({ '/resumen/actual': { 'tonto-1': 4, 'tonto-2': 1 } });

    const resumen = await repository().findSummary();

    expect(Object.keys(resumen!).sort()).toEqual(['tonto-1', 'tonto-2']);
  });
});
