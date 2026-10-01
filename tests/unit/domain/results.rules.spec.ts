import { describe, expect, it } from 'vitest';
import { preguntas } from '../../../src/features/survey/domain/questions';
import { QUESTION_IDS, type Opcion, type OptionId, type Pregunta, type QuestionId } from '../../../src/features/survey/domain/survey.types';
import {
  calcularResultadoEncuesta,
  calcularResultadoPregunta,
  calcularResultados,
  contarParticipantes,
  ganadoras,
} from '../../../src/features/results/domain/results.rules';
import type { ResumenVotos } from '../../../src/features/results/domain/results.types';

/** Pregunta de mentira con las opciones que haga falta para cada caso. */
function preguntaFalsa(id: QuestionId, opciones: readonly [OptionId, ...OptionId[]]): Pregunta {
  return {
    id,
    titulo: `Pregunta ${id}`,
    opciones: opciones.map((opcionId) => ({ id: opcionId, texto: `Opción ${opcionId}` })),
  };
}

const pregunta = preguntaFalsa(QUESTION_IDS.tonto, ['tonto-1', 'tonto-2', 'tonto-3']);
const ganadorDe = (resumen: ResumenVotos) => calcularResultadoPregunta(pregunta, resumen).ganadora;

describe('resultados de una pregunta', () => {
  it('reparte los porcentajes sobre el total de esa pregunta', () => {
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 3, 'tonto-2': 1 });

    expect(resultado.total).toBe(4);
    expect(resultado.opciones.map((opcion) => opcion.porcentaje)).toEqual([75, 25, 0]);
  });

  it('redondea a un decimal y no a entero', () => {
    // Un tercio redondeado a entero mentiría sobre el reparto; con un decimal,
    // las tres opciones suman 100 aunque el catálogo varíe.
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 1, 'tonto-2': 1, 'tonto-3': 1 });

    expect(resultado.opciones.map((opcion) => opcion.porcentaje)).toEqual([33.3, 33.3, 33.3]);
  });

  it('premia la opción con más votos', () => {
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-2': 4, 'tonto-1': 1, 'tonto-3': 1 });

    expect(resultado.ganadora?.id).toBe('tonto-2');
    expect(resultado.empate).toBe(false);
    expect(ganadoras(resultado).map((opcion: Opcion) => opcion.id)).toEqual(['tonto-2']);
  });

  it('premia a todas las empatadas, y avisa del empate', () => {
    // Es la diferencia entre "ganó X" y "ganaron X e Y". En una gala de premios
    //-mostrar solo una de las dos sería inventarse un resultado.
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 2, 'tonto-2': 2, 'tonto-3': 1 });

    expect(resultado.empate).toBe(true);
    expect(ganadoras(resultado).map((opcion) => opcion.id)).toEqual(['tonto-1', 'tonto-2']);
  });

  it('no premia a nadie cuando el empate es de las últimas', () => {
    // Empate por el último puesto no es empate: solo hay una ganadora.
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 3, 'tonto-2': 1, 'tonto-3': 1 });

    expect(resultado.empate).toBe(false);
    expect(ganadoras(resultado).map((opcion) => opcion.id)).toEqual(['tonto-1']);
  });

  it('no premia nada y no pinta porcentajes si nadie ha votado', () => {
    const resultado = calcularResultadoPregunta(pregunta, {});

    expect(resultado.total).toBe(0);
    expect(resultado.ganadora).toBeNull();
    expect(resultado.empate).toBe(false);
    expect(resultado.opciones.every((opcion) => opcion.porcentaje === 0)).toBe(true);
    expect(resultado.opciones.some((opcion) => opcion.ganadora)).toBe(false);
  });

  it('cuenta como cero lo que no es un número, en vez de pintar un NaN', () => {
    // Un contador corrupto no puede convertirse en `NaN` en la tarta ni en un
    // `Infinity` al dividir.
    const resultado = calcularResultadoPregunta(pregunta, {
      'tonto-1': Number.NaN,
      'tonto-2': Number.POSITIVE_INFINITY,
      'tonto-3': 2,
    } as unknown as ResumenVotos);

    expect(resultado.total).toBe(2);
    expect(resultado.opciones.map((opcion) => opcion.votos)).toEqual([0, 0, 2]);
    expect(resultado.opciones.map((opcion) => opcion.porcentaje)).toEqual([0, 0, 100]);
    expect(resultado.opciones.every((opcion) => Number.isFinite(opcion.porcentaje))).toBe(true);
  });

  it('ignora contadores negativos y decimales', () => {
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': -5, 'tonto-2': 2.7 } as unknown as ResumenVotos);

    expect(resultado.opciones.map((opcion) => opcion.votos)).toEqual([0, 2, 0]);
    expect(resultado.total).toBe(2);
  });

  it('ignora contadores de opciones que ya no están en el catálogo', () => {
    // Si el catálogo cambia y queda una opción vieja guardada, su voto antiguo no
    // debe inflarse: la gala enseña el catálogo, no el documento.
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 2, 'tonto-99': 100 });

    expect(resultado.total).toBe(2);
    expect(resultado.ganadora?.id).toBe('tonto-1');
  });

  it('no reparte porcentajes al 100 % si el total no cuadra con los votos guardados', () => {
    // El total es la suma de lo que hay, no el número de personas que votó a la
    // pregunta: si el resumen está incompleto, los porcentajes son
    // nevertheless consistentes entre sí.
    const resultado = calcularResultadoPregunta(pregunta, { 'tonto-1': 1, 'tonto-2': 1, 'tonto-3': 1 });

    expect(resultado.total).toBe(3);
    expect(resultado.opciones.reduce((suma, opcion) => suma + opcion.porcentaje, 0)).toBeCloseTo(99.9, 1);
  });
});

