# Arquitectura de MentiPremios

## Vista general

MentiPremios es una **Single Page Application (SPA)** construida con **Vue 3 + TypeScript** que accede **directamente a Firestore desde el navegador**. No hay servidor: ni Cloud Functions, ni Firebase Auth, ni un backend propio. La aplicación sigue un wizard de cuatro pasos donde las personas introducen una palabra secreta, reciben una bienvenida con su identificador, responden 10 preguntas y ven una confirmación.

La consecuencia de que no haya servidor es que **la seguridad no está en el código, está en `firestore.rules`**. La regla que sostiene la funcionalidad entera es una sola: se puede hacer `get` de una invitación concreta si ya se conoce su identificador —que es la palabra secreta—, pero nunca `list` sobre la colección. Sin enumeración nadie puede descubrir las palabras del resto de participantes ni quién ha contestado ya. Ver [SECURITY.md](SECURITY.md).

```
index.html
  └── src/main.ts                     ← createApp + provide(APP_SERVICES_KEY, …)
        └── src/app/App.vue           ← Shell del wizard: orquesta, no implementa
              ├── features/survey/presentation/   ← Los seis SFC de cada paso y sus visores
              ├── features/survey/application/    ← Casos de uso puros (sin Vue)
              ├── features/survey/domain/         ← Catálogo y reglas puras
              ├── infrastructure/firebase/        ← Cliente y repositorios
              ├── infrastructure/logging/         ← Logger con redacción
              └── infrastructure/metrics/         ← Contadores sin datos sensibles
                    └── Firestore (acceso directo del navegador)
                          └── Evaluación de firestore.rules en cada operación
```

## Estructura de directorios

```
src/
├── app/                             # Shell y composition root
│   ├── App.vue                      # 292 líneas: orquesta pasos y conecta casos de uso
│   └── bootstrap.ts                 # createAppServices(db): traduce resultados a errores de dominio
├── features/
│   ├── survey/
│   │   ├── domain/                  # Catálogo, tipos, reglas de validación, assets
│   │   ├── application/             # Casos de uso: validación, envío, wizard, red
│   │   └── presentation/            # Los seis SFC de interfaz
│   └── keywords/                    # Contrato opcional de palabras clave
├── infrastructure/
│   ├── firebase/
│   │   ├── client.ts                # initializeApp, App Check opcional, exporta db
│   │   ├── firestoreSurveyRepository.ts      # getDoc + runTransaction sobre Firestore
│   │   └── firestoreKeywordsRepository.ts    # addDoc sobre palabrasClave
│   ├── logging/logger.ts            # Logger con niveles y redacción
│   └── metrics/metrics.ts           # Contadores cerrados
├── main.ts                          # Bootstrap de Vue + inyección de servicios
└── style.css                        # Tokens de diseño y estilos globales

firestore.rules                      # La barrera de seguridad de las palabras secretas
firebase.json                        # Solo declara la sección firestore

tests/
├── unit/                            # Pruebas aisladas, sin red ni Firebase real
│   ├── domain/                      # Reglas puras, catálogo, aislamiento
│   ├── application/                 # Casos de uso con dobles en memoria
│   ├── components/                  # SFC aislados con Vue Test Utils
│   ├── infrastructure/              # Adaptadores con el SDK de Firebase simulado
│   └── contracts/                   # Invariantes del repo: tokens, logging, reglas, esquema
├── integration/                     # Composición real con solo los adaptadores externos falsos
└── e2e/                             # Chromium real sobre el harness
```

## Capas y regla de dependencia

Las dependencias apuntan hacia dentro, nunca hacia fuera:

```
presentation  →  application  →  domain
                                 ↑
infrastructure  ────────────────┘   (la inyecta bootstrap.ts)
```

Las cuatro reglas que se sostienen, con el fichero que las verifica:

| Regla | Verificación |
|---|---|
| `domain` no importa Vue ni Firebase, ni sale del dominio | `dependencyRules.spec.ts` |
| `application` no importa componentes | `dependencyRules.spec.ts` |
| `presentation` no accede directamente a Firestore | `dependencyRules.spec.ts` |
| `infrastructure` no contiene reglas de interfaz | `dependencyRules.spec.ts` |

