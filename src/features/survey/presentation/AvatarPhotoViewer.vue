<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
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
    v-if="props.modelValue"
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
        class="photo-modal-image"
        src="../../../assets/foto-amigos.jpg"
        alt="Foto de amigos"
      >
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
  padding: 18px;
}

.photo-modal-inner {
  position: relative;
  max-width: 960px;
  max-height: 720px;
}

.photo-modal-image {
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
  color: #0b3d0b;
  font-size: 18px;
  cursor: pointer;
}

.modal-close-btn:hover {
  background: white;
}
</style>
