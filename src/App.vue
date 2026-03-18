<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  guardarRespuestaUsuario,
  marcarCodigoComoUsado,
  obtenerCodigoPorPalabraSecreta,
  type PremioRespuesta,
  type CodigoInvitacion,
} from './services/premiosService';

type Paso = 'login' | 'welcome' | 'questions' | 'done';

const pasoActual = ref<Paso>('login');
const palabraSecreta = ref('');
const codigo = ref<(CodigoInvitacion & { id: string }) | null>(null);

const preguntas = reactive<
  {
    id: string;
    titulo: string;
    textoAyuda?: string;
  }[]
>([
  {
    id: 'mvp',
    titulo: '¿Quién ha sido el MVP del grupo este año y por qué?',
  },
  {
    id: 'mejor-meme',
    titulo: '¿Cuál ha sido el mejor meme interno del grupo?',
  },
  {
    id: 'puntual',
    titulo: '¿Quién es la persona más puntual del grupo?',
  },
  {
    id: 'tarde',
    titulo: '¿Quién siempre llega tarde pero le queremos igual?',
  },
  {
    id: 'anecdota',
    titulo: 'Cuéntanos una anécdota épica que no pueda faltar en la gala.',
  },
  {
    id: 'plot-twist',
    titulo: '¿Cuál ha sido el plot twist del año en el grupo?',
  },
]);

const respuestas = reactive<Record<string, string>>({});
const indicePreguntaActual = ref(0);
const respuestaActual = ref('');

const enviando = ref(false);
const mensaje = ref<string | null>(null);
const error = ref<string | null>(null);

const visorFotoAbierto = ref(false);

const puedeContinuarLogin = computed(() => palabraSecreta.value.trim().length > 0 && !enviando.value);
const preguntaActual = computed(() => preguntas[indicePreguntaActual.value]);
const puedeContinuarPregunta = computed(
  () => respuestaActual.value.trim().length > 0 && !enviando.value && !!preguntaActual.value,
);

async function validarPalabraSecreta() {
  if (!puedeContinuarLogin.value) return;
  enviando.value = true;
  mensaje.value = null;
  error.value = null;

  try {
    const secreta = palabraSecreta.value.trim();
    const encontrado = await obtenerCodigoPorPalabraSecreta(secreta);

    if (!encontrado) {
      alert('La palabra secreta es incorrecta. Revisa lo que te ha llegado en la invitación.');
      return;
    }

    if (encontrado.usado) {
      alert('Ya has respondido a la encuesta de MentiPremios con esta palabra secreta. ¡Gracias de nuevo!');
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
  respuestaActual.value = '';
  pasoActual.value = 'questions';
}

async function responderYPasarSiguiente() {
  if (!puedeContinuarPregunta.value || !preguntaActual.value || !codigo.value) return;

  const actual = preguntaActual.value;
  respuestas[actual.id] = respuestaActual.value.trim();
  respuestaActual.value = '';

  const esUltima = indicePreguntaActual.value >= preguntas.length - 1;

  if (!esUltima) {
    indicePreguntaActual.value += 1;
    return;
  }

  // Última pregunta respondida: guardamos todo en Firestore
  enviando.value = true;
  mensaje.value = null;
  error.value = null;

  const payload: PremioRespuesta = {
    usuario: codigo.value.nombre,
    premios: { ...respuestas },
  };

  try {
    await guardarRespuestaUsuario(payload);
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
          <div class="app-title">MentiPremios</div>
        </div>
      </div>
    </header>

    <div
      v-if="visorFotoAbierto"
      class="photo-modal"
      role="dialog"
      aria-modal="true"
      @click="cerrarVisorFoto"
    >
      <div class="photo-modal-inner">
        <img
          class="photo-modal-image"
          src="./assets/foto-amigos.jpg"
          alt="Foto de amigos"
          @click.stop
        />
      </div>
    </div>

    <main class="app-content">
      <section v-if="pasoActual === 'login'">
        <h3 class="hero-kicker">Bienvenido a los premios de</h3>
        <h1 class="hero-title">Sin Mentirosas no hay Traidores</h1>
        <p class="section-description">
          El rey del grupo (sergiodltv) te ha mandado tu palabra secreta por privado, metela aquí para poder acceder al
          cuestionario, y acuerdate de que solo puedes responderlo una vez, así que piensa bien.
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
            @keyup.enter="validarPalabraSecreta"
          />
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
      </section>

      <section v-else-if="pasoActual === 'welcome' && codigo">
        <h1 class="hero-title">Hola, {{ codigo.nombre }}</h1>
        <p class="section-description">
          Esta es tu encuesta personalizada de MentiPremios. Vamos a ir pregunta a pregunta, sin prisas, para que puedas
          nominar a quien se merece cada momento épico del año.
        </p>

        <div class="welcome-panel">
          <p>
            - Podrás responder a cada pregunta una sola vez.  
            - Cuando termines, tu palabra secreta quedará marcada como <strong>respondida</strong> y no podrás volver a
            usarla.
          </p>
        </div>

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
      </section>

      <section v-else-if="pasoActual === 'questions' && codigo && preguntaActual">
        <h1 class="hero-title">{{ preguntaActual.titulo }}</h1>

        <textarea
          v-model="respuestaActual"
          class="field-textarea field-textarea--large"
          rows="4"
          placeholder="Escribe tu respuesta con todos los detalles jugosos que quieras compartir..."
        />

        <div class="footer">
          <div class="footer-text">
            Respondiendo como: <strong>{{ codigo.nombre }}</strong>
          </div>
          <button
            type="button"
            class="button-primary"
            :disabled="!puedeContinuarPregunta"
            @click="responderYPasarSiguiente"
          >
            {{
              indicePreguntaActual + 1 === preguntas.length
                ? enviando
                  ? 'Guardando respuestas...'
                  : 'Enviar y cerrar encuesta'
                : 'Siguiente pregunta'
            }}
          </button>
        </div>
      </section>

      <section v-else-if="pasoActual === 'done' && codigo">
        <h1 class="hero-title">Gracias por participar, {{ codigo.nombre }}</h1>
        <p class="section-description">
          Tus respuestas se han guardado en Firebase y se usarán para montar una gala de premios inolvidable con todo el
          grupo.
        </p>

        <div class="status status--success">
          {{ mensaje ?? 'Tus respuestas se han guardado correctamente.' }}
        </div>
      </section>

      <section v-if="error">
        <div class="status status--error">
          {{ error }}
        </div>
      </section>
    </main>
  </div>
</template>

