import { describe, expect, it } from 'vitest';
import {
  classifyNetworkError,
  networkMessage,
  type NetworkErrorKind,
} from '../../../src/features/survey/application/networkError';
import { PersistenceError } from '../../../src/features/survey/application/errors';

function conRed(online: boolean) {
  return classifyNetworkError(new Error('cualquiera'), { online });
}

describe('sin conexión', () => {
  it('gana si el navegador dice que está sin red, aunque el error sea de permisos', () => {
    const fallo = classifyNetworkError(
      Object.assign(new Error('permission denied'), { code: 'functions/permission-denied' }),
      { online: false },
    );

    expect(fallo.kind).toBe('offline');
    expect(fallo.userMessage).toMatch(/conexión a internet/i);
    expect(fallo.retryable).toBe(true);
  });

  it('reconoce los códigos de red del navegador', () => {
    for (const code of ['offline', 'network-request-failed', 'err_internet_disconnected']) {
      expect(classifyNetworkError({ code }, { online: true }).kind).toBe('offline');
    }
  });

  it('reconoce un fetch fallido', () => {
    expect(classifyNetworkError(new TypeError('Failed to fetch'), { online: true }).kind)
      .toBe('offline');
  });

  it('usa navigator.onLine cuando no se pasa contexto', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });

    expect(classifyNetworkError(new Error('x')).kind).toBe('offline');

    if (original) Object.defineProperty(globalThis, 'navigator', original);
  });
});

describe('timeout', () => {
  it('reconoce el código de deadline de Cloud Functions', () => {
    expect(classifyNetworkError({ code: 'functions/deadline-exceeded' }, { online: true }).kind)
      .toBe('timeout');
  });

  it('reconoce un TimeoutError del navegador', () => {
    const error = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });

    expect(classifyNetworkError(error, { online: true }).kind).toBe('timeout');
    expect(classifyNetworkError(error, { online: true }).userMessage).toMatch(/tardado demasiado/i);
  });

  it('reconoce el texto de timeout aunque no haya código', () => {
    expect(classifyNetworkError(new Error('Request timeout after 60000ms'), { online: true }).kind)
      .toBe('timeout');
  });
});

describe('permisos', () => {
  it('reconoce los códigos de sesión y permisos', () => {
    for (const code of [
      'functions/permission-denied',
      'functions/unauthenticated',
      'functions/failed-precondition',
    ]) {
      expect(classifyNetworkError({ code }, { online: true }).kind).toBe('permission');
    }
  });

  it('reconoce el error de App Check sin código', () => {
    expect(classifyNetworkError(new Error('Missing or insufficient permissions.'), { online: true }).kind)
      .toBe('permission');
  });

  it('avisa de que es un problema de sesión, no de la red', () => {
    expect(conRed(true).userMessage).not.toMatch(/conexión/i);
    expect(
      classifyNetworkError({ code: 'functions/permission-denied' }, { online: true }).userMessage,
    ).toMatch(/permiso/i);
  });
});

describe('servicio no disponible', () => {
  it('traduce los códigos internos de Firebase a unavailable', () => {
    for (const code of ['functions/internal', 'functions/unavailable', 'functions/resource-exhausted']) {
      expect(classifyNetworkError({ code }, { online: true }).kind).toBe('unavailable');
    }
  });

  it('distingue unavailable de offline', () => {
    const fallo = classifyNetworkError({ code: 'functions/unavailable' }, { online: true });

    expect(fallo.kind).toBe('unavailable');
    expect(fallo.userMessage).toMatch(/servicio no está disponible/i);
  });

  it('reconoce el mensaje de un backend caído', () => {
    expect(classifyNetworkError(new Error('backend down'), { online: true }).kind).toBe('unavailable');
  });
});

describe('error desconocido', () => {
  it('cubre valores que no son errores', () => {
    for (const valor of [undefined, null, {}, 42, 'texto', []]) {
      expect(classifyNetworkError(valor, { online: true }).kind).toBe('unknown');
    }
  });

  it('no inventa un tipo para un error sin pistas', () => {
    const fallo = classifyNetworkError(new Error('algo raro'), { online: true });

    expect(fallo.kind).toBe('unknown');
    expect(fallo.code).toBeUndefined();
  });

  it('ofrece reintento en los cinco casos, porque ninguno es terminal', () => {
    const kinds: NetworkErrorKind[] = ['offline', 'timeout', 'permission', 'unavailable', 'unknown'];

    for (const kind of kinds) {
      expect(networkMessage(kind)).not.toBe('');
      expect(classifyNetworkError(new Error('x'), { online: kind !== 'offline' }).retryable).toBe(true);
    }
  });
});

describe('envoltorios propios', () => {
  it('clasifica la causa original de un PersistenceError', () => {
    const envuelto = new PersistenceError('persistence-error', 'algo falló', {
      cause: Object.assign(new Error('deadline exceeded'), { code: 'functions/deadline-exceeded' }),
    });

    const fallo = classifyNetworkError(envuelto, { online: true });

    expect(fallo.kind).toBe('timeout');
    expect(fallo.code).toBe('functions/deadline-exceeded');
  });

  it('no se pierde en una cadena de envoltorios', () => {
    const envuelto = new PersistenceError('persistence-error', 'x', {
      cause: new PersistenceError('persistence-error', 'y', { cause: { code: 'offline' } }),
    });

    expect(classifyNetworkError(envuelto, { online: true }).kind).toBe('offline');
  });

  it('no entra en bucle con una causa que apunta a sí misma', () => {
    const error = new Error('x');
    Object.defineProperty(error, 'cause', { value: error, configurable: true });

    expect(classifyNetworkError(error, { online: true }).kind).toBe('unknown');
  });

  it('sin causa se clasifica por el propio envoltorio', () => {
    expect(classifyNetworkError(new PersistenceError(), { online: true }).kind).toBe('unknown');
  });
});

describe('mensajes', () => {
  it('cada tipo tiene un mensaje distinto y en español', () => {
    const kinds: NetworkErrorKind[] = ['offline', 'timeout', 'permission', 'unavailable', 'unknown'];
    const mensajes = kinds.map(networkMessage);

    expect(new Set(mensajes).size).toBe(kinds.length);
    for (const mensaje of mensajes) {
      expect(mensaje).toMatch(/[áéíóúñ¿¡]/i);
    }
  });
});
