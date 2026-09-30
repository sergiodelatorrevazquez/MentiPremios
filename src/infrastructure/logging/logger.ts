export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: number;
}

export type LogSink = (entry: LogEntry) => void;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Claves cuyo valor nunca debe llegar a un log, ni en desarrollo.
 * Coinciden por nombre exacto o por sufijo, en snake_case o camelCase.
 */
const REDACTED_KEYS = new Set([
  'secret',
  'password',
  'passwd',
  'token',
  'authtoken',
  'appchecktoken',
  'idtoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'uid',
  'user',
  'userid',
  'participantname',
  'nombre',
  'usuario',
  'displayname',
  'email',
  'answers',
  'respuestas',
  'palabrasclave',
  'premiorespuesta',
  'codigo',
  'codes',
  'invitacion',
  'secretword',
  'palabrasecreta',
  'invitationid',
  'responseid',
]);

const REDACTED = '[redactado]';
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 200;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

function isRedactedKey(key: string): boolean {
  const normalized = normalizeKey(key);

  return REDACTED_KEYS.has(normalized)
    || [...REDACTED_KEYS].some((sensitive) => normalized.endsWith(sensitive) && normalized !== sensitive);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…(+${value.length - MAX_STRING_LENGTH})`
    : value;
}

export interface RedactionOptions {
  secrets: readonly string[];
}

export function redactValue(
  value: unknown,
  options: RedactionOptions,
  depth = 0,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return options.secrets.reduce(
      (text, secret) => (secret ? text.split(secret).join(REDACTED) : text),
      truncate(value),
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'bigint') return value.toString();

  if (typeof value === 'function') return '[function]';

  if (typeof value === 'symbol') return value.toString();

  if (value instanceof Error) {
    return {
      name: value.name,
      message: options.secrets.reduce(
        (text, secret) => (secret ? text.split(secret).join(REDACTED) : text),
        truncate(value.message),
      ),
    };
  }

  if (depth >= MAX_DEPTH) return '[profundo]';

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => redactValue(item, options, depth + 1));

    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `…(+${value.length - MAX_ARRAY_ITEMS})`]
      : items;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isRedactedKey(key) ? REDACTED : redactValue(item, options, depth + 1),
      ]),
    );
  }

  return `[${typeof value}]`;
}

export function redactContext(
  context: Record<string, unknown>,
  options: RedactionOptions,
): Record<string, unknown> {
  return redactValue(context, options, 0) as Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  /**
   * Registra un valor que no debe aparecer en ningún log, ni por clave ni
   * por contenido. Úsese en cuanto se conozca, no al terminar la petición.
   */
  registerSecret(value: string): void;
  setSink(sink: LogSink | null): void;
  entries(): readonly LogEntry[];
  clear(): void;
}

export interface LoggerOptions {
  /** Nivel mínimo que se emite. Por defecto solo `error` en producción. */
  minimumLevel?: LogLevel;
  /** Conserva las entradas en memoria para poder inspeccionarlas en tests. */
  keepEntries?: boolean;
  sink?: LogSink;
  now?: () => number;
}

export function minimumLevelFor(isProduction: boolean): LogLevel {
  return isProduction ? 'error' : 'debug';
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    minimumLevel = 'debug',
    keepEntries = false,
    now = () => Date.now(),
  } = options;

  let sink: LogSink | null = options.sink ?? defaultSink;
  const secrets = new Set<string>();
  const recorded: LogEntry[] = [];

  function emit(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) return;

    const secretList = [...secrets].filter((secret) => secret.length > 0);
    const entry: LogEntry = {
      level,
      message: secretList.reduce(
        (text, secret) => text.split(secret).join(REDACTED),
        message,
      ),
      context: redactContext(context, { secrets: secretList }),
      timestamp: now(),
    };

    if (keepEntries) recorded.push(entry);
    sink?.(entry);
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    registerSecret(value) {
      if (typeof value === 'string' && value.trim().length > 0) secrets.add(value);
    },
    setSink(next) {
      sink = next;
    },
    entries: () => recorded,
    clear: () => {
      recorded.length = 0;
      secrets.clear();
    },
  };
}

function defaultSink(entry: LogEntry): void {
  if (entry.level === 'error') {
    console.error(`[${entry.level}] ${entry.message}`, entry.context);
    return;
  }
  if (entry.level === 'warn') {
    console.warn(`[${entry.level}] ${entry.message}`, entry.context);
    return;
  }
  console.info(`[${entry.level}] ${entry.message}`, entry.context);
}

/**
 * Logger de la aplicación. En producción solo emite `error`, con lo que los
 * detalles técnicos quedan fuera del navegador del usuario.
 */
export const logger: Logger = createLogger({
  minimumLevel: minimumLevelFor(import.meta.env.PROD),
  keepEntries: import.meta.env.DEV,
});
