/**
 * Clasificación de fallos de red y de servicio. Vive en `application` porque
 * es lógica de negocio: decide qué puede volver a intentarse y qué mensaje ve
 * la persona usuaria. No depende de Vue ni de Firebase.
 */

export type NetworkErrorKind =
  | 'offline'
  | 'timeout'
  | 'permission'
  | 'unavailable'
  | 'unknown';

export interface NetworkFailure {
  kind: NetworkErrorKind;
  /** Si tiene sentido ofrecer el botón de reintentar. */
  retryable: boolean;
  /** Mensaje para la persona usuaria, ya redactado. */
  userMessage: string;
  /** Código original, si lo había, para el log. */
  code?: string;
}

interface ClassificationContext {
  /** Por defecto `navigator.onLine` cuando existe. */
  online?: boolean;
}

const MESSAGES: Record<NetworkErrorKind, string> = {
  offline: 'No tenemos conexión a internet. Revisa tu red y vuelve a intentarlo.',
  timeout: 'El servidor ha tardado demasiado en responder. Inténtalo de nuevo en un momento.',
  permission: 'No tenemos permiso para completar esta operación. Comprueba tu sesión e inténtalo de nuevo.',
  unavailable: 'El servicio no está disponible ahora mismo. Inténtalo de nuevo en un momento.',
  unknown: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
};

const RETRYABLE: Record<NetworkErrorKind, boolean> = {
  offline: true,
  timeout: true,
  permission: true,
  unavailable: true,
  unknown: true,
};

const OFFLINE_CODES = new Set([
  'offline',
  'network-request-failed',
  'err_internet_disconnected',
  'err_network_changed',
]);

const TIMEOUT_CODES = new Set([
  'deadline-exceeded',
  'timeout',
  'etimedout',
  'timeoutexceeded',
]);

const PERMISSION_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'unauthorized',
  'forbidden',
  'failed-precondition',
]);

const UNAVAILABLE_CODES = new Set([
  'internal',
  'unavailable',
  'service-unavailable',
  'resource-exhausted',
  'aborted',
]);

const OFFLINE_MESSAGES = [
  'failed to fetch',
  'networkerror',
  'network error',
  'load failed',
  'the internet connection appears to be offline',
  'err_internet_disconnected',
];

const TIMEOUT_MESSAGES = ['timeout', 'timed out', 'deadline exceeded'];

const PERMISSION_MESSAGES = [
  'permission denied',
  'permission-denied',
  'missing or insufficient permissions',
  'unauthenticated',
];

const UNAVAILABLE_MESSAGES = [
  'service unavailable',
  'backend down',
  'internal error',
  'service is not available',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/^functions\//, '').replace(/^functions-v2\//, '');
}

function readCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code: unknown }).code;

  return typeof code === 'string' ? code : typeof code === 'number' ? String(code) : '';
}

function readName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return '';
  const name = (error as { name: unknown }).name;

  return typeof name === 'string' ? name : '';
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const message = (error as { message: unknown }).message;

  return typeof message === 'string' ? message : '';
}

function unwrap(error: unknown): unknown {
  // Los envoltorios propios guardan el fallo original en `cause`; clasificar
  // el envoltorio perdería el código real de Firebase.
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = (error as { cause: unknown }).cause;

    if (cause && cause !== error) return unwrap(cause);
  }

  return error;
}

function isOfflineContext(context: ClassificationContext): boolean {
  if (context.online !== undefined) return !context.online;
  if (typeof navigator === 'undefined') return false;

  return navigator.onLine === false;
}

export function classifyNetworkError(
  error: unknown,
  context: ClassificationContext = {},
): NetworkFailure {
  const target = unwrap(error);
  const code = normalize(readCode(target));
  const name = normalize(readName(target));
  const message = normalize(readMessage(target));
  const rawCode = readCode(target);

  function failure(kind: NetworkErrorKind): NetworkFailure {
    return {
      kind,
      retryable: RETRYABLE[kind],
      userMessage: MESSAGES[kind],
      ...(rawCode ? { code: rawCode } : {}),
    };
  }

  // Sin conexión gana siempre: si el navegador lo sabe, no hay nada que probar.
  if (isOfflineContext(context)) return failure('offline');

  if (TIMEOUT_CODES.has(code) || TIMEOUT_CODES.has(name)) return failure('timeout');
  if (TIMEOUT_MESSAGES.some((text) => message.includes(text))) return failure('timeout');

  if (PERMISSION_CODES.has(code) || PERMISSION_CODES.has(name)) return failure('permission');
  if (PERMISSION_MESSAGES.some((text) => message.includes(text))) return failure('permission');

  if (code === 'err_internet_disconnected'
    || OFFLINE_CODES.has(code)
    || OFFLINE_MESSAGES.some((text) => message.includes(text))) {
    return failure('offline');
  }

  if (UNAVAILABLE_CODES.has(code) || UNAVAILABLE_MESSAGES.some((text) => message.includes(text))) {
    return failure('unavailable');
  }

  return failure('unknown');
}

export function networkMessage(kind: NetworkErrorKind): string {
  return MESSAGES[kind];
}
