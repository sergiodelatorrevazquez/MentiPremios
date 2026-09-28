# Arquitectura de MentiPremios

## Vista general

MentiPremios es una **Single Page Application (SPA)** construida con **Vue 3 + TypeScript** y Cloud Functions. El navegador no accede directamente a Firestore: valida invitaciones y envía respuestas mediante callables autenticadas con App Check. La aplicación sigue un wizard de cuatro pasos donde los usuarios introducen una palabra secreta, reciben una bienvenida personalizada, responden 10 preguntas y ven una confirmación.

```
index.html
  └── src/main.ts                     ← Bootstrap de Vue 3
        └── src/App.vue               ← Único componente (wizard de 4 pasos)
              ├── Template: login → welcome → questions → done
              ├── Script: Composition API (ref, reactive, computed)
              └── Style: Scoped CSS (tema verde)
          ├── Firebase Auth anónimo + App Check
          └── Cloud Functions callables
            └── Firebase Admin SDK → Firestore
```

## Estructura de directorios

```
src/
├── app/                     # Shell y composition root
├── features/survey/         # Dominio, casos de uso y presentación
├── features/keywords/       # Contrato opcional
├── infrastructure/firebase/# Cliente y repositorio opcional
├── main.ts                  # Bootstrap de Vue + servicios
└── style.css                # Estilos globales

functions/src/
├── index.ts                 # Callable Functions
├── validateInvitationHandler.ts
└── submitSurveyHandler.ts

tests/unit/
├── App.spec.ts              # Tests de integración del wizard
├── bootstrap.spec.ts        # Composición e invocación callable
└── *Handler.spec.ts         # Tests unitarios de handlers server-side
```

## Patrón de componentes

Actualmente **todo el UI está en `src/App.vue`** (~990 líneas). No hay componentes hijos en `src/components/`. El archivo `DEV.md` recomienda dividir en componentes más pequeños cuando la UI crezca.

### Gestión de estado

No se usa Vue Router ni Pinia/Vuex. El estado se gestiona localmente con:

- **`ref`** para valores simples: `pasoActual`, `palabraSecreta`, `codigo`, `loginError`, `indicePreguntaActual`, `respuestaSeleccionada`, `enviando`, etc.
- **`reactive`** para estructuras complejas: `preguntas[]` (10 preguntas), `respuestas{}` (acumulador de respuestas), `respuestasAnteriores{}` (para navegación atrás).
- **`computed`** para valores derivados: `puedeContinuarLogin`, `preguntaActual`, `puedeContinuarPregunta`, `puedeVolverAtras`, `progreso`.

### Sistema de pasos (wizard)

El avance entre pantallas se controla con la variable `pasoActual` de tipo `Paso`:

```typescript
type Paso = 'login' | 'welcome' | 'questions' | 'done';
```

Cada paso se renderiza con `v-if` en el template (`src/App.vue:383-533`):

| Paso | Condición | Descripción |
|------|-----------|-------------|
| `login` | `pasoActual === 'login'` | Input de palabra secreta + botón de entrada |
| `welcome` | `pasoActual === 'welcome'` | Saludo personalizado con el nombre del usuario |
| `questions` | `pasoActual === 'questions'` | Preguntas una a una con opciones |
| `done` | `pasoActual === 'done'` | Mensaje de agradecimiento |

Transiciones:
- `login → welcome`: `validarPalabraSecreta()` invoca `validateInvitation` en Cloud Functions
- `welcome → questions`: `avanzarDesdeBienvenida()` inicia el cuestionario (`src/App.vue:237-241`)
- `questions → done`: `responderYPasarSiguiente()` guarda respuestas y marca código como usado (`src/App.vue:243-270`)

## Flujo de datos

```
Usuario escribe palabra secreta
  → validateInvitation(secreta)                ← Callable autenticada + App Check
    → Admin SDK: lectura de codigos/{secreta}
    → Respuesta: solo nombre visible del participante
    → ¿No existe? → Error "palabra incorrecta"
    → ¿usado === true? → Error "ya has respondido"
    → ¿usado === false? → Avanza a welcome

Usuario ve bienvenida y pulsa "Empezar la encuesta"
  → Avanza a questions, índice = 0

Usuario responde 10 preguntas una a una
  → Cada respuesta se acumula en respuestas[id] = opcionId
  → Navegación: next (acumula y avanza) / back (restaura respuesta anterior)

En la última pregunta, pulsa "Enviar y cerrar"
  → submitSurvey({ invitationId, answers })         ← Callable Function
  → Firestore transaction: create respuesta + marcar invitación usada
  → Avanza a done
```

## Modelo de datos (Firestore)

