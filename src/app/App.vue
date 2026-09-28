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
import { InvitationAlreadyUsedError, InvalidInvitationError, SubmissionAlreadyCompletedError } from '../features/survey/application/errors';
import { classifyNetworkError } from '../features/survey/application/networkError';
import { logger } from '../infrastructure/logging/logger';
import { metrics } from '../infrastructure/metrics/metrics';
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
  // Una pulsación larga abre el visor y, al soltar, el navegador emite también
  // un click. Sin esta guarda la opción quedaría seleccionada sin querer.
  if (longPressTriggered) return;
  seleccionarRespuesta(optionId);
}

function handleQuestionLongPressStart(multimedia: Multimedia) {
  handlePressStart(multimedia);
}

function handleQuestionLongPressEnd() {
  handlePressEnd();
}

function iniciarVisor(multimedia: Multimedia) {
  // El asset puede no existir en el despliegue: se cuenta el intento para que
  // el dato llegue a tiempo, sin exponer la ruta del archivo en la métrica.
  if (multimedia.unavailable) metrics.increment('multimedia_failed');
  multimediaActual.value = multimedia;
  visorMultimediaAbierto.value = true;
  longPressTriggered = true;
}

function cerrarVisorMultimedia() {
  visorMultimediaAbierto.value = false;
  multimediaActual.value = null;
}

function handlePressStart(multimedia: Multimedia) {
  longPressTriggered = false;
  pressTimer = setTimeout(() => {
    iniciarVisor(multimedia);
  }, 300);
}

function handlePressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  setTimeout(() => { longPressTriggered = false; }, 10);
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
    // La palabra secreta es el dato más sensible del flujo: se registra como
    // secreto antes de usarla, para que el logger la elimine de cualquier
    // mensaje o contexto que se emita después.
    logger.registerSecret(secreta);
    const encontrado = await appServices.validateInvitation(secreta);
    codigo.value = encontrado;
    cambiarPaso('welcome');
  } catch (e) {
    if (e instanceof InvitationAlreadyUsedError) {
      loginError.value = 'Ya has respondido a la encuesta de MentiPremios con esta palabra secreta. ¡Gracias de nuevo!';
    } else if (e instanceof InvalidInvitationError) {
      loginError.value = 'La palabra secreta es incorrecta. Revisa lo que te ha llegado en la invitación.';
    } else {
      const fallo = classifyNetworkError(e);
      logger.error('fallo al validar la invitación', { error: e, kind: fallo.kind });
      error.value = fallo.userMessage;
    }
  } finally {
    enviando.value = false;
  }
}

function avanzarDesdeBienvenida() {
  iniciarEncuesta();
  metrics.increment('survey_started');
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
    metrics.increment('submission_succeeded');
    // El servidor marca la invitación como usada dentro de la misma transacción
    // que escribe la respuesta, así que un envío correcto la consumió.
    metrics.increment('invitation_used');
    cambiarPaso('done');
  } catch (e) {
    // Si el servidor dice que la invitación ya se usó, es que un intento
    // anterior sí llegó a guardarse: la respuesta está a salvo aunque la
    // respuesta HTTP se perdiera por el camino. Se trata como acierto para no
    // pedir a la persona que escriba otra vez lo que ya está en Firestore.
    if (e instanceof InvitationAlreadyUsedError || e instanceof SubmissionAlreadyCompletedError) {
      logger.warn('el envío llegó tarde: la invitación ya estaba usada', { kind: 'already-used' });
      mensaje.value = 'Tus respuestas ya estaban guardadas de un intento anterior. ¡Gracias!';
      metrics.increment('submission_succeeded');
      metrics.increment('invitation_used');
      cambiarPaso('done');
      return;
    }
    // Solo el mensaje del error: el contexto lleva el error completo y el
    // logger se encarga de quitar palabra secreta, nombre y respuestas.
    const fallo = classifyNetworkError(e);
    logger.error('fallo al enviar la encuesta', { error: e, kind: fallo.kind });
    metrics.increment('submission_failed');
    error.value = fallo.userMessage;
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
        role="alert"
        aria-live="assertive"
      >
        {{ error }}
      </div>
    </main>
  </div>
</template>
