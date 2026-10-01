/**
 * Fallos de la feature de resultados.
 *
 * Los envoltorios llevan el fallo original en `cause` porque
 * `classifyNetworkError` lo desenvuelve para leer el código real de Firebase:
 * si el error que ve la persona fuese el envoltorio, un `permission-denied`
 * llegaría al usuario como "algo ha ido mal".
 */
export class PersistenceError extends Error {
  public readonly code: string;

  constructor(
    code: string = 'persistence-error',
    message: string = 'A persistence error occurred.',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PersistenceError';
    this.code = code;
  }
}