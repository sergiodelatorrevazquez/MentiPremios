<script setup lang="ts">
import { computed } from 'vue';
import type { ResultadoEncuesta } from '../domain/results.types';
import PieChartCard from './PieChartCard.vue';

const props = defineProps<{
  resultado: ResultadoEncuesta;
  error: string | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (event: 'reload'): void;
  (event: 'close'): void;
}>();

/** Premios con más de una opción empatada en el primer puesto. */
const empates = computed(() => props.resultado.resultados.filter((item) => item.empate));
</script>

<template>
  <div>
    <h1 class="hero-title">
      Los premios
    </h1>
    <p class="section-description">
      Cada tarta es el reparto de los votos de {{ props.resultado.total }}
      {{ props.resultado.total === 1 ? 'persona' : 'personas' }}. Quien más lleva se lleva el premio.
    </p>

    <div
      v-if="props.error"
      class="status status--error"
      role="alert"
      aria-live="assertive"
    >
      {{ props.error }}
    </div>

    <p
      v-if="empates.length > 0"
      class="status status--success"
      role="status"
    >
      Hay empate en {{ empates.length }}
      {{ empates.length === 1 ? 'premio' : 'premios' }}:
      {{ empates.map((item) => item.pregunta.titulo).join(', ') }}.
    </p>

    <div
      class="charts-grid"
      :aria-busy="props.isLoading"
    >
      <PieChartCard
        v-for="item in props.resultado.resultados"
        :key="item.pregunta.id"
        :resultado="item"
      />
    </div>

    <div class="footer">
      <div class="footer-text">
        Los porcentajes se calculan sobre los votos guardados. Si alguien vota después, recarga para verlos.
      </div>
      <div class="footer-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="props.isLoading"
          @click="emit('reload')"
        >
          Recargar
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="props.isLoading"
          @click="emit('close')"
        >
          Salir de la gala
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-title {
  margin: 0 0 16px;
  font-size: 40px;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
}

.section-description {
  margin: 0 0 18px;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  line-height: 1.6;
}

.status {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.status--error {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
}

.status--success {
  background: rgba(144, 238, 144, 0.2);
  color: var(--color-text);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 24px;
  padding-top: 18px;
  gap: 12px;
  text-align: center;
}

.footer-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.button-primary,
.button-secondary {
  border-radius: var(--radius-full);
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.button-primary {
  background: var(--color-primary);
  color: var(--color-text);
  border: none;
  box-shadow: 0 12px 26px rgba(11, 61, 11, 0.18);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.button-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--color-primary-dark);
}

.button-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.button-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid rgba(11, 61, 11, 0.2);
}

.button-secondary:hover:not(:disabled) {
  background: rgba(144, 238, 144, 0.2);
}

.button-secondary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 28px;
  }

  .footer-actions {
    flex-direction: column;
    width: 100%;
  }

  .footer-actions > button {
    width: 100%;
  }
}
</style>