import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLogger,
  minimumLevelFor,
  redactContext,
  redactValue,
  type LogEntry,
} from '../../../src/infrastructure/logging/logger';

function collectingLogger(options: Parameters<typeof createLogger>[0] = {}) {
  const entries: LogEntry[] = [];

  return {
    entries,
    logger: createLogger({
      keepEntries: true,
      sink: (entry) => entries.push(entry),
      ...options,
    }),
  };
}

describe('niveles', () => {
  it('emite desde el nivel mínimo configurado', () => {
    const { entries, logger } = collectingLogger({ minimumLevel: 'warn' });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
  });

  it('exige error en producción y permite debug en desarrollo', () => {
    expect(minimumLevelFor(true)).toBe('error');
    expect(minimumLevelFor(false)).toBe('debug');
  });

  it('añade nivel, mensaje, contexto y marca de tiempo', () => {
    const { entries, logger } = collectingLogger({ now: () => 1234 });

    logger.warn('mensaje', { motivo: 'prueba' });

    expect(entries[0]).toEqual({
      level: 'warn',
      message: 'mensaje',
      context: { motivo: 'prueba' },
      timestamp: 1234,
    });
  });
});

describe('palabras secretas', () => {
  let logger: ReturnType<typeof createLogger>;
  let entries: LogEntry[];

  beforeEach(() => {
    const collected = collectingLogger();
    logger = collected.logger;
    entries = collected.entries;
  });

  it('elimina la palabra secreta del mensaje y del contexto', () => {
    logger.registerSecret('seta-2026');
    logger.error('fallo con seta-2026', { detalle: 'reintentar seta-2026' });

    expect(entries[0].message).toBe('fallo con [redactado]');
    expect(entries[0].context).toEqual({ detalle: 'reintentar [redactado]' });
  });

  it('no registra un secreto vacío o en blanco', () => {
    logger.registerSecret('');
    logger.registerSecret('   ');
    logger.error('mensaje', { detalle: 'nada' });

    expect(entries[0].context).toEqual({ detalle: 'nada' });
  });

  it('el secreto registrado sigue spotting tras un error previo', () => {
    logger.registerSecret('abc');
    logger.error('primero');
    logger.error('segundo con abc');

    expect(entries[1].message).toBe('segundo con [redactado]');
  });

  it('olvida los secretos al limpiar el logger', () => {
    logger.registerSecret('abc');
    logger.error('con abc');
    logger.clear();
    logger.error('con abc otra vez');

    expect(entries[1].message).toBe('con abc otra vez');
  });
});

describe('datos personales', () => {
  it('redacta claves sensibles en cualquier formato de caja', () => {
    const context = redactContext(
      { secret: 'a', Secret: 'b', palabra_secreta: 'c', 'participant-name': 'd' },
      { secrets: [] },
    );

    expect(context).toEqual({
      secret: '[redactado]',
      Secret: '[redactado]',
      palabra_secreta: '[redactado]',
      'participant-name': '[redactado]',
    });
  });

  it('redacta claves que terminan en un término sensible', () => {
    const context = redactContext(
      { userSecret: 'a', responseId: 'b', freshAuthToken: 'c' },
      { secrets: [] },
    );

    expect(context).toEqual({
      userSecret: '[redactado]',
      responseId: '[redactado]',
      freshAuthToken: '[redactado]',
    });
  });

  it('redacta las respuestas de la encuesta sin tocar el resto del contexto', () => {
    const context = redactContext(
      { answers: { tonto: 'tonto-1' }, respuestas: { casper: 'casper-1' }, paso: 'questions' },
      { secrets: [] },
    );

    expect(context).toEqual({
      answers: '[redactado]',
      respuestas: '[redactado]',
      paso: 'questions',
    });
  });

  it('redacta también en objetos anidados', () => {
    const context = redactContext(
      { error: { data: { nombre: 'Sergio', codigo: 'abc' }, paso: 'done' } },
      { secrets: [] },
    );

    expect(context).toEqual({
      error: { data: { nombre: '[redactado]', codigo: '[redactado]' }, paso: 'done' },
    });
  });
});

describe('redacción de valores', () => {
  it('convierte un Error en nombre y mensaje', () => {
    expect(redactValue(new TypeError('falló'), { secrets: [] }))
      .toEqual({ name: 'TypeError', message: 'falló' });
  });

  it('redacta el mensaje de un Error que contiene el secreto', () => {
    const error = new Error('falló con seta-2026');

    expect(redactValue(error, { secrets: ['seta-2026'] }))
      .toEqual({ name: 'Error', message: 'falló con [redactado]' });
  });

  it('no hereda properties ni pila del Error', () => {
    const contexto = redactContext(
      { error: Object.assign(new Error('x'), { stack: 'STACK', codigoSecreto: 'y' }) },
      { secrets: [] },
    ) as { error: Record<string, unknown> };

    expect(contexto.error).toEqual({ name: 'Error', message: 'x' });
  });

  it('recorta cadenas muy largas indicando lo que sobra', () => {
    const largo = 'a'.repeat(250);
    const valor = redactValue(largo, { secrets: [] }) as string;

    expect(valor).toHaveLength(206);
    expect(valor).toContain('…(+50)');
  });

  it('limita la profundidad de la recursión', () => {
    const valor = redactValue({ a: { b: { c: { d: { e: { f: 'hoja' } } } } } }, { secrets: [] });

    expect(JSON.stringify(valor)).toContain('[profundo]');
  });

  it('limita el número de elementos de un array', () => {
    const valor = redactValue(Array.from({ length: 25 }, (_, i) => i), { secrets: [] });

    expect(valor).toHaveLength(21);
    expect((valor as unknown[])[20]).toBe('…(+5)');
  });

  it('describe los valores no serializables en lugar de fallar', () => {
    expect(redactValue(() => undefined, { secrets: [] })).toBe('[function]');
    expect(redactValue(Symbol('x'), { secrets: [] })).toBe('Symbol(x)');
    expect(redactValue(10n, { secrets: [] })).toBe('10');
    expect(redactValue(null, { secrets: [] })).toBeNull();
    expect(redactValue(undefined, { secrets: [] })).toBeUndefined();
  });
});

describe('desactivar la salida', () => {
  it('permite silenciar el logger sustituyendo el destino', () => {
    const sink = vi.fn();
    const logger = createLogger({ keepEntries: true, sink });

    logger.setSink(null);
    logger.error('no debe salir');

    expect(sink).not.toHaveBeenCalled();
  });

  it('acepta un destino nuevo', () => {
    const logger = createLogger({ sink: () => {} });
    const replacement = vi.fn();

    logger.setSink((entry) => replacement(entry));
    logger.error('mensaje');

    expect(replacement).toHaveBeenCalledOnce();
  });
});