Y lo que cada capa hace:

- **`domain/`** no importa Vue, ni `app/`, ni `infrastructure/`, ni ningún paquete que no sea `node:`. Contiene el catálogo de preguntas, los tipos, las reglas de validación y el registro de multimedia.
- **`application/`** implementa los casos de uso sin componentes. `surveyWizard.ts` calcula el estado del wizard con funciones puras que devuelven un estado nuevo; `useSurveyWizard.ts` es el adaptador que las conecta a `ref` y `reactive`.
- **`presentation/`** son los seis SFC, sin acceso a Firebase ni a casos de uso. Pueden leer los tipos del dominio, que es la dirección permitida de la flecha.
- **`app/App.vue`** es el único punto que conoce todas las capas. Recibe `AppServices` por `inject` de la clave que `main.ts` provee a través de `bootstrap.ts`, así que el shell no importa Firebase.

**Excepciones, y por qué existen:**

- `app/` sí importa `firebase/firestore` (solo el tipo `Firestore`) y el repositorio. Es el composition root: si nadie puede conocer el SDK, nadie puede construirlo. `main.ts` sí importa `client.ts`, porque es el único punto donde existe `db`.
- `useSurveyWizard.ts` importa Vue, y es el único fichero de `application/` que lo hace. La lógica que vale la pena probar vive en `surveyWizard.ts`, sin Vue.
- `infrastructure/` puede importar tipos del dominio. Un adaptador implementa un contrato, y ese contrato está en el dominio.

`tests/unit/contracts/dependencyRules.spec.ts` comprueba las cuatro reglas leyendo los ficheros. Se verificó que muerden: al añadir un `import { ref } from 'vue'` al dominio, un `getFirestore` a `presentation`, un SFC a `application` y un `vue` a `infrastructure`, caen seis pruebas. Una guarda que no muerde es indistinguishable de una que no existe.

## Patrón de componentes

`src/app/App.vue` tiene 292 líneas y delega cada pantalla en su propio componente:

| Componente | Responsabilidad | Líneas |
|---|---|---|
| `LoginStep.vue` | Palabra secreta, mensajes de campo y de estado | 201 |
| `WelcomeStep.vue` | Saludo con el identificador (`codigo`) | 101 |
| `QuestionStep.vue` | Pregunta, opciones, progreso, pulsación larga | 365 |
| `CompletionStep.vue` | Confirmación final | 61 |
| `MultimediaViewer.vue` | Visor modal de foto y vídeo | 177 |
| `AvatarPhotoViewer.vue` | Foto grupal del avatar | 155 |

El shell conserva el estado entre pasos y pasa hacia abajo datos y eventos; los componentes no emiten nada que no sea una intención de la persona.

`WelcomeStep.vue` y `CompletionStep.vue` reciben un prop `codigo: string`, y `App.vue` les pasa `:codigo="codigo.id"`. El prop es **deliberadamente neutro**: hoy muestra el identificador del documento tal cual, y mañana puede llevar un saludo personalizado por identificador sin tocar ninguno de los dos componentes.

### Gestión de estado

No se usa Vue Router ni Pinia/Vuex. El estado se gestiona localmente con:

- **`ref`** para valores simples: `palabraSecreta`, `codigo`, `loginError`, `enviando`, `mensaje`, `error`, `visorFotoAbierto`, `visorMultimediaAbierto`.
- **`reactive`** para estructuras complejas: solo `preguntas[]` (las 10 preguntas del catálogo). El acumulador `respuestas` y el resto del estado del wizard no viven en el shell: los expone el composable `useSurveyWizard`, que también es dueño de `pasoActual`, `indicePreguntaActual` y `respuestaSeleccionada`.
- **`computed`** para valores derivados: `puedeContinuarLogin`, `preguntaActual`, `puedeContinuarPregunta`, `puedeVolverAtras`, `progreso`.

