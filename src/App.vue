<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  guardarPalabrasClaveUsuario,
  guardarRespuestaUsuario,
  type PremioRespuesta,
} from './services/premiosService';

const nombre = ref('');

const premios = reactive<Record<string, string>>({
  'MVP del grupo': '',
  'Mejor meme del año': '',
  'Persona más puntual': '',
  'Quien siempre llega tarde': '',
  'Mejor anécdota': '',
  'Plot twist del año': '',
});

const nuevaPalabra = ref('');
const palabrasClave = ref<string[]>([]);

const enviando = ref(false);
const mensaje = ref<string | null>(null);
const error = ref<string | null>(null);

const puedeEnviar = computed(() => {
  return (
    nombre.value.trim().length > 0 &&
    Object.values(premios).some((valor) => valor.trim().length > 0) &&
    !enviando.value
  );
});

function añadirPalabraClave() {
  const limpia = nuevaPalabra.value.trim();
  if (!limpia) return;
  if (!palabrasClave.value.includes(limpia)) {
    palabrasClave.value.push(limpia);
  }
  nuevaPalabra.value = '';
}

async function enviarFormulario() {
  if (!puedeEnviar.value) return;
  enviando.value = true;
  mensaje.value = null;
  error.value = null;

  const payload: PremioRespuesta = {
    usuario: nombre.value.trim(),
    premios: { ...premios },
  };

  try {
    await guardarRespuestaUsuario(payload);

    if (palabrasClave.value.length > 0) {
      await guardarPalabrasClaveUsuario({
        usuario: nombre.value.trim(),
        palabrasClave: [...palabrasClave.value],
      });
    }

    mensaje.value = '¡Respuestas guardadas correctamente en MentiPremios!';
    Object.keys(premios).forEach((clave) => {
      premios[clave] = '';
    });
    palabrasClave.value = [];
  } catch (e) {
    console.error(e);
    error.value = 'Ha ocurrido un error al guardar tus respuestas. Inténtalo de nuevo.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="card">
    <header class="card-header">
      <div>
        <div class="title">
          MentiPremios
          <span class="title-badge">Edición amigos</span>
        </div>
        <p class="subtitle">
          Responde a los premios y deja algunas palabras clave para cada amigo.
          Usaremos todo esto para montar una gala épica entre colegas.
        </p>
      </div>
      <div class="pill">
        100% anónimo · Respuestas en tiempo real
      </div>
    </header>

    <section class="grid">
      <article class="field" style="grid-column: 1 / -1">
        <div class="field-label">
          <span>Tu nombre o alias</span>
          <span class="field-hint">Así sabremos quién ha participado (no se mostrará en público).</span>
        </div>
        <input
          v-model="nombre"
          class="field-input"
          type="text"
          placeholder="Ej. Sergio, Menganito, La leyenda..."
        />
      </article>

      <article
        v-for="(valor, clave) in premios"
        :key="clave"
        class="field"
      >
        <div class="field-label">
          <span>{{ clave }}</span>
        </div>
        <textarea
          v-model="premios[clave]"
          class="field-textarea"
          rows="2"
          :placeholder="`¿Quién se merece este premio? ¿Por qué?`"
        />
      </article>
    </section>

    <section class="keywords-container">
      <div class="keywords-title">
        Palabras clave para tus amigos
      </div>
      <div class="keywords-hint">
        Piensa en conceptos cortos que definan a cada persona (ej. “memes”, “voz de la razón”, “after”, “tarde
        pero seguro”...).
      </div>

      <div class="input-inline">
        <input
          v-model="nuevaPalabra"
          class="field-input"
          type="text"
          placeholder="Añade una palabra clave y pulsa Enter o en Añadir"
          @keyup.enter="añadirPalabraClave"
        />
        <button
          type="button"
          class="button-primary"
          @click="añadirPalabraClave"
        >
          Añadir
        </button>
      </div>

      <div
        v-if="palabrasClave.length > 0"
        class="keywords-chips"
      >
        <span
          v-for="palabra in palabrasClave"
          :key="palabra"
          class="chip chip--highlight"
        >
          {{ palabra }}
        </span>
      </div>
    </section>

    <footer class="footer">
      <div class="footer-text">
        <strong>MentiPremios</strong> guarda tus respuestas directamente en Firebase para poder consultar todo el
        material de la gala.
      </div>

      <div>
        <button
          type="button"
          class="button-primary"
          :disabled="!puedeEnviar"
          @click="enviarFormulario"
        >
          {{ enviando ? 'Enviando...' : 'Enviar mis premios' }}
        </button>
        <div
          v-if="mensaje"
          class="status status--success"
        >
          {{ mensaje }}
        </div>
        <div
          v-if="error"
          class="status status--error"
        >
          {{ error }}
        </div>
      </div>
    </footer>
  </main>
</template>