### Colección `codigos`
```
Document ID: palabra secreta (string, ej: "galaxia-2025")
{
  nombre: "Sergio",       // string: nombre a mostrar en bienvenida
  usado: false            // boolean: true tras completar la encuesta
}
```

### Colección `respuestas`
```
Document ID: nombre de usuario (string, ej: "SERGIO2024")
{
  tonto: "tonto-1",       // map: clave = id de pregunta, valor = id de opción
  casper: "casper-3",
  comefeas: "comefeas-2",
  // ... todas las preguntas
}
```

### Colección `palabrasClave`
```
Document ID: auto-generado por Firestore
{
  usuario: "Sergio",      // string
  palabrasClave: ["divertido", "leal"],  // string[]
  createdAt: Timestamp    // serverTimestamp
}
```

## Persistencia de premios e invitaciones

La UI valida invitaciones mediante la callable `validateInvitation`; el servidor devuelve solo el nombre visible y nunca expone el documento completo. El envío usa `submitSurvey`; el Admin SDK actualiza respuesta e invitación dentro de una transacción. Las reglas deniegan toda lectura y escritura Firestore desde el navegador.

`FirestoreKeywordsRepository.save` escribe en `palabrasClave` con un timestamp del servidor.

## Multimedia

Las imágenes y vídeos de las preguntas se cargan con `import.meta.glob` de Vite (`src/App.vue:4`):

```typescript
const multimediaAssets = import.meta.glob('./assets/{mensaje,foto,video}-*.{jpg,mp4}', 
  { eager: true, query: '?url', import: 'default' });
```

Esto permite que Vite procese y hashee los archivos en build. Las preguntas con multimedia (`mensaje`, `foto`, `video`) muestran miniaturas en las opciones y un visor modal con **detección de pulsación larga** (300ms) para ver a pantalla completa (`src/App.vue:163-187`).

El visor de foto del avatar (foto grupal) se abre con un click normal (`abrirVisorFoto`, línea 272).

## CSS y theming

El tema usa un esquema de color verde:

```css
--color-primary: #90ee90;
--color-primary-dark: #5fe55f;
--color-text: #0b3d0b;
--color-background: #f6fff6;
```

Los estilos se dividen en:
- **`src/style.css`**: estilos globales, custom properties, clases utilitarias (`.field`, `.button-primary`, `.footer`, `.hero-title`, `.progress-bar`, `.status`)
- **`src/App.vue` `<style>`**: estilos scoped del componente (`.app-shell`, `.app-header`, `.photo-modal`, `.options-grid`, `.option-card`)
- Diseño responsive con breakpoint en 640px

## Testing

- **Framework**: Vitest + Vue Test Utils + Happy DOM
- **Mock de Firebase**: `premiosService` se mockea en `App.spec.ts`; `firebase/firestore` se mockea en `premiosService.spec.ts`
- **Cobertura**: Configurada en `vite.config.ts` con reporter `text` y `html`
- **Setup**: `vitest.setup.ts` configura `config.global.components = {}`

### Tests existentes

| Archivo | Tipo | Casos |
|---|---|---|
| `tests/unit/App.spec.ts` | Integración | Login (input, botón, errores), Welcome (nombre), Questions (selección, progreso, navegación, guardado, thank-you), Visor de foto |
| `tests/unit/premiosService.spec.ts` | Unitario | Guardar respuestas, obtener código, marcar usado |

## CI/CD

El workflow de GitHub Actions (`.github/workflows/tests.yml`) ejecuta en push/PR a `main`:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` con Node 20 y cache npm
3. `npm ci`
4. `npm run lint`
5. `npm test -- --run`

## Decisiones arquitectónicas clave

| Decisión | Alternativa | Motivo |
|---|---|---|
| **Componente único** (App.vue ~990 líneas) | Dividir en componentes | App pequeña, 4 pasos lineales. Refactorizar cuando crezca |
| **Sin Vue Router** | `vue-router` | Solo 4 pantallas en secuencia fija, sin URL routing |
| **Sin Pinia** | Pinia/Vuex | Todo el estado es local a un solo componente |
| **`v-if` para pasos** | Componentes dinámicos | Simple, claro, sin abstracciones innecesarias |
| **Capa de servicio** | Lógica Firestore en App.vue | Separación de concerns, testabilidad |
| **Alias español en servicios** | Solo nombres en inglés | API bilingüe para facilitar contribuciones |
| **Mock de servicios en tests** | Mock de Firestore | Tests más simples y predecibles |
| **Pulsación larga para multimedia** | Click normal | Permite seleccionar la opción con click y ver detalle con pulsación larga |
