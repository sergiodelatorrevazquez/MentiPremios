import { describe, expect, it, vi } from 'vitest';
import {
  createMetrics,
  isMetricName,
  METRIC_NAMES,
  type MetricName,
  type MetricsSink,
} from '../../../src/infrastructure/metrics/metrics';

function collectingMetrics() {
  const recorded: { name: MetricName; value: number; total: number }[] = [];
  const sink: MetricsSink = { record: (name, value, total) => recorded.push({ name, value, total }) };

  return { recorded, metrics: createMetrics({ sink }) };
}

describe('catálogo de métricas', () => {
  it('cubre los cinco eventos que hay que medir', () => {
    expect(METRIC_NAMES).toEqual([
      'survey_started',
      'submission_succeeded',
      'submission_failed',
      'invitation_used',
      'multimedia_failed',
    ]);
  });

  it('reconoce los nombres del catálogo y rechaza cualquier otro', () => {
    for (const name of METRIC_NAMES) {
      expect(isMetricName(name)).toBe(true);
    }

    expect(isMetricName('participantName')).toBe(false);
    expect(isMetricName('secret')).toBe(false);
    expect(isMetricName('')).toBe(false);
  });
});

describe('conteo', () => {
  it('empieza en cero en todas las métricas', () => {
    const { metrics } = collectingMetrics();

    expect(metrics.snapshot()).toEqual({
      survey_started: 0,
      submission_succeeded: 0,
      submission_failed: 0,
      invitation_used: 0,
      multimedia_failed: 0,
    });
    expect(metrics.total()).toBe(0);
  });

  it('acumula incrementos y expone el total', () => {
    const { recorded, metrics } = collectingMetrics();

    metrics.increment('survey_started');
    metrics.increment('survey_started');
    metrics.increment('multimedia_failed');

    expect(metrics.value('survey_started')).toBe(2);
    expect(metrics.value('multimedia_failed')).toBe(1);
    expect(metrics.total()).toBe(3);
    expect(recorded).toEqual([
      { name: 'survey_started', value: 1, total: 1 },
      { name: 'survey_started', value: 1, total: 2 },
      { name: 'multimedia_failed', value: 1, total: 1 },
    ]);
  });

  it('acepta incrementos superiores a uno y valores cero', () => {
    const { metrics } = collectingMetrics();

    metrics.increment('submission_succeeded', 5);
    metrics.increment('submission_succeeded', 0);

    expect(metrics.value('submission_succeeded')).toBe(5);
  });

  it('devuelve una copia del resumen para que no se pueda mutar', () => {
    const { metrics } = collectingMetrics();
    const resumen = metrics.snapshot() as Record<MetricName, number>;

    resumen.survey_started = 99;

    expect(metrics.value('survey_started')).toBe(0);
  });

  it('permite reiniciar los contadores', () => {
    const { metrics } = collectingMetrics();
    metrics.increment('submission_failed');
    metrics.increment('invitation_used');

    metrics.reset();

    expect(metrics.total()).toBe(0);
  });
});

describe('incrementos inválidos', () => {
  it('ignora valores negativos, NaN o infinitos sin alterar el contador', () => {
    const { recorded, metrics } = collectingMetrics();

    for (const valor of [-1, Number.NaN, Number.POSITIVE_INFINITY, 'dos' as unknown as number]) {
      metrics.increment('submission_failed', valor);
    }

    expect(metrics.value('submission_failed')).toBe(0);
    expect(recorded).toEqual([]);
  });
});

describe('destino', () => {
  it('acumula sin destino por defecto', () => {
    const metrics = createMetrics();

    expect(() => metrics.increment('survey_started')).not.toThrow();
    expect(metrics.value('survey_started')).toBe(1);
  });

  it('permite cambiar y desactivar el destino', () => {
    const metrics = createMetrics();
    const replacement = vi.fn();

    metrics.setSink({ record: replacement });
    metrics.increment('survey_started');
    expect(replacement).toHaveBeenCalledWith('survey_started', 1, 1);

    metrics.setSink(null);
    metrics.increment('survey_started');
    expect(replacement).toHaveBeenCalledOnce();
    expect(metrics.value('survey_started')).toBe(2);
  });
});

describe('ausencia de datos sensibles', () => {
  it('la API solo admite nombres del catálogo, sin contexto libre', () => {
    const metrics = createMetrics();

    // No existe forma de pasar contexto: solo un nombre del catálogo y una
    // cantidad opcional, así que no hay por dónde colar un dato.
    expect(metrics.increment.length).toBe(1);
  });

  it('ningún nombre del catálogo contiene datos personales', () => {
    for (const name of METRIC_NAMES) {
      expect(name).toMatch(/^[a-z_]+$/);
      expect(name).not.toContain('name');
      expect(name).not.toContain('secret');
      expect(name).not.toContain('token');
    }
  });
});