### Sistema de pasos (wizard)

El avance entre pantallas se controla con la variable `pasoActual` de tipo `Paso`:

```typescript
type Paso = 'login' | 'welcome' | 'questions' | 'done';
```

Cada paso se renderiza con `v-if` en el template de `src/app/App.vue`:

| Paso | Condición | Descripción |
|------|-----------|-------------|
| `login` | `pasoActual === 'login'` | Input de palabra secreta + botón de entrada |
| `welcome` | `pasoActual === 'welcome'` | Saludo con el identificador del documento |
| `questions` | `pasoActual === 'questions'` | Preguntas una a una con opciones |
| `done` | `pasoActual === 'done'` | Mensaje de agradecimiento |

Transiciones:
- `login → welcome`: `validarPalabraSecreta()` invoca `validateInvitation`, que hace un `get` de `codigos/{palabra}`
- `welcome → questions`: `avanzarDesdeBienvenida()` inicia el cuestionario y cuenta `survey_started`
- `questions → done`: `responderYPasarSiguiente()` guarda las respuestas y marca la invitación como ya votada

## Flujo de datos

```
Persona escribe la palabra secreta
  → validateInvitation(secreta)                ← getDoc(codigos/{secreta})
    → getDoc: una lectura por identificador, nunca una consulta
    → Documento mal formado? → "palabra incorrecta"
    → ¿No existe? → Error "palabra incorrecta"
    → ¿voted === true? → Error "ya has respondido"
    → ¿voted === false? → Avanza a welcome

Ve la bienvenida y pulsa "Empezar la encuesta"
  → Avanza a questions, índice = 0, survey_started +1

Responde 10 preguntas una a una
  → Cada respuesta se acumula en respuestas[id] = opcionId
  → Navegación: next (acumula y avanza) / back (restaura respuesta anterior)

En la última pregunta, pulsa "Enviar y cerrar"
  → submitSurvey({ invitationId, answers })
  → runTransaction: update codigos/{id} = { voted: true, ...answers }
  → Avanza a done, submission_succeeded +1, invitation_used +1
```

El envío es **una sola escritura** en el documento de la persona: se pasa `voted` a `true` y se añade un campo por pregunta con la opción elegida. No hay documento de respuesta aparte, así que no puede quedar medio guardado: o están las diez respuestas y `voted: true`, o no hay nada. Ese es el motivo por el que `docs/RECOVERY.md` puede tratar «invitación ya votada» durante el envío como prueba de que las respuestas están a salvo.

> Como `update` solo se admite en el sentido `false → true` y con una lista blanca de campos, un segundo envío choca contra la regla en lugar de sobrescribir. Y como la colección no se puede listar, nadie puede deducir el identificador de ningún documento ajeno. El precio de esta simplicidad está en [SECURITY.md](SECURITY.md): un `get` sobre el código de un amigo devuelve también sus respuestas.

## Modelo de datos (Firestore)

Hay **una sola colección**, `codigos`, con un documento por persona. El documento de la invitación es también el que guarda su voto.

### Colección `codigos`
```
Document ID: palabra secreta (string, ej: "creeper", "pitufo", "og")

// codigos/pitufo — antes de votar
{
  voted: false            // boolean: único campo del documento
}

// codigos/og — después de votar, en ese mismo documento
{
  voted: true,            // boolean: true tras completar la encuesta
  tonto: "tonto-1",
  casper: "casper-3",
  comefeas: "comefeas-2",
  soltero: "soltero-1",
  'anecdota': "anecdota-1",   // el id del campo no lleva acento
  meme: "meme-4",
  mensaje: "mensaje-1",
  foto: "foto-2",
  video: "video-1",
  correa: "correa-1"
}
```

Antes de votar el documento tiene **un solo campo**, `voted: false`. Al votar, en ese mismo documento, `voted` pasa a `true` y se añade un campo por pregunta con el id de la opción elegida, con la forma `<pregunta>-<n>`. **No se guarda ningún dato sobre la persona aparte del identificador**: es una decisión consciente, porque el identificador ya la identifica. Por eso el saludo de `WelcomeStep` y de `CompletionStep` es el propio identificador.

