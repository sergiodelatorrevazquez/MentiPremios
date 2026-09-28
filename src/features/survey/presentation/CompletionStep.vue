<script setup lang="ts">
const props = defineProps<{
  participantName: string;
  message: string | null;
}>();
</script>

<template>
  <div>
    <h1 class="hero-title">
      Gracias por participar, {{ props.participantName }}
    </h1>
    <p class="section-description">
      Tus respuestas se han guardado en Firebase y se usarán para montar una gala de premios inolvidable con todo el grupo.
    </p>
    <div class="status status--success">
      {{ props.message ?? 'Tus respuestas se han guardado correctamente.' }}
    </div>
  </div>
</template>

<style scoped>
.hero-title {
  margin: 0 0 16px;
  font-size: 40px;
  line-height: 1.2;
  text-align: center;
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
  text-align: center;
}

.status--success {
  background: rgba(144, 238, 144, 0.2);
  color: var(--color-text);
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 28px;
  }
}
</style>
