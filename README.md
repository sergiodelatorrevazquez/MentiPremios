# 🏆 MentiPremios

**MentiPremios** — *"Sin Mentirosas no hay Traidores"*

Aplicación web para gestionar los premios anuales del grupo de amigos. Cada persona recibe una palabra secreta, responde a 10 preguntas con los candidatos de cada categoría, y todo se guarda en Firebase para la gala final.

Es una SPA estática: **no hay servidor**. El navegador habla directamente con Firestore, y la seguridad no está en un backend sino en `firestore.rules`, que deja leer una invitación concreta pero prohíbe enumerar la colección. Ver [docs/SECURITY.md](docs/SECURITY.md).

---

## ✨ Funcionalidades

- **Acceso por palabra secreta** — cada participante tiene una clave única e intransferible
- **10 categorías de premios** — desde "Tonto del Año" hasta "Correa del Año" (con sorpresa)
- **Soporte multimedia** — imágenes y vídeos en las opciones con visor a pantalla completa
- **Progreso visual** — barra de progreso y navegación entre preguntas
- **Respuesta única** — cada palabra secreta solo puede usarse una vez
- **Persistencia en Firebase** — todos los votos se guardan en Firestore, sin servidor intermedio
- **Sin enumerar** — las reglas permiten leer una invitación por su identificador, nunca la colección entera

## 🚀 Demo

```bash
npm install
cp .env.example .env.local     # rellena las seis variables VITE_FIREBASE_*
npm run dev
```

Abre `http://localhost:5173` e introduce una palabra secreta que hayas creado en Firestore.

> Necesitas las reglas desplegadas en tu proyecto (`firebase deploy --only firestore:rules --project mentipremios`). Sin ellas, Firestore deniega el acceso al navegador y el login no funciona.

## 📦 Stack

| Tecnología | Versión |
|---|---|
| Vue 3 (Composition API) | ^3.5 |
| TypeScript | ^5.6 |
| Vite | ^6.0 |
| Firebase Firestore | ^11.0 |
| Vitest | ^2.0 |
| ESLint | ^9.0 |

## ⚙️ Primeros pasos

```bash
git clone https://github.com/sergiodelatorrevazquez/MentiPremios.git
cd MentiPremios
npm install
```

Crea un archivo `.env.local` con **seis** variables y tus credenciales de Firebase:

```bash
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
```

> **Ninguna de las seis es secreta.** El prefijo `VITE_` significa que Vite las incrusta en el bundle y cualquiera puede leerlas: son identificadores de proyecto, no credenciales. La clave privada de una cuenta de servicio no va aquí, nunca.

> App Check es **opcional**. Si defines `VITE_FIREBASE_APP_CHECK_SITE_KEY`, `src/infrastructure/firebase/client.ts` activa reCAPTCHA v3; si no, la aplicación arranca igual y sin lanzar ningún error.

Luego, crea al menos un código de invitación en la consola de Firebase (colección `codigos`):

```
codigos/
  └── palabra-de-prueba/
        ├── nombre: "Usuario de prueba"
        └── usado: false
```

El **ID del documento es la palabra secreta**, y tiene que ir en minúsculas: tanto el cliente como el repositorio normalizan con `trim()` y `toLowerCase()` antes de leer.

Y despliega las reglas, que son la barrera real de las palabras secretas:

```bash
npm install -g firebase-tools
firebase deploy --only firestore:rules --project mentipremios
```

```bash
npm run dev
```

La configuración local está en `.env.example`; cópialo a `.env.local` y
rellénalo con las credenciales de tu proyecto de Firebase.

## 📖 Documentación

| Documento | Descripción |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, flujo de datos y decisiones técnicas |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Guía de contribución: dónde tocar cada cosa y cómo pasar los tests |
| [docs/RECOVERY.md](docs/RECOVERY.md) | Qué ocurre y qué se recupera cuando algo falla |
| [docs/API.md](docs/API.md) | Modelo de datos Firestore, operaciones del cliente y reglas |
| [docs/SECURITY.md](docs/SECURITY.md) | Por qué las palabras secretas siguen siendo secretas sin backend |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Guía de uso para participantes |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Despliegue en producción (Vercel, Netlify, Firebase Hosting) |
| [docs/DEV_SETUP.md](docs/DEV_SETUP.md) | Configuración del entorno de desarrollo |
| [docs/MIGRATION.md](docs/MIGRATION.md) | Bitácora del refactor a monolito modular y del acceso directo |

## 🧪 Tests

```bash
npm test -- --run       # Una ejecución de todo
npm test                # Modo watch
npm run test:unit       # Solo tests unitarias
npm run test:integration # Solo tests de integración
npm run test:ui         # Dashboard interactivo
npm run test:e2e        # Tests responsive en navegador real
```

## 🔧 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Vista previa de la build |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarias y de integración |
| `npm run test:unit` | Tests unitarias por capa |
| `npm run test:integration` | Tests de integración |
| `npm run test:ui` | Dashboard interactivo |
| `npm run test:e2e` | Tests responsive (Playwright) |

