# Guía de despliegue — MentiPremios

## Requisitos previos

- Node.js 20+
- Una cuenta de Firebase con **Firestore habilitado** (el plan Spark, el gratuito, basta)
- Una app web registrada en ese proyecto de Firebase
- (Opcional) Cuenta en Vercel, Netlify o similar para hosting

> **No hace falta nada de esto:** un plan con Cloud Functions, Firebase Authentication, ni App Check. No hay backend que desplegar. El único artefacto que se publica fuera del hosting es `firestore.rules`.

---

## 1. Configurar Firebase

### 1.1 Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Habilita **Firestore Database** en modo de producción.
4. En **Configuración del proyecto → General → Tus aplicaciones**, crea una app web.
5. Copia las credenciales (`apiKey`, `authDomain`, `projectId`, etc.).

### 1.2 Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto. Estas seis variables son
**todas** las que lee el código, y todas llevan el prefijo `VITE_`:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Tres cosas que conviene no aprender de la forma difícil:

- **El prefijo `VITE_` es obligatorio y significa "público"**. Vite incrusta estas variables en el bundle. Ninguna de las seis es secreta: son identificadores de proyecto. Las credenciales de servicio y la clave privada de la cuenta de servicio **no** van aquí, jamás.
- **`.env.local` no está versionado** (`.gitignore` cubre `.env` y `.env.*`). En Vercel o Netlify hay que declarar las variables a mano en el panel; no se arrastran solas. Y hay que recordar que Vite solo lee las variables **en el momento del build**, así que declararlas después en el panel exige volver a desplegar.
- **`VITE_FIREBASE_APP_CHECK_SITE_KEY` es opcional.** No es una de las seis porque la aplicación no la necesita: si está definida, `src/infrastructure/firebase/client.ts` activa reCAPTCHA v3; si no, arranca igual. Nunca lanza un error al faltar, precisamente para que una variable ausente no pueda tumbar la gala. La protección de las palabras secretas la ponen `firestore.rules`, no App Check.

No hay que habilitar ningún proveedor en Firebase Authentication: el proyecto no usa Firebase Auth.

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

**El ID debe ir en minúsculas.** El cliente normaliza la palabra con `trim()`
y `toLowerCase()` antes de buscar, así que un documento sembrado como
`Galaxia-2025` es invisible para todo el mundo. Si ya existe, hay que renombrar
el documento, no cambiar la interfaz.

No se escribe ningún otro campo: el documento tiene exactamente `nombre` y `usado`, y las reglas ni siquiera permiten crearlo desde el navegador.

#### Colección `respuestas`
Se crea automáticamente cuando los usuarios envían sus votos, con el mismo ID que su invitación. **No necesitas crear documentos manualmente.**

#### Colección `palabrasClave`
La colección queda aislada para uso opcional y se crea automáticamente al guardar el primer registro mediante `FirestoreKeywordsRepository`. No forma parte del flujo actual de encuesta.

### 1.4 Reglas de seguridad de Firestore

`firestore.rules` es, literalmente, la barrera de seguridad del proyecto. El navegador **no**
habla con un backend: habla con Firestore, y Firestore evalúa estas reglas en cada
operación. El fichero completo, listo para copiar y desplegar:

```
rules_version = '2';

// Sin servidor intermedio: el navegador lee y escribe directamente. La
// seguridad se apoya en una sola idea: se puede leer una invitación concreta si
// ya se conoce su identificador (la palabra secreta), pero nunca se puede
// enumerar la colección. Sin `list`, nadie puede descubrir las palabras del
// resto de participantes ni quién ha contestado ya.
service cloud.firestore {
  match /databases/{database}/documents {
    match /codigos/{invitationId} {
      allow get: if true;                    // leer una invitación concreta
      allow list: if false;                  // enumerar: NUNCA
      allow create, delete: if false;        // las crea el organizador

      // Lo único que la aplicación escribe es el paso de `usado: false` a
      // `usado: true`. `diff` acota el cambio a ese campo, así que no sirve ni
      // para alterar el nombre ni para resucitar una invitación ya usada.
      allow update: if resource.data.usado == false
        && request.resource.data.usado == true
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usado']);
    }

    // Solo se crean, nunca se leen ni se modifican. El documento se identifica
    // con el id de la invitación, así que prohibir `update` es lo que impide que
    // un segundo envío sobrescriba el primero.
    match /respuestas/{responseId} {
      allow create: if request.resource.data.keys().hasOnly([
        'schemaVersion',
        'participantName',
        'answers',
        'createdAt',
        'submittedAt',
      ]);
      allow read, update, delete: if false;
    }

    match /palabrasClave/{entryId} {
      allow create: if true;
      allow read, update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;           // red de seguridad
    }
  }
}
```

