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

  if (!esUltimaPregunta) return;

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
          :has-submission-error="!!error"
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