Ya no existe nada de lo que había antes: no hay campo `nombre`, ni el booleano con el nombre anterior, ni colección `respuestas`, ni un mapa anidado de respuestas, ni marcas de tiempo, ni versión del esquema.

### Colección `palabrasClave`
```
Document ID: auto-generado por Firestore
{
  usuario: "Sergio",      // string
  palabrasClave: ["divertido", "leal"],  // string[]
  createdAt: Timestamp    // serverTimestamp
}
```

## Modelo de seguridad

Sin servidor, `firestore.rules` es la frontera de confianza. Las decisiones, y por qué:

| Regla | Qué permite | Por qué |
|---|---|---|
| `codigos`: `get` permitido | Leer una invitación si ya conoces su ID | La palabra secreta **es** la credencial; sin esta lectura el login no puede existir |
| `codigos`: `list` prohibido | Nada | **Sin enumeración nadie descubre las palabras del resto ni quién ya ha respondido.** Es la regla que sostiene la funcionalidad |
| `codigos`: `create, delete` prohibido | Nada | Las invitaciones las crea el organizador desde la consola, no un navegador |
| `codigos`: `update` solo `false → true` en `voted` | Consumir la invitación al guardar | Impide devolver a `false` una invitación ya votada |
| `codigos`: `update` acotado por `diff(...).hasOnly([...])` | Escribir solo `voted` y los diez campos de pregunta | Impide escribir campos inventados y tocar cualquier otro dato del documento; la lista tiene que coincidir con `QUESTION_IDS` |
| `palabrasClave`: solo `create` | Guardar palabras clave | Nunca se puede leer ni modificar lo ya escrito |
| `/{document=**}`: `read, write` denegado | Nada | Red de seguridad para cualquier colección futura no declarada |

> **El coste consciente de una sola colección.** El mismo `get` que hace el login devuelve, si la invitación ya está votada, también las diez respuestas de esa persona: quien conozca la palabra de un amigo ve cómo votó. A cambio hay un único documento por persona, una única escritura al votar y ningún voto huérfano posible. Está analizado en [SECURITY.md](SECURITY.md).

> **Ver el estado de `voted` desde la consola de Firebase sigue funcionando.** La consola opera con permisos de administrador del proyecto, que no pasan por estas reglas: las reglas gobiernan a los clientes del SDK, no al panel de control. Así que organizar la gala mirando quién ha votado sigue siendo posible sin abrir la colección al navegador.

`tests/unit/contracts/firestoreRules.spec.ts` fija este contrato por texto, con el mismo criterio que el resto de `contracts/`: comprueba que `codigos` tiene `get` y no `list`, que `update` exige `false → true` en `voted` con `affectedKeys().hasOnly([...])`, que esa lista coincide con `QUESTION_IDS`, que no queda rastro de la colección `respuestas` y que el comodín lo deniega todo. Una edición accidental que vuelva a abrir la colección entera es un test rojo, no una discusión.

App Check es **opcional y no bloquea nada**: `client.ts` solo llama a `initializeAppCheck` si existe `VITE_FIREBASE_APP_CHECK_SITE_KEY`, y nunca lanza un error al arrancar. No hay Firebase Auth: el proyecto es anónimo por diseño y la identidad la aporta la palabra secreta.

## Persistencia de premios e invitaciones

`FirestoreSurveyRepository` (`src/infrastructure/firebase/firestoreSurveyRepository.ts`) es el único adaptador que toca `codigos`, y expone dos operaciones:

| Método | Operación Firestore | Devuelve |
|---|---|---|
| `findInvitation(id)` | `getDoc(doc(db, 'codigos', id))` | `{ id, voted }`, o `null` |
| `saveSurvey(response)` | `runTransaction`: lee la invitación y hace un único `update` con `{ voted: true, ...answers }` | `'saved' \| 'already-used' \| 'not-found'` |