> `npm test` entra en modo watch. Para una sola ejecución, como en CI, `npm test -- --run`.

## 🏗️ Estructura del proyecto

```
firestore.rules                   # La barrera de seguridad: get sí, list no
firebase.json                     # Solo declara las reglas
src/
├── main.ts                       # createApp + provide(APP_SERVICES_KEY, …)
├── style.css                     # Tokens de diseño y estilos globales
├── vue-shim.d.ts                 # shim de tipos para SFC
├── app/
│   ├── App.vue                   # Shell del wizard: orquesta, no implementa
│   └── bootstrap.ts              # createAppServices(db): composition root
├── assets/                       # foto-amigos.jpg, mensaje-1.jpg
├── features/
│   ├── survey/
│   │   ├── domain/               # Catálogo, tipos, reglas, registro multimedia
│   │   ├── application/          # Casos de uso: validar, enviar, wizard, red
│   │   └── presentation/         # Los seis SFC del flujo
│   └── keywords/                 # Contrato opcional
├── infrastructure/
│   ├── firebase/
│   │   ├── client.ts                        # initializeApp, App Check opcional, db
│   │   ├── firestoreSurveyRepository.ts     # getDoc + runTransaction sobre Firestore
│   │   └── firestoreKeywordsRepository.ts   # addDoc en palabrasClave
│   ├── logging/logger.ts           # Logger con redacción de secretos
│   └── metrics/metrics.ts          # Contadores cerrados

tests/
├── unit/                    # Pruebas aisladas, una carpeta por capa
│   ├── domain/  application/  components/  infrastructure/  contracts/
├── integration/             # Composición real con adaptadores externos falsos
└── e2e/                     # Chromium real sobre el harness
```

## ❓ Problemas frecuentes

**El login siempre dice «La palabra secreta es incorrecta»**

Casi siempre es que las reglas no están desplegadas o están en otro proyecto.

```bash
firebase deploy --only firestore:rules --project mentipremios
```

Comprueba también que el ID del documento de `codigos` está **en minúsculas** y
sin espacios al final: se normaliza con `trim()` + `toLowerCase()`, así que
`Galaxia-2025` es invisible. La forma de arreglarlo es renombrar el documento,
no tocar la interfaz.

**Sale un error de permisos en la consola del navegador**

Las reglas están pensadas para leerse documento a documento, no por colección. Si el error
menciona `list`, alguien ha intentado enumerar `codigos`: eso está prohibido a
propósito y así debe seguir. Para preparar una prueba, `get` sí funciona con un
ID que ya conoces. Para inspeccionar el estado de `usado` de todos los
participantes desde la consola de Firebase, se puede: la consola usa permisos
de administrador y no le afectan estas reglas.

**La aplicación no arranca o falla al cargar el módulo de Firebase**

Faltan las seis variables `VITE_FIREBASE_*` en `.env.local`. Se obtienen de
**Firebase Console → Configuración del proyecto → Tus aplicaciones → App web**.
La plantilla está en `.env.example`. App Check no es obligatoria: si ves un error
sobre reCAPTCHA, revisa que no estés definiendo `VITE_FIREBASE_APP_CHECK_SITE_KEY`
con un valor inventado.

**`import.meta.env` sale vacío en un despliegue**

Vite solo incrusta variables que existen **en el momento del build**. Si las
añades después en el panel de Vercel, hay que volver a desplegar, no basta con
guardar.

**Una opción con imagen o vídeo sale con un marcador gris**

El asset no está en `src/assets/` con el nombre exacto que espera el catálogo
(`foto-3.jpg`, `video-2.webm`…). `import.meta.glob` se resuelve en build, así
que hay que volver a compilar. El fallo no rompe la build a propósito, y se
detecta con el contador `multimedia_failed`. Ver
[DEPLOYMENT.md §6](docs/DEPLOYMENT.md#6-gestión-de-assets).

**Las pruebas fallan con `vi is not defined` o con rutas movidas**

`vite.config.ts` ya incluye `tests/unit` y `tests/integration`. Si has añadido
una spec en una carpeta nueva, revisa que `tests/unit/contracts/testLayout.spec.ts`
la reconozca: ese test falla a propósito cuando aparece una capa desconocida.

**¿Cómo despliego a producción?**

`npm run build`, `firebase deploy --only firestore:rules`, las seis variables en
el panel de Vercel y desplegar. La lista completa está en
[DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 🤝 Contribuir

Lee la [guía de contribución](docs/CONTRIBUTING.md): dónde añadir una pregunta, cómo pasar los tests y qué reglas de dependencia no se cruzan.

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Haz tus cambios y ejecuta `npm run typecheck && npm run lint && npm test -- --run` (o `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` por nivel)
4. Envía un pull request

## 📄 Licencia

Este proyecto es de uso privado para el grupo de amigos.
