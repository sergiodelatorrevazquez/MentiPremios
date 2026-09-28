<script setup lang="ts">
const props = defineProps<{
  participantName: string;
}>();

const emit = defineEmits<{
  (event: 'continue'): void;
}>();

function onContinue() {
  emit('continue');
}
</script>

<template>
  <div>
    <h1 class="hero-title">
      {{ props.participantName }}
    </h1>
    <p class="section-description">
      Cuando pulses el botón ya empezarán a salir las preguntas una a una, y por si no te acuerdas, tienes que votar a Miguel como correa obligatoriamente.
    </p>

    <div class="footer">
      <div class="footer-text">
        Cuando pulses en continuar empezarán a mostrarse las preguntas, una detrás de otra.
      </div>
      <button
        type="button"
        class="button-primary"
        @click="onContinue"
      >
        Empezar la encuesta
      </button>
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

@media (max-width: 640px) {
  .hero-title {
    font-size: 28px;
  }
}
</style>
