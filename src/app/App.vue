<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';
import type {
  CodigoInvitacionIdentificado,
  Multimedia,
  OptionId,
  Pregunta,
} from '../features/survey/domain/survey.types';
import { preguntas as catalogoPreguntas } from '../features/survey/domain/questions';
import { useSurveyWizard } from '../features/survey/application/useSurveyWizard';
import LoginStep from '../features/survey/presentation/LoginStep.vue';
import WelcomeStep from '../features/survey/presentation/WelcomeStep.vue';
import QuestionStep from '../features/survey/presentation/QuestionStep.vue';
import CompletionStep from '../features/survey/presentation/CompletionStep.vue';
import MultimediaViewer from '../features/survey/presentation/MultimediaViewer.vue';
import AvatarPhotoViewer from '../features/survey/presentation/AvatarPhotoViewer.vue';
import { InvitationAlreadyUsedError, InvalidInvitationError } from '../features/survey/application/errors';
import { APP_SERVICES_KEY, type AppServices } from './bootstrap';

function requireAppServices(): AppServices {
  const services = inject(APP_SERVICES_KEY);
  if (!services) throw new Error('App services were not provided during application bootstrap.');
  return services;
}

const appServices = requireAppServices();

const palabraSecreta = ref('');
const codigo = ref<CodigoInvitacionIdentificado | null>(null);
const loginError = ref<string | null>(null);

const preguntas = reactive<Pregunta[]>(catalogoPreguntas);
const {
  pasoActual,
  indicePreguntaActual,
  respuestaSeleccionada,
  respuestas,
  cambiarPaso,
  iniciarEncuesta,
  seleccionarRespuesta,
  registrarRespuestaActual,
  volverPregunta,
} = useSurveyWizard(preguntas);

const enviando = ref(false);
const mensaje = ref<string | null>(null);
const error = ref<string | null>(null);
const visorFotoAbierto = ref(false);

const visorMultimediaAbierto = ref(false);
const multimediaActual = ref<Multimedia | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

function handleQuestionSelect(optionId: OptionId) {
  seleccionarRespuesta(optionId);
}

function handleQuestionLongPressStart(multimedia: Multimedia) {
  handlePressStart(multimedia, new Event('mousedown') as MouseEvent | TouchEvent);
}

function handleQuestionLongPressEnd() {
  handlePressEnd(new Event('mouseup') as MouseEvent | TouchEvent);
}

function iniciarVisor(multimedia: Multimedia) {
  multimediaActual.value = multimedia;
  visorMultimediaAbierto.value = true;
  longPressTriggered = true;
}

function cerrarVisorMultimedia() {
  visorMultimediaAbierto.value = false;
  multimediaActual.value = null;
}

function handlePressStart(multimedia: Multimedia, event: MouseEvent | TouchEvent) {
  longPressTriggered = false;
  pressTimer = setTimeout(() => {
    iniciarVisor(multimedia);
  }, 300);
}

function handlePressEnd(event: MouseEvent | TouchEvent) {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  setTimeout(() => { longPressTriggered = false; }, 10);
}

function handleClick(opcionId: OptionId, event: MouseEvent | TouchEvent) {
  if (longPressTriggered) return;
  seleccionarRespuesta(opcionId);
}

function handleMultimediaKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrarVisorMultimedia();
}

const puedeContinuarLogin = computed(() => palabraSecreta.value.trim().length > 0 && !enviando.value);
const preguntaActual = computed(() => preguntas[indicePreguntaActual.value]);
const puedeContinuarPregunta = computed(
  () => respuestaSeleccionada.value !== null && !enviando.value && !!preguntaActual.value,
);
const puedeVolverAtras = computed(() => indicePreguntaActual.value > 0 && !enviando.value);
const progreso = computed(() => Math.round(((indicePreguntaActual.value + 1) / preguntas.length) * 100));

async function validarPalabraSecreta() {
  if (!puedeContinuarLogin.value) return;
  enviando.value = true;
  mensaje.value = null;
  error.value = null;
  loginError.value = null;

  try {
    const secreta = palabraSecreta.value.trim();
    const encontrado = await appServices.validateInvitation(secreta);
    codigo.value = encontrado;
    cambiarPaso('welcome');
  } catch (e) {
    if (e instanceof InvitationAlreadyUsedError) {
      loginError.value = 'Ya has respondido a la encuesta de MentiPremios con esta palabra secreta. ¡Gracias de nuevo!';
    } else if (e instanceof InvalidInvitationError) {
      loginError.value = 'La palabra secreta es incorrecta. Revisa lo que te ha llegado en la invitación.';
    } else {
      console.error(e);
      error.value = 'Ha ocurrido un error al comprobar la palabra secreta. Inténtalo de nuevo.';
    }
  } finally {
    enviando.value = false;
  }
}

function avanzarDesdeBienvenida() {
  iniciarEncuesta();
}

