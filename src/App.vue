<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

const multimediaAssets = import.meta.glob('./assets/{mensaje,foto,video}-*.{jpg,mp4}', { eager: true, query: '?url', import: 'default' });
import {
  guardarRespuestaUsuario,
  marcarCodigoComoUsado,
  obtenerCodigoPorPalabraSecreta,
  type CodigoInvitacion,
} from './services/premiosService';

type Paso = 'login' | 'welcome' | 'questions' | 'done';

interface Multimedia {
  tipo: 'imagen' | 'video';
  src: string;
  alt?: string;
}

interface Opcion {
  id: string;
  texto: string;
  multimedia?: Multimedia;
}

interface Pregunta {
  id: string;
  titulo: string;
  opciones: Opcion[];
}

const pasoActual = ref<Paso>('login');
const palabraSecreta = ref('');
const codigo = ref<(CodigoInvitacion & { id: string }) | null>(null);
const loginError = ref<string | null>(null);

const preguntas = reactive<Pregunta[]>([
  {
    id: 'tonto',
    titulo: 'Tonto del Año',
    opciones: [
      { id: 'tonto-1', texto: 'Miguel' },
      { id: 'tonto-2', texto: 'Pablo' },
      { id: 'tonto-3', texto: 'Dani' },
      { id: 'tonto-4', texto: 'Maroto' },
    ],
  },
  {
    id: 'casper',
    titulo: 'Casper del Año',
    opciones: [
      { id: 'casper-1', texto: 'Raúl' },
      { id: 'casper-2', texto: 'Jorge' },
      { id: 'casper-3', texto: 'Dani' },
      { id: 'casper-4', texto: 'Jose Álvaro' },
      { id: 'casper-5', texto: 'Pablo' },
      { id: 'casper-6', texto: 'Víctor' },
    ],
  },
  {
    id: 'comefeas',
    titulo: 'Comefeas del Año',
    opciones: [
      { id: 'comefeas-1', texto: 'Fran' },
      { id: 'comefeas-2', texto: 'Maroto' },
      { id: 'comefeas-3', texto: 'Dani' },
      { id: 'comefeas-4', texto: 'Enrique' },
    ],
  },
  {
    id: 'soltero',
    titulo: 'Soltero del Año',
    opciones: [
      { id: 'soltero-1', texto: 'Sergio Reyes' },
      { id: 'soltero-2', texto: 'Ale' },
      { id: 'soltero-3', texto: 'Maroto' },
      { id: 'soltero-4', texto: 'Dani' },
    ],
  },
  {
    id: 'anecdota',
    titulo: 'Anécdota del Año',
    opciones: [
      { id: 'anecdota-1', texto: 'La quedada de verano' },
      { id: 'anecdota-2', texto: 'La cena de Navidad' },
      { id: 'anecdota-3', texto: 'El finde en el pueblo' },
      { id: 'anecdota-4', texto: 'El viaje de cumpleaños' },
      { id: 'anecdota-5', texto: 'Las quedadas de平时的' },
      { id: 'anecdota-6', texto: 'Otro momento' },
    ],
  },
  {
    id: 'meme',
    titulo: 'Meme del Año',
    opciones: [
      { id: 'meme-1', texto: 'Cuando apareció el nuevo miembro' },
      { id: 'meme-2', texto: 'La drama de wasap' },
      { id: 'meme-3', texto: 'El cambio de grupo' },
      { id: 'meme-4', texto: 'La nueva normativa' },
      { id: 'meme-5', texto: 'El secreto que se reveló' },
      { id: 'meme-6', texto: 'La sorpresa organizada' },
      { id: 'meme-7', texto: 'El cambio de líder' },
      { id: 'meme-8', texto: 'Otro' },
    ],
  },
  {
    id: 'mensaje',
    titulo: 'Mensaje del Año',
    opciones: [
      { id: 'mensaje-1', texto: '1', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/mensaje-1.jpg'] as string, alt: 'Mensaje 1' } },
      { id: 'mensaje-2', texto: '2', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/mensaje-2.jpg'] as string, alt: 'Mensaje 2' } },
      { id: 'mensaje-3', texto: '3', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/mensaje-3.jpg'] as string, alt: 'Mensaje 3' } },
      { id: 'mensaje-4', texto: '4', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/mensaje-4.jpg'] as string, alt: 'Mensaje 4' } },
    ],
  },
  {
    id: 'foto',
    titulo: 'Foto del Año',
    opciones: [
      { id: 'foto-1', texto: '1', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/foto-1.jpg'] as string, alt: 'Foto 1' } },
      { id: 'foto-2', texto: '2', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/foto-2.jpg'] as string, alt: 'Foto 2' } },
      { id: 'foto-3', texto: '3', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/foto-3.jpg'] as string, alt: 'Foto 3' } },
      { id: 'foto-4', texto: '4', multimedia: { tipo: 'imagen', src: multimediaAssets['./assets/foto-4.jpg'] as string, alt: 'Foto 4' } },
    ],
  },
  {
    id: 'video',
    titulo: 'Video del Año',
    opciones: [
      { id: 'video-1', texto: '1', multimedia: { tipo: 'video', src: multimediaAssets['./assets/video-1.mp4'] as string, alt: 'Video 1' } },
      { id: 'video-2', texto: '2', multimedia: { tipo: 'video', src: multimediaAssets['./assets/video-2.mp4'] as string, alt: 'Video 2' } },
      { id: 'video-3', texto: '3', multimedia: { tipo: 'video', src: multimediaAssets['./assets/video-3.mp4'] as string, alt: 'Video 3' } },
      { id: 'video-4', texto: '4', multimedia: { tipo: 'video', src: multimediaAssets['./assets/video-4.mp4'] as string, alt: 'Video 4' } },
    ],
  },
  {
    id: 'correa',
    titulo: 'Correa del Año',
    opciones: [
      { id: 'correa-1', texto: 'Miguel' },
      { id: 'correa-2', texto: 'Miguel' },
      { id: 'correa-3', texto: 'Miguel' },
      { id: 'correa-4', texto: 'Miguel' },
    ],
  }
]);

const respuestas = reactive<Record<string, string>>({});
const indicePreguntaActual = ref(0);
const respuestaSeleccionada = ref<string | null>(null);
const respuestasAnteriores = ref<Record<string, string>>({});

const enviando = ref(false);
const mensaje = ref<string | null>(null);
const error = ref<string | null>(null);
const visorFotoAbierto = ref(false);

const visorMultimediaAbierto = ref(false);
const multimediaActual = ref<Multimedia | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

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

function handleClick(opcionId: string, event: MouseEvent | TouchEvent) {
  if (longPressTriggered) return;
  respuestaSeleccionada.value = opcionId;
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
    const encontrado = await obtenerCodigoPorPalabraSecreta(secreta);

    if (!encontrado) {
      loginError.value = 'La palabra secreta es incorrecta. Revisa lo que te ha llegado en la invitación.';
      return;
    }

    if (encontrado.usado) {
      loginError.value = 'Ya has respondido a la encuesta de MentiPremios con esta palabra secreta. ¡Gracias de nuevo!';
      return;
    }

    codigo.value = encontrado;
    pasoActual.value = 'welcome';
  } catch (e) {
    console.error(e);
    error.value = 'Ha ocurrido un error al comprobar la palabra secreta. Inténtalo de nuevo.';
  } finally {
    enviando.value = false;
  }
}

function avanzarDesdeBienvenida() {
  indicePreguntaActual.value = 0;
  respuestaSeleccionada.value = null;
  pasoActual.value = 'questions';
}

async function responderYPasarSiguiente() {
  if (!puedeContinuarPregunta.value || !preguntaActual.value || !codigo.value) return;

  const actual = preguntaActual.value;
  respuestas[actual.id] = respuestaSeleccionada.value!;
  respuestaSeleccionada.value = null;

  if (indicePreguntaActual.value < preguntas.length - 1) {
    indicePreguntaActual.value += 1;
    return;
  }

  enviando.value = true;
  mensaje.value = null;
  error.value = null;

  try {
    await guardarRespuestaUsuario({ usuario: codigo.value.nombre, premios: { ...respuestas } });
    await marcarCodigoComoUsado(codigo.value.id);
    mensaje.value = '¡Respuestas guardadas correctamente en MentiPremios!';
    pasoActual.value = 'done';
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
  
  const pregunta = preguntaActual.value;
  if (pregunta) {
    respuestasAnteriores.value[pregunta.id] = respuestaSeleccionada.value || '';
    respuestaSeleccionada.value = respuestasAnteriores.value[preguntas[indicePreguntaActual.value - 1].id] || null;
  }
  indicePreguntaActual.value -= 1;
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

    <div
      v-if="visorFotoAbierto"
      class="photo-modal"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @click="cerrarVisorFoto"
      @keydown="handleModalKeydown"
    >
      <div
        class="photo-modal-inner"
        @click.stop
      >
        <button
          type="button"
          class="modal-close-btn"
          aria-label="Cerrar"
          @click="cerrarVisorFoto"
        >
          ✕
        </button>
        <img
          class="photo-modal-image"
          src="./assets/foto-amigos.jpg"
          alt="Foto de amigos"
        >
      </div>
    </div>

    <div
      v-if="visorMultimediaAbierto && multimediaActual"
      class="photo-modal"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @click="cerrarVisorMultimedia"
      @keydown="handleMultimediaKeydown"
    >
      <div
        class="photo-modal-inner"
        @click.stop
      >
        <button
          type="button"
          class="modal-close-btn"
          aria-label="Cerrar"
          @click="cerrarVisorMultimedia"
        >
          ✕
        </button>
        <img
          v-if="multimediaActual.tipo === 'imagen'"
          class="photo-modal-image"
          :src="multimediaActual.src"
          :alt="multimediaActual.alt"
        >
        <video
          v-else
          class="photo-modal-video"
          :src="multimediaActual.src"
          :alt="multimediaActual.alt"
          controls
          autoplay
          playsinline
        />
      </div>
    </div>

    <main class="app-content">
      <template v-if="pasoActual === 'login'">
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
          <div class="field-label">
            <span>Clave</span>
          </div>
          <input
            v-model="palabraSecreta"
            class="field-input"
            type="text"
            placeholder="Escribe aquí tu palabra secreta..."
            maxlength="50"
            @keyup.enter="validarPalabraSecreta"
          >
          <div
            v-if="loginError"
            class="field-error"
          >
            {{ loginError }}
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">
            Solo podrás usar esta palabra una vez. Después de completar la encuesta, quedará marcada como respondida.
          </div>
          <button
            type="button"
            class="button-primary"
            :disabled="!puedeContinuarLogin"
            @click="validarPalabraSecreta"
          >
            {{ enviando ? 'Comprobando...' : 'Entrar a mi encuesta' }}
          </button>
        </div>
      </template>

      <template v-else-if="pasoActual === 'welcome' && codigo">
        <h1 class="hero-title">
          {{ codigo.nombre }}
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
            @click="avanzarDesdeBienvenida"
          >
            Empezar la encuesta
          </button>
        </div>
      </template>

      <template v-else-if="pasoActual === 'questions' && codigo && preguntaActual">
        <div class="progress-bar">
          <span>Pregunta {{ indicePreguntaActual + 1 }} de {{ preguntas.length }}</span>
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :style="{ width: progreso + '%' }"
            />
          </div>
        </div>

        <h1 class="hero-title">
          {{ preguntaActual.titulo }}
        </h1>

        <div class="options-grid" :class="'options-grid--' + preguntaActual.opciones.length">
          <button
            v-for="opcion in preguntaActual.opciones"
            :key="opcion.id"
            type="button"
            class="option-card"
            :class="{ 'option-card--selected': respuestaSeleccionada === opcion.id, 'option-card--with-media': opcion.multimedia }"
            @click="handleClick(opcion.id, $event)"
            @mousedown="opcion.multimedia && handlePressStart(opcion.multimedia, $event)"
            @mouseup="handlePressEnd($event)"
            @mouseleave="handlePressEnd($event)"
            @touchstart="opcion.multimedia && handlePressStart(opcion.multimedia, $event)"
            @touchend="handlePressEnd($event)"
          >
            <div v-if="opcion.multimedia" class="option-media">
              <img
                v-if="opcion.multimedia.tipo === 'imagen'"
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
              :disabled="!puedeVolverAtras"
              @click="volverAtras"
            >
              ← Atrás
            </button>
            <button
              type="button"
              class="button-primary"
              :disabled="!puedeContinuarPregunta"
              @click="responderYPasarSiguiente"
            >
              {{ indicePreguntaActual + 1 === preguntas.length ? (enviando ? 'Guardando...' : 'Enviar y cerrar') : 'Siguiente pregunta' }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="pasoActual === 'done' && codigo">
        <h1 class="hero-title">
          Gracias por participar, {{ codigo.nombre }}
        </h1>
        <p class="section-description">
          Tus respuestas se han guardado en Firebase y se usarán para montar una gala de premios inolvidable con todo el grupo.
        </p>
        <div class="status status--success">
          {{ mensaje ?? 'Tus respuestas se han guardado correctamente.' }}
        </div>
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
  background-image: url('./assets/foto-amigos.jpg');
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
