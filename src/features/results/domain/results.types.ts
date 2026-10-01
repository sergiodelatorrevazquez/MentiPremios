import type { Opcion, Pregunta } from '../../survey/domain/survey.types';

/**
 * Contadores acumulados de la encuesta, tal y como viven en Firestore.
 *
 * Las claves son identificadores de opción y no de pregunta porque en este
 * catálogo cada opción ya viene prefijada por su pregunta (`tonto-1`,
 * `casper-3`...), así que el identificador es único sin necesidad de anidar.
 * Los contadores van planos a propósito: `firestore.rules` puede compararlos
 * uno a uno con los valores anteriores, y una clave plana no se confunde con un
 * camino anidado. El requisito de que ninguna opción lleve un punto en su
 * identificador lo fija el test de dominio.
 */
export type ResumenVotos = Readonly<Record<string, number>>;

/** Contadores de una pregunta, con los votos que no están en el catálogo a cero. */
export type VotosPregunta = Readonly<Record<string, number>>;

export interface ResultadoOpcion {
  opcion: Opcion;
  votos: number;
  /** Porcentaje sobre el total de la pregunta, con un decimal. */
  porcentaje: number;
  /** Empate: las empatadas al primer puesto salen todas premiadas. */
  ganadora: boolean;
}

export interface ResultadoPregunta {
  pregunta: Pregunta;
  /** Personas que han respondido esta pregunta. */
  total: number;
  opciones: ResultadoOpcion[];
  /** Primera opción clasificada, o `null` si nadie votó ninguna opción. */
  ganadora: Opcion | null;
  /** `true` cuando más de una opción comparte el primer puesto. */
  empate: boolean;
}

/** Fotografía completa de la encuesta, lista para pintar la gala. */
export interface ResultadoEncuesta {
  /** Personas que han completado la encuesta entera. */
  total: number;
  resultados: ResultadoPregunta[];
}