El envoltorio `service cloud.firestore { match /databases/{database}/documents { … } }`
no es decorativo: los `match` tienen que ir anidados dentro o el fichero no compila.
Si partes de este bloque para explicar una parte concreta, mantén la estructura.

La idea que sostiene el modelo: **se puede hacer `get` de una invitación concreta si ya se conoce su identificador —la palabra secreta—, pero nunca `list`.** Sin enumeración nadie puede descubrir las palabras del resto de participantes ni quién ha contestado ya.

Despliega con:

```bash
firebase deploy --only firestore:rules --project mentipremios
```

`firebase.json` de este repositorio solo declara la sección `firestore`, así que ese es el único objetivo de despliegue válido.

> **Desde la consola de Firebase sí se ve la colección entera**, con el estado de `usado` de cada participante. La consola opera con permisos de administrador del proyecto y no le afectan estas reglas: estas gobiernan a los clientes del SDK. Ver [SECURITY.md](SECURITY.md).

No hace falta emular reglas en los tests: su contrato se fija por texto en
`tests/unit/contracts/firestoreRules.spec.ts`, y una edición que vuelva a abrir
la colección entera es un test rojo.

---

## 2. Construir la aplicación

```bash
npm run build
```

Esto genera los archivos estáticos en `dist/`:

```
dist/
├── index.html
├── media-unavailable.svg          # Marcador de recurso ausente
├── foto-amigos.jpg                # Foto del avatar (copiada de public/)
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
3. Añade las **seis** variables `VITE_FIREBASE_*` en **Project Settings → Environment Variables**.
4. Despliega.

El orden completo, del principio al fin:

```bash
npm run build
firebase deploy --only firestore:rules --project mentipremios
# luego: declarar las seis variables en Vercel y desplegar desde el panel
```

No hay nada más que desplegar: no hay `functions/`, no hay `npm ci --prefix`, no hay región que sincronizar.

### Opción B: Netlify

1. Conecta tu repositorio en [netlify.com](https://netlify.com).
2. Configura:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Añade las seis variables de entorno en **Site settings → Environment variables**.
4. Despliega.

### Opción C: Firebase Hosting

`firebase.json` de este repositorio solo declara `firestore`, así que hay que
añadir el hosting una vez:

```bash
npm install -g firebase-tools
firebase init hosting
# Configura "public" como "dist"
# Configura "single page app" como "yes"
npm run build
firebase deploy --only hosting
```

---

## 4. Migraciones

No hay framework de migraciones porque no hay esquema que migrar: el documento de
respuesta se escribe siempre con la misma forma y las reglas la exigen con
`hasOnly`. Lo que sí exige cuidado son tres casos concretos.

### 4.1 Sembrar invitaciones

No hay script de siembra. Las invitaciones son documentos con dos campos, así
que se crean a mano en la consola. Si se escribe un script con el Admin SDK (que
sí está autorizado), dos reglas:

- El ID es la palabra ya normalizada, en minúsculas y sin espacios al final.
- No se escribe ningún campo más: `nombre` y `usado`, nada más.

Para generar un lote grande, un script temporal con el Admin SDK es más fiable
que la consola, y no debe commitearse.

### 4.2 Cambiar el catálogo de preguntas

El catálogo de `src/features/survey/domain/questions.ts` es la **única** fuente
de verdad: ya no hay una allowlist en un servidor que pueda ir por delante o por
detrás. `validateSurveyAnswers` valida cada respuesta contra el catálogo
recibido, y `submitSurvey` exige una respuesta por cada pregunta del catálogo.

Añadir una opción a una pregunta existente sí es compatible: los documentos ya
guardados siguen siendo válidos porque la validación es por pertenencia
(`includes`).

Añadir, quitar o renombrar una pregunta **no** lo es, y aquí el síntoma es
distinto al de antes: no hay un servidor que rechace el envío, sino que un
cuestionario con 11 preguntas exige 11 respuestas y uno con 9 exige 9. Los
votos ya emitidos se quedan con el número de respuestas con el que se
guardaron, así que conviene tratarlo como una migración de datos y no como un
commit.

### 4.3 Cambiar el esquema de un documento guardado

Las reglas exigen que `respuestas` se cree con **exactamente** cinco claves
(`schemaVersion`, `participantName`, `answers`, `createdAt`, `submittedAt`). Si
añades un campo nuevo, hay dos cosas que hacer **en el mismo despliegue**:

1. Añadirlo al `set` de `firestoreSurveyRepository.ts`.
2. Añadirlo a la lista `hasOnly` de `firestore.rules`.

Si solo se hace la primera, la escritura se rechaza con `permission-denied` y el
envío falla en la casa de quien participa. Si solo se hace la segunda, el campo
nunca llega a escribirse. Un documento ya guardado **no** se puede reescribir
para añadirle el campo: `update` está prohibido en `respuestas` a propósito.
Los documentos antiguos se quedan como están, y eso no molesta a nadie porque
solo los lee un export manual.

---

## 5. Rollback

Ninguna operación de este proyecto es irreversible, pero una de ellas es
silenciosa si falla, así que conviene tener el orden escrito.

### Frontend (Vercel/Netlify)

Un redeploy del commit anterior. Los assets llevan hash en el nombre, así que
el navegador no mezcla versiones: basta con que `index.html` vuelva a apuntar al
bundle antiguo.

### Reglas de Firestore

`git revert` del commit que las tocó y `firebase deploy --only firestore:rules --project mentipremios`.

Es el rollback más rápido de todos, porque desplegar reglas tarda segundos. Y es
también el más peligroso: una regla que deniega por defecto es la última línea
de defensa del proyecto, y aflojarla un rato de más expone invitaciones y
respuestas. Conviene vigilar la consola de Firebase durante el despliegue.

> Cambiar `allow list: if false` a `allow list: if true` hace que **cualquier
> persona con la URL de la aplicación** pueda leer las palabras secretas de todos
> los participantes. Ese es exactamente el motivo por el que la regla está
> escrita a mano, comentada y fijada por un test.

### Datos

La transacción de `saveSurvey` es atómica, así que no hay estados intermedios
que reparar. Si un despliegue deja invitaciones marcadas sin respuesta, no es
una transacción partida: es un despliegue con reglas abiertas que ha permitido
escribir a mano, o un script de Admin SDK mal usado. La reparación es manual y
se hace en la consola: poner `usado: false` en la invitación afectada, y decidir
qué hacer con el documento de `respuestas` que la acompaña (borrarlo desde la
consola es posible; el navegador no puede).

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
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:unit -- --run`
5. `npm run test:integration -- --run`
6. `npm run build`

