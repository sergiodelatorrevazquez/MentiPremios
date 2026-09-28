# Guía de despliegue — MentiPremios

## Requisitos previos

- Node.js 20+
- Una cuenta de Firebase con Firestore habilitado
- Plan de Firebase con Cloud Functions (Spark no basta)
- (Opcional) Cuenta en Vercel, Netlify o similar para hosting

---

## 1. Configurar Firebase

### 1.1 Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Habilita **Firestore Database** en modo de producción.
4. En **Configuración del proyecto → General → Tus aplicaciones**, crea una app web.
5. Copia las credenciales (`apiKey`, `authDomain`, `projectId`, etc.).

### 1.2 Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto. Estas siete variables son
**todas** las que lee el código, y todas llevan el prefijo `VITE_`:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_APP_CHECK_SITE_KEY=tu-clave-recaptcha-v3
```

Tres cosas que conviene no aprender de la forma difícil:

- **El prefijo `VITE_` es obligatorio y significa "público"**. Vite incrusta estas variables en el bundle. Ninguna de las siete es secreta: son identificadores de proyecto. Las credenciales de servicio y la clave privada de la cuenta de servicio **no** van aquí, jamás.
- **`.env.local` no está versionado** (`.gitignore` cubre `.env` y `.env.*`). En Vercel o Netlify hay que declarar las variables a mano en el panel; no se arrastran solas.
- **`VITE_FIREBASE_APP_CHECK_SITE_KEY` es obligatoria en producción.** `src/infrastructure/firebase/client.ts` lanza un error en el arranque si falta con `import.meta.env.PROD`, porque sin App Check todas las llamadas fallan en el servidor con `permission-denied` y el síntoma es un formulario que no funciona nunca. En desarrollo es opcional para poder trabajar sin reCAPTCHA.

Habilita el proveedor **Anonymous** en Firebase Authentication y registra la app web en App Check con reCAPTCHA v3. Las callable Functions exigen Auth y un token de App Check válido.

### 1.3 Crear colecciones en Firestore

Crea manualmente en la consola de Firebase:

#### Colección `codigos`
Crea un documento por cada persona que vaya a participar:

```
codigos/
  └── palabra-secreta-única/     ← El ID del documento es la palabra secreta
        ├── nombre: "Sergio"     ← string (nombre visible en la bienvenida)
        └── usado: false         ← boolean
