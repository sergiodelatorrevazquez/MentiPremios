# Guía de despliegue — MentiPremios

## Requisitos previos

- Node.js 20+
- Una cuenta de Firebase con Firestore habilitado
- (Opcional) Cuenta en Vercel, Netlify o similar para hosting

---

## 1. Configurar Firebase

### 1.1 Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Habilita **Firestore Database** en modo de prueba o producción.
4. En **Configuración del proyecto → General → Tus aplicaciones**, crea una app web.
5. Copia las credenciales (`apiKey`, `authDomain`, `projectId`, etc.).

### 1.2 Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con las credenciales de Firebase:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_APP_CHECK_SITE_KEY=tu-clave-recaptcha-v3
```

> **Importante**: `.env.local` está en `.gitignore` y **no debe subirse al repositorio**.

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

#### Colección `respuestas`
Se crea automáticamente cuando los usuarios envían sus votos. **No necesitas crear documentos manualmente.**

#### Colección `palabrasClave`
La colección queda aislada para uso opcional y se crea automáticamente al guardar el primer registro mediante `FirestoreKeywordsRepository`. No forma parte del flujo actual de encuesta.

### 1.4 Reglas de seguridad de Firestore

El archivo `firestore.rules` está configurado en `firebase.json` y aplica denegación por defecto. El navegador no puede leer invitaciones ni consultar colecciones, ni leer/escribir respuestas. La validación de códigos y el envío se realizan mediante callables autenticadas con App Check.

Despliega las reglas con:

```bash
firebase deploy --only firestore:rules
```

Las Cloud Functions usan Admin SDK y no quedan limitadas por estas reglas; por eso la validación y el envío transaccional permanecen server-side.

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

---

## 3. Desplegar

MentiPremios es una SPA estática que puede desplegarse en cualquier hosting de archivos estáticos.

### Opción A: Vercel (recomendado)

1. Conecta tu repositorio de GitHub en [vercel.com](https://vercel.com).
2. Configura:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. Añade las variables de entorno (`VITE_FIREBASE_*`) en **Project Settings → Environment Variables**.
4. Despliega.

### Opción B: Netlify

1. Conecta tu repositorio en [netlify.com](https://netlify.com).
2. Configura:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Añade las variables de entorno en **Site settings → Environment variables**.
4. Despliega.

### Opción C: Firebase Hosting

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

El predeploy compila el código de `functions/` con Node 20. La aplicación web invoca `submitSurvey` en `us-central1`; configura `VITE_FIREBASE_APP_CHECK_SITE_KEY` también en el proveedor de hosting antes de generar la build.

---

## 4. CI/CD — GitHub Actions

El repositorio incluye un workflow de tests (`.github/workflows/tests.yml`) que se ejecuta en cada push/PR a `main`:

```yaml
name: Tests
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit -- --run
      - run: npm run test:integration -- --run
```

**Nota**: Este workflow **no despliega**. Si quieres despliegue automático, añade un paso de deploy al workflow o configura Vercel/Netlify para que escuche al branch `main`.

---

## 5. Añadir contenido multimedia

Las preguntas multimedia (`mensaje`, `foto`, `video`) cargan archivos desde `src/assets/` mediante `import.meta.glob`. Para que las opciones funcionen:

```
src/assets/
├── foto-amigos.jpg          # Foto del grupo (avatar)
├── mensaje-1.jpg            # Captura de mensaje 1 (✓ existe)
├── mensaje-2.jpg            # Captura de mensaje 2
├── mensaje-3.jpg            # Captura de mensaje 3
├── mensaje-4.jpg            # Captura de mensaje 4
├── foto-1.jpg               # Foto 1
├── foto-2.jpg               # Foto 2
├── foto-3.jpg               # Foto 3
├── foto-4.jpg               # Foto 4
├── video-1.mp4              # Video 1
├── video-2.mp4              # Video 2
├── video-3.mp4              # Video 3
└── video-4.mp4              # Video 4
```

Solo `foto-amigos.jpg` y `mensaje-1.jpg` están actualmente en el repositorio. El resto deben añadirse siguiendo la convención de nombres.

---

## 6. Lista de verificación pre-despliegue

- [ ] Archivo `.env.local` configurado con credenciales reales de Firebase
- [ ] Colección `codigos` creada en Firestore con documentos para cada participante
- [ ] Reglas de seguridad de Firestore configuradas
- [ ] Assets multimedia añadidos en `src/assets/`
- [ ] `npm run build` genera la carpeta `dist/` sin errores
- [ ] `npm run lint` pasa sin errores
- [ ] `npm test -- --run` pasa todos los tests