El job `e2e`, en paralelo, instala Chromium con `npx playwright install --with-deps chromium`, ejecuta `npm run test:e2e` y sube el informe de Playwright como artefacto.

Hay un solo `npm ci`: no hay carpeta `functions/` que instalar ni compilar. Si quieres despliegue automático, añade un paso de deploy al workflow o configura Vercel/Netlify para que escuche el branch `main`. Si lo automatizas, recuerda que hay **dos** artefactos que mover: las reglas y la web. Las reglas primero.

---

## 8. Lista de verificación pre-despliegue

- [ ] `.env.local` con las **seis** variables `VITE_FIREBASE_*`
- [ ] Las mismas seis declaradas en el panel del hosting (Vercel/Netlify)
- [ ] Colección `codigos` creada, con un documento por participante y **los IDs en minúsculas**
- [ ] Cada documento de `codigos` tiene exactamente `nombre` (string no vacío) y `usado` (boolean)
- [ ] `firebase deploy --only firestore:rules --project mentipremios` aplicado
- [ ] Las reglas del proyecto desplegadas verificadas en la consola: `get` sí, `list` no
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:unit -- --run`, `npm run test:integration -- --run` y `npm run test:e2e` en verde
- [ ] `npm run build` genera `dist/` sin errores
- [ ] Assets multimedia añadidos, o asumido explícitamente que saldrán con el marcador
- [ ] Desplegado en el hosting con las seis variables presentes **en el build**, no solo guardadas en el panel
- [ ] Probado el flujo completo en el dominio de producción con una invitación de prueba: entrar, enviar, y comprobar que `usado` pasó a `true` en la consola

> Ningún paso de esta lista requiere un plan de pago de Firebase, ni una cuenta de
> servicio, ni App Check. Si un checklist de despliegue te pide alguno de esos tres,
> estás leyendo un documento anterior a la [Fase 13 de MIGRATION.md](MIGRATION.md).