```

> Crea tantos documentos como participantes. Cada uno recibe su palabra secreta por privado.

**El ID debe ir en minúsculas.** Tanto el cliente como el servidor normalizan
la palabra con `trim()` y `toLowerCase()` antes de buscar, así que un documento
sembrado como `Galaxia-2025` es invisible para todo el mundo. Si ya existe, hay
que renombrar el documento, no cambiar la interfaz.

`responseId` no se crea a mano: lo escribe el servidor en la misma transacción
que marca la invitación como usada.

#### Colección `respuestas`
Se crea automáticamente cuando los usuarios envían sus votos. **No necesitas crear documentos manualmente.**

#### Colección `palabrasClave`
La colección queda aislada para uso opcional y se crea automáticamente al guardar el primer registro mediante `FirestoreKeywordsRepository`. No forma parte del flujo actual de encuesta.

### 1.4 Reglas de seguridad de Firestore

`firestore.rules` deniega todo, incluidas las colecciones no declaradas:

```
match /{document=**} {
  allow read, write: if false;
}
```

No hay ninguna excepción para el navegador: ni lectura de invitaciones, ni de
respuestas, ni escritura. Todo pasa por las callables. Despliega con:

```bash
firebase deploy --only firestore:rules
```

Las Cloud Functions usan Admin SDK y no quedan limitadas por estas reglas; por
eso la validación y el envío transaccional permanecen server-side. Esa es
también la razón de que el repositorio no necesite una emulación de reglas en
los tests: la frontera ya está en el servidor, y el cliente solo no tiene
permisos.

---

## 2. Construir la aplicación

```bash
npm run build
```

Esto genera los archivos estáticos en `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-XXXXXXXX.js        # JS bundle minificado
│   ├── index-XXXXXXXX.css       # CSS minificado
│   ├── foto-amigos-XXXXXXXX.jpg # Imagen con hash
│   └── mensaje-1-XXXXXXXX.jpg   # Imagen con hash
```

Si falta un asset, **la build no falla**. Vite compila lo que encuentra, el
registro de multimedia marca la entrada como `unavailable` en tiempo de
ejecución y la opción cae en `/media-unavailable.svg`. Es un fallo silencioso
que se detecta mirando las opciones, o mirando el contador `multimedia_failed`.

---

## 3. Desplegar

MentiPremios es una SPA estática que puede desplegarse en cualquier hosting de archivos estáticos.

### Opción A: Vercel (recomendado)

1. Conecta tu repositorio de GitHub en [vercel.com](https://vercel.com).
2. Configura:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. Añade las siete variables `VITE_FIREBASE_*` en **Project Settings → Environment Variables**. Si se olvida la del App Check, la app arranca y falla en la primera llamada.
4. Despliega.

### Opción B: Netlify

1. Conecta tu repositorio en [netlify.com](https://netlify.com).
2. Configura:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Añade las variables de entorno en **Site settings → Environment variables**.
4. Despliega.

### Opción C: Firebase Hosting

`firebase.json` de este repositorio solo declara `firestore` y `functions`, así
que hay que añadir el hosting una vez:

```bash
npm install -g firebase-tools
firebase init hosting
# Configura "public" como "dist"
# Configura "single page app" como "yes"
npm run build
firebase deploy --only hosting
```

### Desplegar Cloud Functions

El backend callable requiere un proyecto Firebase asociado y un plan que permita Cloud Functions. Selecciona el proyecto una vez y despliega:

```bash
npm install -g firebase-tools
firebase use --add
npm ci --prefix functions
firebase deploy --only functions
```

El predeploy compila el código de `functions/` con Node 20. La aplicación web
invoca las callables en `us-central1`, que es la región con la que se inicializa
el cliente (`getFunctions(app, 'us-central1')`). Si cambias la región en
`functions/src/index.ts`, hay que cambiarla también en el cliente o ninguna
llamada llegará a destino.

El orden importa: despliega las funciones **antes** que la web que las invoca. Al revés, la versión nueva de la interfaz puede pedir un DTO que el backend antiguo rechaza con `invalid-argument`, y el síntoma es un formulario que no avanza.

---

## 4. Migraciones

No hay framework de migraciones porque no hay esquema que migrar: los documentos
v2 se validan al leer y los legacy se reconocen sin reescribir. Lo que sí exige
cuidado son tres casos concretos.

### 4.1 Sembrar invitaciones

No hay script de siembra. Las invitaciones son documentos con dos campos, así
que se crean a mano en la consola o con un script propio del Admin SDK. Si se
escribe un script, dos reglas:

- El ID es la palabra ya normalizada, en minúsculas y sin espacios al final.
- No se escribe `responseId`: lo rellena el servidor.

Para generar un lote grande, un script temporal con el Admin SDK es más fiable
que la consola, y no debe commitearse.

### 4.2 Cambiar el catálogo de preguntas

La allowlist `SURVEY_OPTION_IDS` de `functions/src/surveySchema.ts` es la
fuente de verdad del servidor y el catálogo de `questions.ts` es la del
cliente. **Las dos tienen que cambiar en el mismo despliegue.** Si el servidor
acepta una pregunta que el cliente no conoce, el envío falla con
`invalid-argument`; si el cliente ofrece una que el servidor no acepta, ocurre
lo mismo. Ninguna de las dos direcciones se detecta en local, porque en local el
catálogo de pruebas no pasa por la allowlist.

Añadir una opción a una pregunta existente sí es compatible: los documentos ya
guardados siguen siendo válidos porque la allowlist se comprueba con
`includes`.

### 4.3 Documentos v2 con un campo extra

El parser de respuestas v2 exige **exactamente** cinco claves. Añadir un campo
a un documento guardado (por ejemplo `updatedAt`) hace que el documento se lea
como inválido, lo que en la práctica significa que el reintento de esa persona
dejará de ser idempotente y recibirá `failed-precondition` en vez de un acierto.
Si hace falta un campo nuevo, hay que actualizar `parseStoredSurveyResponse` en
el mismo despliegue, y no solo escribir el campo.

---

## 5. Rollback

Ninguna operación de este proyecto es irreversible, pero una de ellas es
silenciosa si falla, así que conviene tener el orden escrito.

### Frontend (Vercel/Netlify)

Un redeploy del commit anterior. Los assets llevan hash en el nombre, así que
el navegador no mezcla versiones: basta con que `index.html` vuelva a apuntar al
bundle antiguo.

### Cloud Functions

Cloud Functions conserva las versiones anteriores, así que el rollback es una
operación de un comando:

```bash
firebase functions:rollback
# o, para ser explícito:
firebase functions:rollback --functions submitSurvey,validateInvitation
```

Alternativa, si la versión anterior no sirve: desplegar el commit anterior
(`git checkout <sha> && npm ci --prefix functions && firebase deploy --only functions`).

### Reglas de Firestore

`git revert` del commit que las tocó y `firebase deploy --only firestore:rules`.
Es el rollback más rápido de todos, porque desplegar reglas tarda segundos. Aun
así, conviene vigilar la consola de Firebase durante el despliegue: una regla que deniega
por defecto es la última línea de defensa del proyecto, y aflojarla un rato
de más expone invitaciones y respuestas.

### Datos

Las transacciones de `submitSurvey` son atómicas, así que no hay estados
intermedios que reparar. Si un despliegue deja invitaciones marcadas sin
respuesta, es un despliegue con reglas abiertas o con Admin SDK mal usado, no
una transacción partida. La reparación es manual y se hace en la consola: poner
`usado: false` en la invitación afectada.

---

## 6. Gestión de assets

Las preguntas multimedia (`mensaje`, `foto`, `video`) se resuelven con
`import.meta.glob` sobre `src/assets/`. El patrón de nombres **es** el
contrato: un archivo que no se llama `foto-3.jpg` no se encuentra.

```
src/assets/
├── foto-amigos.jpg          # Foto del grupo (avatar), ruta escrita a mano
├── mensaje-1.jpg            # Captura 1 (✓ existe)
├── mensaje-2.jpg            # Captura 2
├── mensaje-3.jpg            # Captura 3
├── mensaje-4.jpg            # Captura 4
├── foto-1.jpg               # Foto 1
├── foto-2.jpg
├── foto-3.jpg
├── foto-4.jpg
├── video-1.mp4              # Vídeo 1
├── video-2.mp4
├── video-3.mp4
├── video-4.mp4
└── video-*.webm             # Opcional: segunda fuente del vídeo
```

Solo `foto-amigos.jpg` y `mensaje-1.jpg` están en el repositorio. El resto debe
añadirse antes del despliegue si se quiere que esas opciones funcionen; mientras
tanto muestran el marcador y cuentan `multimedia_failed`.

Cuatro reglas sobre los assets:

1. **Añadir un asset exige reconstruir.** `import.meta.glob` se resuelve en build, no en ejecución. Un archivo nuevo sin `npm run build` es invisible.
2. **Los vídeos necesitan dos fuentes.** `video-1.mp4` genera automáticamente el par `.mp4` + `.webm`; si solo hay un archivo, se reproduce en un navegador y falla en el otro.
3. **Los nombres llevan hash en `dist/`.** Eso permite cachearlos de forma agresiva, pero también significa que corregir una imagen exige otro despliegue, no borrar caché.
4. **La foto del avatar es la excepción.** No pasa por el registro: su ruta está escrita a mano en `src/style.css` y en `AvatarPhotoViewer.vue`. Cambiarla son dos ediciones.

---

## 7. CI/CD — GitHub Actions

El workflow de `.github/workflows/tests.yml` se ejecuta en cada push y PR a `main`. **No despliega**: su trabajo es impedir que llegue a producción un commit que no pasa las comprobaciones.

El job `test`:
1. `npm ci` y `npm ci --prefix functions`
2. `npm --prefix functions run build`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test:unit -- --run`
6. `npm run test:integration -- --run`
7. `npm run build`

El job `e2e`, en paralelo, instala Chromium con `npx playwright install --with-deps chromium`, ejecuta `npm run test:e2e` y sube el informe de Playwright como artefacto.

Si quieres despliegue automático, añade un paso de deploy al workflow o configura Vercel/Netlify para que escuche el branch `main`. Si lo automatizas, despliega las funciones antes que la web, por lo dicho en la sección 3.

---

## 8. Lista de verificación pre-despliegue

- [ ] `.env.local` con las siete variables, incluida `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] Las mismas siete variables declaradas en el panel del hosting
- [ ] Proveedor **Anonymous** habilitado en Firebase Authentication
- [ ] App Check con reCAPTCHA v3 registrado para el dominio de producción
- [ ] Colección `codigos` creada, con un documento por participante y **los IDs en minúsculas**
- [ ] `firebase deploy --only firestore:rules` aplicado
- [ ] `npm ci --prefix functions` y Cloud Functions desplegadas
- [ ] Assets multimedia añadidos, o asumido explícitamente que saldrán con el marcador
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit -- --run`, `npm run test:integration -- --run` y `npm run test:e2e` en verde
- [ ] `npm run build` genera `dist/` sin errores
- [ ] Probado el flujo completo en el dominio de producción con una invitación de prueba
