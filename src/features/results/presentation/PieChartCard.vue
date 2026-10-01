<script setup lang="ts">
import type { Chart as InstanciaChart, ChartConfiguration } from 'chart.js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ResultadoPregunta } from '../domain/results.types';
import { chartColors } from './chartPalette';

// El paquete no se importa arriba a propósito. Pesa unos 45 kB comprimidos y
// solo lo necesita quien abre la gala, así que quien está contestando la
// encuesta no lo descarga. El `import()` de abajo lo pide la primera tarjeta que
// se monta; como el módulo se cachea, las nueve siguientes no lo vuelven a
// pedir.

const props = defineProps<{
  resultado: ResultadoPregunta;
}>();

const lienzo = ref<HTMLCanvasElement | null>(null);
let grafico: InstanciaChart<'doughnut'> | null = null;

const votos = computed(() => props.resultado.opciones.map((opcion) => opcion.votos));
const etiquetas = computed(() => props.resultado.opciones.map((opcion) => opcion.opcion.texto));
const colores = computed(() => chartColors(props.resultado.opciones.length));
const multimediaGanadora = computed(() => props.resultado.opciones.flatMap((opcion) => (
  opcion.ganadora && opcion.opcion.multimedia
    ? [{ opcion: opcion.opcion, multimedia: opcion.opcion.multimedia }]
    : []
)));

/** Lectura de la tarta para quien no ve el color. */
const descripcion = computed(() => {
  const { resultado } = props;

  if (resultado.total === 0) return `${resultado.pregunta.titulo}: todavía no hay votos`;

  const partes = resultado.opciones
    .map((opcion) => `${opcion.opcion.texto} ${opcion.porcentaje} por ciento`)
    .join(', ');

  return `${resultado.pregunta.titulo}: ${partes}. ${ganadorEnTexto(resultado)}`;
});

function config(): ChartConfiguration<'doughnut'> {
  return {
    type: 'doughnut',
    data: {
      labels: etiquetas.value,
      datasets: [{
        data: votos.value,
        backgroundColor: colores.value,
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    },
    options: {
      // El arco y los porcentajes los dibuja la lista de al lado, que sí se
      // puede leer, seleccionar y traducir. El tooltip sería lo mismo otra vez
      // y encima tendría que traducirse él solo.
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      maintainAspectRatio: false,
      animation: { duration: 400 },
    },
  };
}

async function pintar() {
  if (!grafico) {
    if (!lienzo.value) return;

    // Solo se registran las piezas que se usan: los controladores de barras,
    // líneas y radar que vienen en el paquete no se dibujan nunca aquí.
    const { Chart, DoughnutController, ArcElement } = await import('chart.js');
    Chart.register(DoughnutController, ArcElement);

    // Mientras se descargaba el paquete la tarjeta puede haberse desmontado, y
    // un canvas que ya no existe no se puede pintar.
    if (!lienzo.value) return;

    grafico = new Chart(lienzo.value, config());
    return;
  }

  const serie = grafico.data.datasets[0];

  grafico.data.labels = etiquetas.value;
  if (serie) {
    serie.data = votos.value;
    serie.backgroundColor = colores.value;
  }

  grafico.update();
}

function ganadorEnTexto(resultado: ResultadoPregunta): string {
  if (!resultado.ganadora) return 'sin ganador todavía';

  const nombre = resultado.ganadora.texto;

  return resultado.empate ? `empate entre ${nombre} y compañía` : `gana ${nombre}`;
}

onMounted(pintar);
onBeforeUnmount(() => {
  grafico?.destroy();
  grafico = null;
});
watch(() => props.resultado, pintar, { deep: true });
</script>

<template>
  <article class="chart-card">
    <h3 class="chart-title">
      {{ props.resultado.pregunta.titulo }}
    </h3>
    <p class="chart-total">
      {{ props.resultado.total }}
      {{ props.resultado.total === 1 ? 'voto' : 'votos' }}
    </p>

    <div class="chart-body">
      <div
        class="chart-canvas"
        role="img"
        :aria-label="descripcion"
      >
        <canvas ref="lienzo" />
      </div>

      <ul class="chart-legend">
        <li
          v-for="(opcion, indice) in props.resultado.opciones"
          :key="opcion.opcion.id"
          class="legend-item"
          :class="{ 'legend-item--winner': opcion.ganadora }"
        >
          <span
            class="legend-swatch"
            :style="{ backgroundColor: colores[indice] }"
            aria-hidden="true"
          />
          <span class="legend-text">
            {{ opcion.opcion.texto }}
          </span>
          <span class="legend-value">
            {{ opcion.porcentaje }}%
          </span>
          <span
            v-if="opcion.ganadora"
            class="legend-badge"
          >
            {{ props.resultado.empate ? 'Empate' : 'Ganador' }}
          </span>
        </li>
      </ul>
    </div>

    <div
      v-if="multimediaGanadora.length > 0"
      class="winner-media-list"
    >
      <figure
        v-for="item in multimediaGanadora"
        :key="item.opcion.id"
        class="winner-media-figure"
      >
        <img
          v-if="item.multimedia.unavailable || item.multimedia.tipo === 'imagen'"
          class="winner-media-image"
          :src="item.multimedia.src"
          :alt="item.multimedia.alt ?? item.opcion.texto"
          decoding="async"
        >
        <video
          v-else
          class="winner-media-video"
          :aria-label="item.multimedia.alt ?? item.opcion.texto"
          controls
          playsinline
          preload="metadata"
          poster="/media-unavailable.svg"
        >
          <source
            v-for="source in item.multimedia.sources"
            :key="source.src"
            :src="source.src"
            :type="source.type"
          >
        </video>
      </figure>
    </div>
  </article>
</template>

<style scoped>
.chart-card {
  background: var(--color-surface);
  border: 1px solid rgba(11, 61, 11, 0.16);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.chart-title {
  margin: 0;
  font-size: var(--font-size-lg);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.chart-total {
  margin: var(--space-1) 0 var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.chart-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.chart-canvas {
  position: relative;
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1 / 1;
}

.chart-legend {
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.legend-item {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.legend-item--winner {
  background: rgba(144, 238, 144, 0.25);
  font-weight: 700;
}

.legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(11, 61, 11, 0.2);
}

.legend-text {
  overflow-wrap: anywhere;
}

.legend-value {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.legend-badge {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text);
  background: var(--color-primary);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
}

.winner-media-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.winner-media-figure {
  min-width: 0;
  margin: 0;
}

.winner-media-image,
.winner-media-video {
  display: block;
  width: 100%;
  max-height: 360px;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.08);
}

@media (max-width: 640px) {
  .chart-body {
    gap: var(--space-3);
  }

  .chart-canvas {
    max-width: 180px;
  }

  .legend-item {
    font-size: var(--font-size-xs);
  }
}
</style>