async function responderYPasarSiguiente() {
  if (enviando.value) return;
  if (!puedeContinuarPregunta.value || !preguntaActual.value || !codigo.value) return;

  const esUltimaPregunta = indicePreguntaActual.value === preguntas.length - 1;
  registrarRespuestaActual();

  if (!esUltimaPregunta) {
    return;
  }

  enviando.value = true;
  mensaje.value = null;
  error.value = null;

  try {
    await appServices.submitSurvey({
      invitationId: codigo.value.id,
      participantName: codigo.value.nombre,
      questions: preguntas,
      answers: { ...respuestas },
    });
    mensaje.value = '¡Respuestas guardadas correctamente en MentiPremios!';
    cambiarPaso('done');
  } catch (e) {
    console.error(e);
    error.value = 'Ha ocurrido un error al guardar tus respuestas. Inténtalo de nuevo.';
  } finally {
    enviando.value = false;
  }
}

function abrirVisorFoto() {
  visorFotoAbierto.value = true;
}

function cerrarVisorFoto() {
  visorFotoAbierto.value = false;
}

function volverAtras() {
  if (!puedeVolverAtras.value) return;
  volverPregunta();
}

function handleModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrarVisorFoto();
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-inner">
        <div class="app-header-left">
          <button
            type="button"
            class="avatar-circle avatar-button"
            aria-label="Ver foto en grande"
            @click="abrirVisorFoto"
          />
          <div class="app-title">
            MentiPremios
          </div>
        </div>
      </div>
    </header>

    <AvatarPhotoViewer
      :model-value="visorFotoAbierto"
      @close="cerrarVisorFoto"
    />

    <MultimediaViewer
      :model-value="visorMultimediaAbierto"
      :media="multimediaActual"
      @close="cerrarVisorMultimedia"
    />

    <main class="app-content">
      <template v-if="pasoActual === 'login'">
        <LoginStep
          :model-value="palabraSecreta"
          :login-error="loginError"
          :is-submitting="enviando"
          @update:model-value="palabraSecreta = $event"
          @submit="validarPalabraSecreta"
        />
      </template>

      <template v-else-if="pasoActual === 'welcome' && codigo">
        <WelcomeStep
          :participant-name="codigo.nombre"
          @continue="avanzarDesdeBienvenida"
        />
      </template>

      <template v-else-if="pasoActual === 'questions' && codigo && preguntaActual">
        <QuestionStep
          :question="preguntaActual"
          :selected-option-id="respuestaSeleccionada"
          :current-question-index="indicePreguntaActual"
          :total-questions="preguntas.length"
          :progress="progreso"
          :can-go-back="puedeVolverAtras"
          :can-continue="puedeContinuarPregunta"
          :is-submitting="enviando"
          @select-option="handleQuestionSelect"
          @long-press-start="handleQuestionLongPressStart"
          @long-press-end="handleQuestionLongPressEnd"
          @go-back="volverAtras"
          @submit="responderYPasarSiguiente"
        />
      </template>

      <template v-else-if="pasoActual === 'done' && codigo">
        <CompletionStep
          :participant-name="codigo.nombre"
          :message="mensaje"
        />
      </template>

      <div
        v-if="error"
        class="status status--error"
      >
        {{ error }}
      </div>
    </main>
  </div>
</template>

<style>
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

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--color-background);
  color: var(--color-text);
}

#app {
  min-height: 100vh;
}

.app-shell {
  width: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 50;
  padding: 14px 18px;
  background: var(--color-primary);
  border-bottom: 2px solid rgba(11, 61, 11, 0.15);
  box-shadow: 0 10px 24px rgba(11, 61, 11, 0.12);
}

.app-header-inner {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-content {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 28px 24px 36px;
}

.avatar-circle {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-full);
  background-size: cover;
  background-position: center;
  background-image: url('../assets/foto-amigos.jpg');
  background-color: rgba(255, 255, 255, 0.55);
  border: 2px solid rgba(11, 61, 11, 0.25);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
}

.avatar-button {
  cursor: pointer;
  padding: 0;
  border: none;
  background: transparent;
}

.avatar-button:hover {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.55), 0 10px 24px rgba(11, 61, 11, 0.18);
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text);
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
  color: var(--color-text);
  font-size: 18px;
  cursor: pointer;
}

.modal-close-btn:hover {
  background: white;
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

.field-textarea--large {
  min-height: 160px;
}

.field-error {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
  font-size: 13px;
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

.status--error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.hero-title {
  margin: 0 0 16px;
  font-size: 40px;
  line-height: 1.2;
  text-align: center;
}

.hero-kicker {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  text-align: center;
}

.section-description {
  margin: 0 0 18px;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  line-height: 1.6;
}

.welcome-panel {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 16px;
  border: 1px solid rgba(11, 61, 11, 0.12);
}

.welcome-panel p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-muted);
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

.options-grid--4 {
  grid-template-columns: repeat(2, 1fr);
}

.options-grid--6 {
  grid-template-columns: repeat(2, 1fr);
}

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

.photo-modal-video {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 36px);
  border-radius: 16px;
  box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
}

@media (max-width: 640px) {
  .app-content {
    padding: 18px 14px 22px;
  }

  .hero-title {
    font-size: 28px;
  }
}
</style>
