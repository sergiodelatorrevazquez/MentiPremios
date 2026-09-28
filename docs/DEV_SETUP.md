# Configuración del entorno de desarrollo — MentiPremios

## Requisitos

- **Node.js** 20 o superior
- **npm** (incluido con Node.js)
- Una cuenta de **Firebase** con Firestore habilitado

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

### 3. Configurar Firebase

Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales de Firebase:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> Las credenciales se obtienen de **Firebase Console → Configuración del proyecto → Tus aplicaciones → App web**.

> **`.env.local` está en `.gitignore`** — no se subirá al repositorio.

### 4. Crear datos de prueba en Firestore

En la consola de Firebase, crea la colección `codigos` con al menos un documento de prueba:

```
codigos/
  └── palabra-de-prueba/
        ├── nombre: "Usuario de prueba"
        └── usado: false
```

### 5. Iniciar el servidor de desarrollo

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
src/
├── app/                     # Shell y composition root
├── features/survey/         # Dominio, casos de uso y presentación
├── features/keywords/       # Contrato opcional
├── infrastructure/firebase/ # Cliente y repositorios
├── main.ts                  # Punto de entrada de la app
└── assets/                  # Imágenes y vídeos

functions/src/               # Cloud Functions callable

tests/
├── unit/
│   ├── domain/              # Reglas puras y catálogo de assets, sin Vue
│   ├── application/         # Casos de uso y handlers con dobles en memoria
│   ├── components/          # Cada SFC aislado con Vue Test Utils
│   ├── infrastructure/      # Adaptadores con el SDK de Firebase simulado
│   └── contracts/           # Invariantes del repo: tokens, estilos, esquema
├── integration/             # App completa con solo los adaptadores externos falsos
└── e2e/                     # Chromium real sobre el harness
```

### Dónde colocar una prueba nueva

| Lo que se prueba | Ubicación | Doble de frontera |
|---|---|---|
| Una regla pura del dominio | `tests/unit/domain/` | Ninguno |
| Un caso de uso o un handler de Cloud Functions | `tests/unit/application/` | Repositorio o store en memoria |
| Un componente Vue aislado | `tests/unit/components/` | Ninguno |
| Un adaptador de Firebase | `tests/unit/infrastructure/` | `vi.mock` del SDK |
| Una invariante de tokens, estilos, assets o esquema | `tests/unit/contracts/` | Lectura de ficheros |
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
- Welcome: muestra el nombre del usuario
- Questions: renderizado de opciones, selección, progreso, navegación siguiente/anterior, guardado al completar, pantalla de gracias
- Visor de foto: apertura y cierre del modal

**`tests/integration/bootstrap.spec.ts`** — Comprueba que la UI se conecta a las callables de validación y envío.

**`tests/unit/application/validateInvitationHandler.spec.ts`** y **`tests/unit/application/submitSurveyHandler.spec.ts`** — Verifican autenticación, validación de datos, idempotencia y operaciones de servidor.

**`tests/unit/contracts/`** — Tokens de diseño, `scoped` de estilos, esquema de documentos Firestore, favicon, contrato responsive y estructura del propio repo.

### Mocking

- `tests/integration/App.spec.ts` usa servicios de aplicación provistos por el bootstrap
- `tests/unit/infrastructure/` simula el SDK de Firebase con `vi.mock`
- Los handlers de Functions usan stores falsos para probar su lógica sin Firebase Emulator

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
| `VITE_FIREBASE_*` variables no encontradas | Copia `.env.local` desde el proyecto original o crea uno nuevo |
| Error de Firebase "permission-denied" | Revisa las reglas de seguridad en Firebase Console |
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
    { id: 'nueva-1', texto: 'Opción 1' },
    { id: 'nueva-2', texto: 'Opción 2' },
  ],
}
```

### Añadir una nueva colección Firestore

Las escrituras pasan por Cloud Functions, no por el navegador: las reglas de
Firestore deniegan el acceso directo. Para datos nuevos, lo habitual es añadir
una callable en `functions/src/` y un repositorio en
`src/infrastructure/firebase/` que la invoque, siguiendo el patrón de
`FirestoreKeywordsRepository`.

### Cambiar la imagen del avatar

Reemplaza `src/assets/foto-amigos.jpg` por otra imagen con el mismo nombre, o
cambia la ruta en los dos sitios donde se referencia a mano: `src/style.css:105`
(el `background-image` de `.avatar-circle`) y el `src` del `<img>` en
`src/features/survey/presentation/AvatarPhotoViewer.vue`.
