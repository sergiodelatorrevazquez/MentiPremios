import type { Opcion, OptionId, Pregunta } from '../../survey/domain/survey.types';
import type {
  ResumenVotos,
  ResultadoEncuesta,
  ResultadoOpcion,
  ResultadoPregunta,
} from './results.types';

/**
 * Traduce los contadores guardados por cada voto a porcentajes y ganador de cada
 * premio. Es una función pura a propósito: ni Vue, ni Firestore, ni fechas. La
 * gala depende de que el cálculo sea reproducible y que se pueda comprobar con
 * un test sin levantar nada.
 */
export function calcularResultadoPregunta(
  pregunta: Pregunta,
  resumen: ResumenVotos,
): ResultadoPregunta {
  const votos = pregunta.opciones.map((opcion) => contarVotos(resumen, opcion.id));
  const total = votos.reduce((suma, numero) => suma + numero, 0);

  const { maxVotos, empatadas } = primerPuesto(votos);

  const opciones: ResultadoOpcion[] = pregunta.opciones.map((opcion, indice) => {
    const numero = votos[indice] ?? 0;

    return {
      opcion,
      votos: numero,
      porcentaje: porcentaje(numero, total),
      ganadora: total > 0 && numero === maxVotos,
    };
  });

  const ganadora = opciones.find((opcion) => opcion.ganadora)?.opcion ?? null;

  return {
    pregunta,
    total,
    opciones,
    ganadora,
    empate: empatadas > 1,
  };
}

export function calcularResultados(
  preguntas: readonly Pregunta[],
  resumen: ResumenVotos,
): ResultadoPregunta[] {
  return preguntas.map((pregunta) => calcularResultadoPregunta(pregunta, resumen));
}

/** Fotografía completa, con el total de personas de la encuesta. */
export function calcularResultadoEncuesta(
  preguntas: readonly Pregunta[],
  resumen: ResumenVotos,
): ResultadoEncuesta {
  return {
    total: contarParticipantes(preguntas, resumen),
    resultados: calcularResultados(preguntas, resumen),
  };
}

/**
 * Personas que han completado la encuesta entera.
 *
 * No hay un contador global en el documento de resumen a propósito: se deduce
 * de las respuestas que sí se guardan. Sumar los votos de una pregunta
 * cualquiera da el número de personas, siempre que la encuesta se valide antes
 * de guardarse, que es lo que hace `validateSurveyAnswers`.
 */
export function contarParticipantes(
  preguntas: readonly Pregunta[],
  resumen: ResumenVotos,
): number {
  const [primera] = preguntas;
  if (!primera) return 0;

  return primera.opciones.reduce((suma, opcion) => suma + contarVotos(resumen, opcion.id), 0);
}

/** Un contador que se ha escrito a medias se cuenta como cero, no como `NaN`. */
function contarVotos(resumen: ResumenVotos, opcionId: OptionId): number {
  const votos = resumen[opcionId];

  if (typeof votos !== 'number' || !Number.isFinite(votos) || votos <= 0) return 0;

  return Math.floor(votos);
}

function porcentaje(votos: number, total: number): number {
  if (total <= 0) return 0;

  return Math.round((votos / total) * 1000) / 10;
}

/** Mayor número de votos y cuántas opciones lo comparten. */
function primerPuesto(votos: readonly number[]): { maxVotos: number; empatadas: number } {
  let maxVotos = 0;
  let empatadas = 0;

  for (const numero of votos) {
    if (numero > maxVotos) {
      maxVotos = numero;
      empatadas = 1;
    } else if (numero === maxVotos && maxVotos > 0) {
      empatadas += 1;
    }
  }

  return { maxVotos, empatadas };
}

/** Opciones premiadas de una pregunta, útil para el resumen textual. */
export function ganadoras(resultado: ResultadoPregunta): Opcion[] {
  return resultado.opciones
    .filter((opcion) => opcion.ganadora)
    .map((opcion) => opcion.opcion);
}