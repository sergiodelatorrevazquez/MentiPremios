# Configuración del entorno de desarrollo — MentiPremios

## Requisitos

- **Node.js** 20 o superior
- **npm** (incluido con Node.js)
- Una cuenta de **Firebase** con Firestore habilitado (el plan gratuito basta)
- **firebase-tools**, solo para desplegar las reglas: `npm install -g firebase-tools`

---

## Primeros pasos

### 1. Clonar el repositorio

```bash
git clone https://github.com/sergiodelatorrevazquez/MentiPremios.git
cd MentiPremios
```

### 2. Instalar dependencias

```bash
npm install
```

> Un solo `npm install`. No hay carpeta `functions/` ni segunda instalación.

### 3. Configurar Firebase

Copia la plantilla y crea un archivo `.env.local` en la raíz del proyecto con tus credenciales de Firebase:

```bash
cp .env.example .env.local
```

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> Las credenciales se obtienen de **Firebase Console → Configuración del proyecto → Tus aplicaciones → App web**.

> **Ninguna de las seis es secreta.** El prefijo `VITE_` significa que Vite las incrusta en el bundle y cualquiera puede leerlas: son identificadores de proyecto, no credenciales. La clave privada de una cuenta de servicio no va aquí, jamás.

> **`.env.local` está en `.gitignore`** — no se subirá al repositorio.

> `VITE_FIREBASE_APP_CHECK_SITE_KEY` es **opcional** y no hace falta para trabajar. Si la defines, se activa reCAPTCHA v3; si no, la aplicación arranca igual. No hay que habilitar ningún proveedor en Firebase Authentication: el proyecto no usa Firebase Auth.

### 4. Desplegar las reglas de Firestore

El navegador habla directamente con Firestore, así que **sin reglas desplegadas no
hay aplicación**: el login fallaría con `permission-denied` siempre.

```bash
firebase deploy --only firestore:rules --project mentipremios
```

Las reglas hacen que se pueda leer una invitación concreta por su identificador
pero no enumerar la colección. Ver [SECURITY.md](SECURITY.md).

### 5. Crear datos de prueba en Firestore

En la consola de Firebase, crea la colección `codigos` con al menos un documento de prueba:

```
codigos/
  └── palabra-de-prueba/
        └── voted: false
```

El ID del documento es la palabra secreta y tiene que ir **en minúsculas**: la
aplicación normaliza con `trim()` y `toLowerCase()` antes de leer. El documento
no guarda ningún dato más: el identificador ya identifica a la persona. Y ese
mismo documento es donde se guardará su voto al enviar: `voted` pasará a `true` y
aparecerán los diez campos de pregunta.

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173`).

---

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo Vite (hot-reload) |
| `npm run build` | Compila para producción en `dist/` |
| `npm run preview` | Sirve la build de producción localmente |
| `npm run typecheck` | `vue-tsc --noEmit`: tipos y plantillas `.vue` |
| `npm test` | Ejecuta unitarias e integración en modo watch |
| `npm test -- --run` | Ejecuta todo una sola vez (modo CI) |
| `npm run test:unit` | Solo `tests/unit`, en watch |
| `npm run test:integration` | Solo `tests/integration`, en watch |
| `npm run test:ui` | Abre Vitest UI (dashboard interactivo) |
| `npm run test:e2e` | Tests responsive en Chromium real (Playwright) |
| `npm run lint` | Ejecuta ESLint en `src/` |

---

## Estructura del proyecto

```
firestore.rules                   # La barrera de seguridad: get sí, list no
firebase.json                     # Solo declara las reglas

src/
├── main.ts                       # createApp + provide(APP_SERVICES_KEY, …)
├── style.css                     # Tokens de diseño y estilos globales
├── app/                          # App.vue (shell) y bootstrap.ts (composition root)
├── features/
│   ├── survey/                   # domain/, application/ y presentation/
│   └── keywords/                 # Contrato opcional
├── infrastructure/
│   ├── firebase/                 # client.ts, firestoreSurveyRepository.ts, firestoreKeywordsRepository.ts
│   ├── logging/                  # Logger con redacción de secretos
│   └── metrics/                  # Contadores cerrados
└── assets/                       # Imágenes y vídeos

