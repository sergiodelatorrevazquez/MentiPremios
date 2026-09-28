<script setup lang="ts">
import type { Multimedia } from '../domain/survey.types';

const props = defineProps<{
  modelValue: boolean;
  media: Multimedia | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

function onClose() {
  emit('close');
}

function onBackdropKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') onClose();
}
</script>

<template>
  <div
    v-if="props.modelValue && props.media"
    class="photo-modal"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    @click="onClose"
    @keydown="onBackdropKeydown"
  >
    <div
      class="photo-modal-inner"
      @click.stop
    >
      <button
        type="button"
        class="modal-close-btn"
        aria-label="Cerrar"
        @click="onClose"
      >
        ✕
      </button>
      <img
        v-if="props.media.unavailable || props.media.tipo === 'imagen'"
        class="photo-modal-image"
        :src="props.media.src"
        :alt="props.media.alt"
      >
      <video
        v-else
        class="photo-modal-video"
        :src="props.media.src"
        :alt="props.media.alt"
        controls
        autoplay
        playsinline
      />
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

.photo-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.photo-modal-inner {
  position: relative;
  max-width: 960px;
  max-height: 720px;
}

.photo-modal-image,
.photo-modal-video {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 36px);
  border-radius: 16px;
  box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
}

.modal-close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
  font-size: 18px;
  cursor: pointer;
}

.modal-close-btn:hover {
  background: white;
}
</style>
