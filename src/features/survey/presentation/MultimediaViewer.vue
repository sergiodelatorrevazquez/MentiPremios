<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { Multimedia } from '../domain/survey.types';

const props = defineProps<{
  modelValue: boolean;
  media: Multimedia | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const isOpen = computed(() => props.modelValue && props.media !== null);
const modalElement = ref<HTMLElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

watch(isOpen, (open) => {
  if (open) {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const closeButton = modalElement.value?.querySelector<HTMLElement>('.modal-close-btn');
    (closeButton ?? modalElement.value)?.focus();
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
    previouslyFocusedElement?.focus();
    previouslyFocusedElement = null;
  }
}, { flush: 'post' });

onUnmounted(() => {
  document.body.style.overflow = '';
});

function onClose() {
  emit('close');
}

function onBackdropKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
    return;
  }

  if (e.key !== 'Tab' || !modalElement.value) return;
  const focusable = Array.from(modalElement.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled), video[controls], [href], [tabindex]:not([tabindex="-1"])',
  ));
  if (focusable.length === 0) {
    e.preventDefault();
    modalElement.value.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <div
    v-if="props.modelValue && props.media"
    ref="modalElement"
    class="photo-modal"
    role="dialog"
    aria-modal="true"
    :aria-label="props.media.alt ?? 'Visor multimedia'"
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
        decoding="async"
      >
      <video
        v-else
        class="photo-modal-video"
        :aria-label="props.media.alt"
        controls
        playsinline
        preload="metadata"
      >
        <source
          v-for="source in props.media.sources"
          :key="source.src"
          :src="source.src"
          :type="source.type"
        >
      </video>
    </div>
  </div>
</template>

<style scoped>
.photo-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 18px 18px;
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
  max-height: calc(100vh - 78px);
  max-height: calc(100dvh - 78px);
  border-radius: 16px;
  box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
}

.modal-close-btn {
  position: absolute;
  top: -52px;
  right: 0;
  width: 44px;
  height: 44px;
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

@media (max-width: 640px) {
  .photo-modal {
    padding: 60px 8px 8px;
  }

  .photo-modal-image,
  .photo-modal-video {
    max-height: calc(100vh - 68px);
    max-height: calc(100dvh - 68px);
  }
}
</style>