tests/
├── unit/
│   ├── domain/              # Reglas puras y catálogo de assets, sin Vue
│   ├── application/         # Casos de uso con dobles en memoria
│   ├── components/          # Cada SFC aislado con Vue Test Utils
│   ├── infrastructure/      # Adaptadores con el SDK de Firebase simulado
│   └── contracts/           # Invariantes del repo: tokens, estilos, reglas
├── integration/             # App completa con solo los adaptadores externos falsos
└── e2e/                     # Chromium real sobre el harness
```

### Dónde colocar una prueba nueva

| Lo que se prueba | Ubicación | Doble de frontera |
|---|---|---|
| Una regla pura del dominio | `tests/unit/domain/` | Ninguno |
| Un caso de uso | `tests/unit/application/` | Repositorio en memoria |
| Un componente Vue aislado | `tests/unit/components/` | Ninguno |
| Un adaptador de Firebase | `tests/unit/infrastructure/` | `vi.mock` del SDK |
| Una invariante de tokens, estilos, assets, reglas o esquema | `tests/unit/contracts/` | Lectura de ficheros |
| Varios niveles de la arquitectura a la vez | `tests/integration/` | Solo `AppServices` externos |
| Comportamiento en navegador | `tests/e2e/` | `AppServices` simulados en el harness |

`tests/unit/contracts/testLayout.spec.ts` falla si una spec aparece fuera de un nivel o de una capa reconocida, de modo que la pirámide no se deshace por descuido.

---

## Ejecutar tests

```bash
# Una sola ejecución de todo
npm test -- --run

# Modo watch (re-ejecuta al cambiar archivos)
npm test

# Por nivel
npm run test:unit -- --run
npm run test:integration -- --run

# Con interfaz gráfica
npm run test:ui
```

### Tests existentes

**`tests/integration/App.spec.ts`** — Tests de integración del wizard:
- Login: renderizado inicial, input, botón habilitado/deshabilitado, errores de palabra incorrecta y ya usada
- Welcome: muestra el identificador del documento
- Questions: renderizado de opciones, selección, progreso, navegación siguiente/anterior, guardado al completar, pantalla de gracias
- Visor de foto: apertura y cierre del modal

**`tests/integration/bootstrap.spec.ts`** — Comprueba que el composition root conecta `AppServices` con el repositorio y traduce `'saved'`, `'already-used'` y `'not-found'` a los errores que la interfaz entiende.

**`tests/unit/contracts/firestoreRules.spec.ts`** — Fija por texto el contrato de seguridad: `get` permitido en `codigos`, `list` prohibido, `create` y `delete` negadas, `update` acotado a `voted` y a la lista de preguntas (que además se compara con `QUESTION_IDS`), que no quede la colección `respuestas` y el comodín denegado.

**`tests/unit/contracts/`** — Tokens de diseño, `scoped` de estilos, favicon, contrato responsive, reglas de dependencia, contratos de repositorio y estructura del propio repo.

### Mocking

- `tests/integration/App.spec.ts` usa servicios de aplicación provistos por el bootstrap
- `tests/unit/infrastructure/` simula el SDK de Firebase con `vi.mock`
- `tests/unit/contracts/firestoreRules.spec.ts` no necesita emulador: lee `firestore.rules` y `firebase.json` como ficheros

> Las reglas de Firestore **no se ejecutan** en la suite. No hace falta: su contrato se fija por texto, y el SDK ya está doblado en `unit/infrastructure`. Un emulador en local es posible, pero añadiría un servicio que mantener a cambio de una garantía que el test da en milisegundos.

### Tests responsive (Playwright)

```bash
# Solo la primera vez: descarga el navegador
npx playwright install chromium