describe('resultados de la encuesta entera', () => {
  it('devuelve una entrada por cada pregunta del catálogo, en su orden', () => {
    const resultados = calcularResultados(preguntas, {});

    expect(resultados).toHaveLength(preguntas.length);
    expect(resultados.map((resultado) => resultado.pregunta.id)).toEqual(
      preguntas.map((pregunta) => pregunta.id),
    );
  });

  it('deduce el número de personas de los contadores de una pregunta', () => {
    // No hay un contador global en el documento: sale de los votos reales, así
    // que no puede desincronizarse del número de encuestas guardadas.
    const resumen: ResumenVotos = { 'tonto-1': 5, 'tonto-2': 2 };

    expect(contarParticipantes(preguntas, resumen)).toBe(7);
  });

  it('devuelve cero personas si el catálogo está vacío', () => {
    expect(contarParticipantes([], {})).toBe(0);
  });

  it('suma los porcentajes al total de personas con el que se presenta la gala', () => {
    const primera = preguntas[0];
    const votos: Record<string, number> = {};

    // Tres personas, cada una con una opción distinta de la primera pregunta.
    for (const opcion of primera?.opciones.slice(0, 3) ?? []) {
      votos[opcion.id] = 1;
    }

    const encuesta = calcularResultadoEncuesta(preguntas, votos);
    const primeraResultado = encuesta.resultados[0];

    expect(encuesta.total).toBe(3);
    expect(primeraResultado?.total).toBe(3);
    expect(primeraResultado?.empate).toBe(true);
    expect(ganadoras(primeraResultado!).map((opcion) => opcion.id)).toEqual(
      primera?.opciones.slice(0, 3).map((opcion) => opcion.id),
    );
  });

  it('no deja que la primera pregunta con cero votos ponga la gala a cero', () => {
    // Si la primera pregunta no tiene votos pero la segunda sí, contar
    // participantes por la primera mostraría "0 personas" con tarts llenas.
    const segunda = preguntas[1];
    const resumen: Record<string, number> = {};

    for (const opcion of segunda?.opciones.slice(0, 4) ?? []) {
      resumen[opcion.id] = 2;
    }

    expect(calcularResultadoEncuesta(preguntas, resumen).total).toBe(0);
    expect(calcularResultadoEncuesta(preguntas, resumen).resultados[1]?.total).toBe(8);
  });
});

describe('los identificadores que la gala da por buenos', () => {
  it('ninguna opción lleva un punto en su identificador', () => {
    // Los contadores se guardan planos en Firestore y una clave con punto sería
    // un camino anidado, no un contador. Si esta comprobación falla, el resumen
    // guardado no se puede leer como se lee hoy.
    const offenders = preguntas
      .flatMap((pregunta) => pregunta.opciones)
      .filter((opcion) => opcion.id.includes('.'))
      .map((opcion) => opcion.id);

    expect(offenders).toEqual([]);
  });

  it('los identificadores del catálogo son únicos, que es lo que hace posible el mapa plano', () => {
    const ids = preguntas.flatMap((pregunta) => pregunta.opciones.map((opcion) => opcion.id));

    expect(new Set(ids).size).toBe(ids.length);
  });
});