`saveSurvey` recibe `{ invitationId, answers }` y nada más: la persona ya la identifica el id del documento, así que el payload no lleva ningún dato sobre ella. `parseInvitation` solo mira que el documento sea un objeto y que `voted` sea un `boolean`; no valida ningún otro campo.

Los tres resultados se devuelven **como dato y no como excepción**, porque los tres son esperables: el repositorio no decide qué mensaje ve la persona. Esa traducción vive en `createAppServices` (`src/app/bootstrap.ts`), que es el composition root y el único punto que conoce Firestore por arriba de la interfaz:

| Resultado del repositorio | Error de aplicación |
|---|---|
| `not-found` | `InvalidInvitationError` |
| `already-used` | `InvitationAlreadyUsedError` |
| `saved` | — |
| excepción del SDK | `PersistenceError` (envuelto por `submitSurvey`, con la causa en `cause`) |

El repositorio nunca usa consultas —ni `getDocs`, ni `query`, ni `where`—, porque una consulta es un `list` y `list` está prohibido. `tests/unit/contracts/repositoryContracts.spec.ts` lo fija leyendo el fuente.

`FirestoreKeywordsRepository.save` escribe en `palabrasClave` con un timestamp del servidor, y solo puede crear (`addDoc`): la colección tiene `create` permitido y todo lo demás denegado.

## Manejo de errores

`src/features/survey/application/networkError.ts` clasifica todo fallo en cinco tipos: `offline`, `timeout`, `permission`, `unavailable` y `unknown`. La clasificación es una decisión de negocio, no de presentación, así que vive en `application` y no en `app/`.

El orden de las señales es deliberado: primero `navigator.onLine`, porque si el navegador sabe que no hay red no tiene sentido interpretar nada más; después el código de Firebase, comparado contra conjuntos cerrados; y por último el texto, solo cuando no hay código. Los envoltorios propios guardan la causa en `cause` y la clasificación la desenvuelve, para que el código real de Firebase no se pierda al cruzar una frontera de capa.

Los errores de dominio (`invitation-already-used`, `invalid-invitation`) conservan su mensaje propio. Durante el envío, `invitation-already-used` y `submission-already-completed` se tratan como acierto, porque significan que un intento anterior sí se guardó. `docs/RECOVERY.md` explica por qué esa interpretación es fiable.

Con acceso directo, los errores que llegan desde Firestore son los del propio SDK: `permission-denied` cuando las reglas no encajan con la operación, `unavailable` o `failed-precondition` cuando hay un problema transitorio, `aborted` cuando una transacción entra en conflicto y reintenta. `classifyNetworkError` los clasifica con la misma tabla cerrada, sin cambios.

## Observabilidad

Dos piezas, con la misma postura de no recoger datos personales:

- **`infrastructure/logging/logger.ts`**: niveles, redacción recursiva de secretos registrados y campos con nombres sensibles, límites de profundidad y tamaño. En producción solo escribe `error`. No hay ya ningún `console.error` justificado por un destino externo: `tests/unit/contracts/logging.spec.ts` prohíbe el `console.*` en todo `src/`.
- **`infrastructure/metrics/metrics.ts`**: contadores cerrados (`survey_started`, `submission_succeeded`, `submission_failed`, `invitation_used`, `multimedia_failed`). La ausencia de datos sensibles no depende de la prudencia de quien llama: los nombres son una constante y la API no admite contexto libre.

## Multimedia

Las imágenes y vídeos de las preguntas se cargan con `import.meta.glob` de Vite (`src/features/survey/domain/multimediaRegistry.ts`):

```typescript
const multimediaAssets = import.meta.glob<string>(
  '../../../assets/{mensaje,foto,video}-*.{jpg,mp4,webm}',
  { eager: true, query: '?url', import: 'default' },
);
```

El registro resuelve en build y, si un archivo no existe, cae en `/media-unavailable.svg` y marca la entrada como `unavailable`; abrir ese visor incrementa `multimedia_failed`. Las preguntas con multimedia (`mensaje`, `foto`, `video`) muestran miniaturas en las opciones y un visor modal con **detección de pulsación larga** (300ms) para ver a pantalla completa, mientras que un clic normal selecciona la opción.