# Ejecuta la suite en móvil y escritorio
npm run test:e2e
```

`tests/e2e/responsive.spec.ts` recorre el flujo real en dos viewports (`mobile`, Pixel 5, y `desktop`) y comprueba que no hay scroll horizontal, que las opciones y los botones mantienen un objetivo táctil de `44px` y que los modales mantienen el botón de cierre dentro de la pantalla con un medio vertical.

El punto de entrada es `tests/e2e/harness/`, una página que monta `App.vue` con `AppServices` simulados y **no** importa `infrastructure/firebase/client.ts`, por lo que no necesita credenciales ni conexión. Los escenarios se fuerzan por query string:

| Query | Efecto |
|---|---|
| `?scenario=invalid` | Palabra secreta incorrecta |
| `?scenario=used` | Invitación ya utilizada |
| `?scenario=submit-error` | El envío falla y la acción pasa a `Reintentar envío` |
| `?scenario=slow&delay=4000` | Retrasa la respuesta para poder inspeccionar los estados de carga |
| `?name=...` | Nombre de participante largo |

`vite.config.ts` acota `test.include` a `tests/unit/**/*.spec.ts` y `tests/integration/**/*.spec.ts`, de modo que Vitest no intenta ejecutar las specs de Playwright.

---

## Linting

```bash
npm run lint
```

El proyecto usa ESLint 9 con configuración flat (`eslint.config.mjs`). Las reglas principales:

- `eslint:recommended` + `plugin:vue/strongly-recommended`
- Parser TypeScript para archivos `.vue` y `.ts`
- `vue/multi-word-component-names`: off (permite nombres de un solo componente)
- `no-unused-vars`: warn

---

## Solución de problemas comunes

| Problema | Solución |
|---|---|
| `VITE_FIREBASE_*` variables no encontradas | Copia `.env.example` a `.env.local` y rellénalo con tu proyecto |
| Login siempre da «palabra secreta incorrecta» | Suele ser que las reglas no están desplegadas: `firebase deploy --only firestore:rules --project mentipremios` |
| El documento existe pero no se encuentra | El ID va **en minúsculas**: se normaliza con `trim()` + `toLowerCase()` |
| Error de Firebase `permission-denied` | Casi siempre es una operación que las reglas prohíben; revisa `firestore.rules` |
| Tests fallan por `vi is not defined` | Asegúrate de tener `globals: true` en `vite.config.ts` (ya configurado) |
| Error `import.meta.glob` no encuentra assets | Añade los archivos multimedia en `src/assets/` siguiendo la convención de nombres |
| Puerto 5173 ocupado | Vite asignará automáticamente otro puerto |

---

## Tareas comunes de desarrollo

### Añadir una nueva pregunta

En `src/features/survey/domain/questions.ts`, añade un nuevo objeto al array `preguntas`:

```typescript
{
  id: 'nueva-pregunta',
  titulo: 'Nueva Pregunta del Año',
  opciones: [
    { id: 'nueva-pregunta-1', texto: 'Opción 1' },
    { id: 'nueva-pregunta-2', texto: 'Opción 2' },
  ],
}
```

El catálogo es la única fuente de verdad: no hay una allowlist en un servidor que
pueda irse por delante. `validateSurveyAnswers` valida cada respuesta contra el
catálogo, así que basta con esto. Lo que sí hay que tener en cuenta es que
**cambiar el número de preguntas invalida los cuestionarios ya guardados**: planéalo
como una migración de datos. Ver [DEPLOYMENT.md §4.2](DEPLOYMENT.md#42-cambiar-el-catálogo-de-preguntas).

### Añadir una nueva colección Firestore

El navegador escribe directamente, pero **no en cualquier sitio**: `firestore.rules`
deniega por defecto con `allow read, write: if false` y hay que abrir la colección
explícitamente. La secuencia es esta, y el orden importa:

1. **Añade la regla** en `firestore.rules`, con el mínimo necesario. Piensa dos veces
   en si necesita `list`: permitírlo publica la colección entera, y en este proyecto
   eso significa publicar palabras secretas.
2. **Despliega** `firebase deploy --only firestore:rules --project mentipremios`.
3. **Escribe el repositorio** en `src/infrastructure/firebase/`, siguiendo el patrón de
   `firestoreSurveyRepository.ts` o `firestoreKeywordsRepository.ts`.
4. **Añade el test de contrato** en `tests/unit/contracts/`.

Las reglas están fijadas por texto en `tests/unit/contracts/firestoreRules.spec.ts`, así
que el paso 1 sin el paso de test es un commit que rompe la CI.

> Añadir un `match /nueva/{id}` **no** desactiva el comodín `/{document=**}` para el
> resto de rutas: sigue denegando todo lo no declarado. Esa es la razón por la que
> `get` en `codigos` no filtra `palabrasClave`.

### Cambiar la imagen del avatar

Reemplaza `src/assets/foto-amigos.jpg` por otra imagen con el mismo nombre, o
cambia la ruta en los dos sitios donde se referencia a mano: `src/style.css:105`
(el `background-image` de `.avatar-circle`) y el `src` del `<img>` en
`src/features/survey/presentation/AvatarPhotoViewer.vue`.
