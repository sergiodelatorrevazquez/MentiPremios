<script setup lang="ts">
import { ref } from 'vue';
import audioCompi from '../../../assets/compi.ogg';

const props = defineProps<{
  modelValue: string;
  loginError: string | null;
  invitationAlreadyUsed: boolean;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'submit'): void;
}>();

const audioElement = ref<HTMLAudioElement | null>(null);
const mostrarControlesAudio = ref(false);

function onInput(value: string) {
  emit('update:modelValue', value);
}

function onSubmit() {
  emit('submit');
}

async function reproducirAviso() {
  const audio = audioElement.value;
  if (!audio) return;

  audio.currentTime = 0;
  try {
    await audio.play();
  } catch {
    mostrarControlesAudio.value = true;
  }
}
</script>

<template>
  <div>
    <h3 class="hero-kicker">
      Bienvenido a los premios de
    </h3>
    <h1 class="hero-title">
      Sin Mentirosas no hay Traidores
    </h1>
    <p class="section-description">
      El rey del grupo te ha mandado tu palabra secreta por privado, métela aquí para poder acceder al cuestionario,
      y acuérdate de que solo puedes responderlo una vez, así que piensa bien.
    </p>

    <div class="field">
      <label
        class="field-label"
        for="secret-word"
      >Clave</label>
      <input
        id="secret-word"
        :value="props.modelValue"
        class="field-input"
        type="text"
        placeholder="Escribe aquí tu palabra secreta..."
        maxlength="50"
        :aria-invalid="props.loginError || props.invitationAlreadyUsed ? 'true' : 'false'"
        :aria-describedby="props.loginError || props.invitationAlreadyUsed ? 'secret-word-error' : undefined"
        :aria-busy="props.isSubmitting"
        @input="onInput(($event.target as HTMLInputElement).value)"
        @keyup.enter="onSubmit"
      >
      <div
        v-if="props.invitationAlreadyUsed"
        id="secret-word-error"
        class="field-error"
        role="alert"
        aria-live="assertive"
      >
        <button
          type="button"
          class="audio-notice-button"
          @click="reproducirAviso"
        >
          Pincha aquí, compi
        </button>
        <audio
          ref="audioElement"
          :src="audioCompi"
          :controls="mostrarControlesAudio"
          preload="auto"
        />
      </div>
      <div
        v-else-if="props.loginError"
        id="secret-word-error"
        class="field-error"
        role="alert"
        aria-live="assertive"
      >
        {{ props.loginError }}
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">
        Solo podrás usar esta palabra una vez. Después de completar la encuesta, quedará marcada como respondida.
      </div>
      <button
        type="button"
        class="button-primary"
        :aria-busy="props.isSubmitting"
        :disabled="props.modelValue.trim().length === 0 || props.isSubmitting"
        @click="onSubmit"
      >
        {{ props.isSubmitting ? 'Comprobando...' : 'Entrar a mi encuesta' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero-kicker {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  text-align: center;
}

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

.field {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 16px;
  border: 1px solid rgba(11, 61, 11, 0.16);
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.field-input,
.field-textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(11, 61, 11, 0.2);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  resize: vertical;
}

.field-input:focus,
.field-textarea:focus {
  border-color: rgba(11, 61, 11, 0.45);
  box-shadow: 0 0 0 2px rgba(144, 238, 144, 0.65);
}

.field-error {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.audio-notice-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.audio-notice-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
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

.button-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 28px;
  }
}
</style>