La foto grupal del avatar es la excepción: no pasa por el registro, y su ruta está escrita a mano en `src/style.css:105` y en `AvatarPhotoViewer.vue`.

## CSS y theming

El tema usa un esquema de color verde definido como custom properties en `src/style.css`:

```css
--color-primary: #90ee90;
--color-primary-dark: #5fe55f;
--color-text: #0b3d0b;
--color-background: #f6fff6;
```

Los tokens cubren color, tipografía, tamaño de línea y espaciado. Los estilos se dividen en:
- **`src/style.css`**: tokens, estilos globales y clases utilitarias (`.field`, `.button-primary`, `.footer`, `.hero-title`, `.progress-bar`, `.status`)
- **Cada SFC `<style>`**: estilos scoped (`.options-grid`, `.option-card`, `.photo-modal`…)
- Diseño responsive con breakpoint en 640px

`tests/unit/contracts/designTokens.spec.ts` y `styleScope.spec.ts` vigilan que los tokens y el CSS scoped no se dupliquen ni se pierdan.

## Testing

- **Framework**: Vitest + Vue Test Utils + Happy DOM, con Playwright como nivel superior
- **Niveles**: `unit`, `integration` y `e2e`, cada uno ejecutable por separado
- **Mocks**: los dobles viven en la frontera `AppServices` de `bootstrap.ts`, en `vi.mock` del SDK de Firebase y en el harness de e2e
- **Cobertura**: Configurada en `vite.config.ts` con reporter `text` y `html`
- **Setup**: `vitest.setup.ts` configura `config.global.components = {}`
- **Sin emulador**: las reglas no se ejecutan en los tests. No hace falta porque su contrato se fija por texto en `tests/unit/contracts/firestoreRules.spec.ts`, y porque un `getDoc` o una transacción es exactamente lo que el repositorio ya ejecuta contra un doble del SDK

### Niveles de prueba

| Nivel | Qué ejercita | Doble de frontera | Ejecución |
|---|---|---|---|
| `tests/unit/domain` | Reglas puras, catálogo de assets, aislamiento | Ninguno | `npm run test:unit -- --run` |
| `tests/unit/application` | Casos de uso del cliente y clasificación de red | Repositorios en memoria | `npm run test:unit -- --run` |
| `tests/unit/components` | Cada SFC por separado con Vue Test Utils | Ninguno | `npm run test:unit -- --run` |
| `tests/unit/infrastructure` | Logger, métricas y adaptadores de Firebase | SDK de Firebase simulado | `npm run test:unit -- --run` |
| `tests/unit/contracts` | Tokens, estilos, logging, reglas Firestore, contratos de repositorio y estructura | Lectura de ficheros | `npm run test:unit -- --run` |
| `tests/integration` | Composición de la app completa | Solo `AppServices` externos | `npm run test:integration -- --run` |
| `tests/e2e` | Flujo real en Chromium, móvil y escritorio | `AppServices` simulados en el harness | `npm run test:e2e` |

`tests/unit/contracts/testLayout.spec.ts` vigila la estructura: si una spec aparece fuera de un nivel o de una capa conocida, falla.

### Tests existentes

