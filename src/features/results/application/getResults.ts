import type { Pregunta } from '../../survey/domain/survey.types';
import { calcularResultadoEncuesta } from '../domain/results.rules';
import type { ResumenVotos, ResultadoEncuesta } from '../domain/results.types';
import { PersistenceError } from './errors';

/**
 * Lo que la capa de aplicación necesita saber del almacén para montar la gala.
 * Solo lectura: los contadores los escribe el mismo repositorio que guarda el
 * voto, dentro de la misma transacción.
 */
export interface ResultsStore {
  /** `true` si la invitación es de organización y ya se ha usado para votar. */
  canAccessResults(id: string): Promise<boolean>;
  /** Contadores acumulados, o `null` si todavía no ha votado nadie. */
  findSummary(): Promise<ResumenVotos | null>;
}

export interface GetResultsInput {
  secret: string;
  questions: readonly Pregunta[];
}

/**
 * Devuelve la fotografía de la encuesta si la palabra secreto es la de quien
 * organiza los premios, y `null` en cualquier otro caso.
 *
 * `null` no es un fallo: es lo que hace que una invitación normal siga su
 * camino de siempre hacia el cuestionario. Así el login hace una pregunta
 * adicional a la base de datos en vez de una ruta especial para el organizador.
 *
 * La palabra se normaliza igual que en el login —minúsculas y sin espacios—:
 * `firestore.rules` protege por identificador de documento, y el documento de
 * un código en mayúsculas no existe.
 */
export async function getResults(
  input: GetResultsInput,
  store: ResultsStore,
): Promise<ResultadoEncuesta | null> {
  const codigo = input.secret.trim().toLowerCase();

  if (!codigo) return null;

  let resumen: ResumenVotos | null;

  try {
    if (!(await store.canAccessResults(codigo))) return null;

    resumen = await store.findSummary();
  } catch (error) {
    throw new PersistenceError('results-unreadable', 'results-unreadable', { cause: error });
  }

  if (!resumen || contarContadores(resumen) === 0) return null;

  return calcularResultadoEncuesta(input.questions, resumen);
}

/** Cuánta gente ha completado la encuesta, según los contadores guardados. */
function contarContadores(resumen: ResumenVotos): number {
  return Object.values(resumen).reduce(
    (suma, votos) => suma + (typeof votos === 'number' && Number.isFinite(votos) && votos > 0 ? votos : 0),
    0,
  );
}