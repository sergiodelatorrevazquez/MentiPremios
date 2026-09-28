<script setup lang="ts">
import type { Multimedia, OptionId, Pregunta } from '../domain/survey.types';

const props = defineProps<{
  question: Pregunta;
  selectedOptionId: OptionId | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
  canGoBack: boolean;
  canContinue: boolean;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: 'select-option', optionId: OptionId): void;
  (event: 'long-press-start', multimedia: Multimedia): void;
  (event: 'long-press-end'): void;
  (event: 'go-back'): void;
  (event: 'submit'): void;
}>();

function onOptionClick(optionId: OptionId) {
  emit('select-option', optionId);
}

function onPressStart(multimedia: Multimedia) {
  emit('long-press-start', multimedia);
}

function onPressEnd() {
  emit('long-press-end');
}

function onSubmit() {
  emit('submit');
}

function onGoBack() {
  emit('go-back');
}
</script>

<template>
  <div>
    <div class="progress-bar">
      <span>Pregunta {{ props.currentQuestionIndex + 1 }} de {{ props.totalQuestions }}</span>
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :style="{ width: props.progress + '%' }"
        />
      </div>
    </div>

    <h1 class="hero-title">
      {{ props.question.titulo }}
    </h1>

    <div class="options-grid" :class="'options-grid--' + props.question.opciones.length">
      <button
        v-for="opcion in props.question.opciones"
        :key="opcion.id"
        type="button"
        class="option-card"
        :class="{ 'option-card--selected': props.selectedOptionId === opcion.id, 'option-card--with-media': opcion.multimedia }"
        @click="onOptionClick(opcion.id)"
        @mousedown="opcion.multimedia && onPressStart(opcion.multimedia)"
        @mouseup="onPressEnd()"
        @mouseleave="onPressEnd()"
        @touchstart="opcion.multimedia && onPressStart(opcion.multimedia)"
        @touchend="onPressEnd()"
      >
        <div v-if="opcion.multimedia" class="option-media">
          <img
            v-if="opcion.multimedia.unavailable"
            class="option-media-thumbnail"
            :src="opcion.multimedia.src"
            :alt="opcion.multimedia.alt"
          >
          <img
            v-else-if="opcion.multimedia.tipo === 'imagen'"
            class="option-media-thumbnail"
            :src="opcion.multimedia.src"
            :alt="opcion.multimedia.alt"
          >
          <video
            v-else
            class="option-media-thumbnail"
            :src="opcion.multimedia.src"
            :alt="opcion.multimedia.alt"
            muted
            preload="metadata"
          />
        </div>
        <span class="option-text">{{ opcion.texto }}</span>
      </button>
    </div>

    <div class="footer">
      <div class="footer-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="!props.canGoBack"
          @click="onGoBack"
        >
          ← Atrás
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="!props.canContinue"
          @click="onSubmit"
        >
          {{ props.currentQuestionIndex + 1 === props.totalQuestions ? (props.isSubmitting ? 'Guardando...' : 'Enviar y cerrar') : 'Siguiente pregunta' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root {
  --color-primary: #90ee90;
  --color-primary-dark: #5fe55f;
  --color-primary-darker: #4bdc4b;
  --color-text: #0b3d0b;
  --color-text-muted: rgba(11, 61, 11, 0.8);
  --color-background: #f6fff6;
  --color-surface: #ffffff;
  --color-error-bg: #fee2e2;
  --color-error-border: #fecaca;
  --color-error: #b91c1c;
  --radius-full: 999px;
}

.hero-title {
  margin: 0 0 16px;
  font-size: 40px;
  line-height: 1.2;
  text-align: center;
}

.progress-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.progress-bar-track {
  width: 120px;
  height: 6px;
  background: rgba(11, 61, 11, 0.15);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.options-grid {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.options-grid--4,
.options-grid--6,
.options-grid--8 {
  grid-template-columns: repeat(2, 1fr);
}

.option-card {
  background: var(--color-surface);
  border: 2px solid rgba(11, 61, 11, 0.2);
  border-radius: 14px;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.option-card:hover {
  border-color: rgba(11, 61, 11, 0.45);
  background: rgba(144, 238, 144, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(11, 61, 11, 0.12);
}

.option-card--selected {
  background: var(--color-primary);
  border-color: var(--color-primary-dark);
  font-weight: 600;
  box-shadow: 0 6px 20px rgba(144, 238, 144, 0.35);
}

.option-card--selected:hover {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
}

.option-card--with-media {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-media {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(11, 61, 11, 0.08);
}

.option-media-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.option-text {
  display: block;
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

.footer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.button-primary {
  background: var(--color-primary);
  color: var(--color-text);
  border: none;
  border-radius: var(--radius-full);
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(11, 61, 11, 0.18);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.button-primary:hover {
  transform: translateY(-1px);
  background: var(--color-primary-dark);
  box-shadow: 0 18px 36px rgba(11, 61, 11, 0.22);
}

.button-primary:active {
  transform: translateY(0);
  background: var(--color-primary-darker);
}

.button-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

.button-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid rgba(11, 61, 11, 0.25);
  border-radius: var(--radius-full);
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.08s ease, background 0.08s ease;
}

.button-secondary:hover:not(:disabled) {
  background: rgba(11, 61, 11, 0.06);
  transform: translateY(-1px);
}

.button-secondary:active:not(:disabled) {
  transform: translateY(0);
}

.button-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 28px;
  }
}
</style>