| Archivo | Nivel | Casos |
|---|---|---|
| `tests/integration/App.spec.ts` | Integración | Login, bienvenida, preguntas, navegación atrás, payload exacto, payload de red, errores de red, métricas, logging, multiselección |
| `tests/integration/bootstrap.spec.ts` | Integración | Composición, traducción de `saved`/`already-used`/`not-found` a errores de aplicación y reintento |
| `tests/unit/application/submitSurvey.spec.ts` | Unitario | Validación, construcción del payload, orden de persistencia, reintento |
| `tests/unit/application/networkError.spec.ts` | Unitario | Los cinco tipos de fallo, causas envueltas y mensajes |
| `tests/unit/domain/isolation.spec.ts` | Unitario | Que el dominio no importe presentación ni infraestructura |
| `tests/unit/infrastructure/logger.spec.ts` | Unitario | Niveles, redacción y límites del logger |
| `tests/unit/infrastructure/metrics.spec.ts` | Unitario | Catálogo cerrado, incrementos inválidos y ausencia de contexto |
| `tests/unit/contracts/firestoreRules.spec.ts` | Unitario | `get` sí, `list` no, `update` acotado a `voted` y a la lista de preguntas, lista coherente con `QUESTION_IDS`, sin colección `respuestas`, comodín denegado |
| `tests/unit/contracts/*` | Unitario | Invariantes del repositorio |

## CI/CD

El workflow de GitHub Actions (`.github/workflows/tests.yml`) ejecuta en push/PR a `main`:

Job `test`:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` con Node 20 y cache npm
3. `npm ci`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test:unit -- --run`
7. `npm run test:integration -- --run`
8. `npm run build`

Job `e2e` en paralelo instala Chromium, ejecuta `npm run test:e2e` y sube el informe de Playwright como artefacto.

Hay un solo `npm ci`: no hay carpeta `functions/` que instalar ni compilar. El workflow **no despliega**; desplegar es un paso manual (`npm run build` + `firebase deploy --only firestore:rules` + Vercel).

## Decisiones arquitectónicas clave

| Decisión | Alternativa | Motivo |
|---|---|---|
| **Acceso directo del navegador a Firestore** | Cloud Functions con Admin SDK | Menos piezas, sin plan de pago, sin código que mantener; la seguridad pasa a estar en `firestore.rules` |
| **`get` sí, `list` no** | Backend que valida la palabra | La palabra secreta es la credencial; prohibir la enumeración es lo que impide descubrir las demás |
| **Una sola colección `codigos`** | Colecciones separadas `codigos` y `respuestas` | Un documento por persona, una única escritura al votar y ningún voto huérfano; a cambio, leer el código de otra persona devuelve también sus respuestas (ver [SECURITY.md](SECURITY.md)) |
| **Shell de 292 líneas + seis SFC** | Un único `App.vue` de ~990 líneas | Cada paso se prueba y se lee por separado; el shell solo orquesta |
| **Wizard con funciones puras** | Lógica del wizard dentro de `computed` del componente | `surveyWizard.ts` se prueba sin montar Vue y sin mocks |
| **Sin Vue Router** | `vue-router` | Solo 4 pantallas en secuencia fija, sin URL routing |
| **Sin Pinia** | Pinia/Vuex | Todo el estado es local a un solo shell |
| **`v-if` para pasos** | Componentes dinámicos | Simple, claro, sin abstracciones innecesarias |
| **Dominio sin framework** | Importar Vue en el dominio | Hace la regla de dependencia verificable con una prueba |
| **Capa de servicio** | Lógica Firestore en el shell | Separación de responsabilidades y testabilidad |
| **Alias español en servicios** | Solo nombres en inglés | API bilingüe para facilitar contribuciones |
| **App Check opcional** | App Check obligatorio | La app nunca debe dejar de arrancar por una variable de entorno ausente |
| **Sin Firebase Auth** | Auth anónima | Nadie tiene cuenta ni correo; la identidad es la palabra secreta |
| **Mock de servicios en tests** | Emulador de Firestore | Tests más simples y predecibles |
| **Pulsación larga para multimedia** | Click normal | Permite seleccionar la opción con clic y ver el detalle con pulsación larga |
| **Errores de red en `application`** | Clasificar en el componente | Es una decisión de negocio: qué se reintenta y qué ve la persona |
| **Sin persistencia en el navegador** | `sessionStorage` con borrador | Los datos personales no sobreviven al cierre de la pestaña (`docs/RECOVERY.md`) |
| **Reglas fijadas por texto** | Emulador de reglas en CI | El emulador no corre en el runner y un `git diff` de reglas es legible en un PR; el contrato de seguridad no depende de un servicio externo |
