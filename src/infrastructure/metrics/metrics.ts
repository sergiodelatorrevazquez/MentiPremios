import { logger } from '../logging/logger';

/**
 * Nombres cerrados a proposito: anadir una metrica nueva obliga a decidir aqui
 * su nombre, y en ningun punto del flujo se puede enviar un dato que no sea un
 * contador de este conjunto.
 */
export const METRIC_NAMES = [
  'survey_started',
  'submission_succeeded',
  'submission_failed',
  'invitation_used',
  'multimedia_failed',
] as const;

export type MetricName = typeof METRIC_NAMES[number];

export type MetricsSnapshot = Readonly<Record<MetricName, number>>;

export interface MetricsSink {
  record(name: MetricName, value: number, total: number): void;
}

export interface Metrics {
  increment(name: MetricName, by?: number): void;
  value(name: MetricName): number;
  total(): number;
  snapshot(): MetricsSnapshot;
  reset(): void;
  setSink(sink: MetricsSink | null): void;
}

function emptySnapshot(): Record<MetricName, number> {
  return Object.fromEntries(METRIC_NAMES.map((name) => [name, 0])) as Record<MetricName, number>;
}

export function isMetricName(value: string): value is MetricName {
  return (METRIC_NAMES as readonly string[]).includes(value);
}

export interface MetricsOptions {
  sink?: MetricsSink | null;
}

export function createMetrics(options: MetricsOptions = {}): Metrics {
  const counters = emptySnapshot();
  let sink: MetricsSink | null = options.sink ?? null;

  function increment(name: MetricName, by = 1) {
    if (typeof by !== 'number' || !Number.isFinite(by) || by < 0) {
      logger.warn('métrica ignorada por incremento inválido', { name, by });
      return;
    }

    counters[name] += by;
    sink?.record(name, by, counters[name]);
  }

  return {
    increment,
    value: (name) => counters[name],
    total: () => Object.values(counters).reduce((sum, value) => sum + value, 0),
    snapshot: () => ({ ...counters }),
    reset: () => {
      for (const name of METRIC_NAMES) counters[name] = 0;
    },
    setSink: (next) => {
      sink = next;
    },
  };
}

/**
 * Destino de las metricas. En desarrollo escribe cada incremento con el logger,
 * que ya redacta por si algun nombre futuro resultara sensible. En produccion no
 * hay destino: las metricas se acumulan pero nadie las imprime.
 */
export const metrics: Metrics = createMetrics({
  sink: import.meta.env.DEV
    ? {
      record(name, value, total) {
        logger.debug('métrica', { name, value, total });
      },
    }
    : null,
});
