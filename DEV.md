# Guía de desarrollo – MentiPremios

Este documento explica cómo levantar el proyecto, cómo configurarlo y qué partes debes tocar para extender la funcionalidad.

## 1. Stack y estructura

- **Framework**: Vue 3
- **Lenguaje**: TypeScript
- **Empaquetador**: Vite
- **Tests**: Vitest + Vue Test Utils
- **Base de datos**: Firebase Firestore
- **Versionado / releases**: release-please (configurado para GitHub Actions)

Estructura principal:

- `src/main.ts`: punto de entrada de la aplicación.
- `src/App.vue`: componente principal con el formulario de premios y palabras clave.
- `src/firebase.ts`: inicialización de Firebase y export de la instancia de Firestore.
- `src/services/premiosService.ts`: capa de acceso a datos (FireStore) para respuestas y palabras clave.
- `tests/unit/*`: tests unitarios.
- `.github/workflows/release-please.yml`: workflow de GitHub Actions para automatizar releases.
- `release-please-config.json` y `release-please-manifest.json`: configuración de release-please.

## 2. Configuración de Firebase

En el proyecto original ya tienes una configuración funcional de Firebase.  
Desde este entorno **no podemos leer ese código ni tus claves**, así que debes copiarlas manualmente.

1. Crea en la raíz del proyecto un archivo `.env.local` (no se sube a Git).
2. Añade las mismas claves que usas en el proyecto original, pero con los prefijos de Vite:

```bash
VITE_FIREBASE_API_KEY=TU_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=TU_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=TU_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=TU_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=TU_SENDER_ID
VITE_FIREBASE_APP_ID=TU_APP_ID
```

3. Asegúrate de que los valores son **exactamente los mismos** que en el proyecto de referencia.

El archivo `src/firebase.ts` lee estas variables y monta la app de Firebase:

- Si cambias de proyecto de Firebase, solo tendrás que adaptar este archivo o las variables de entorno.

## 3. Colecciones en Firestore

- **`codigos`**: cada documento representa a una persona invitada.
  - **ID del documento**: es la **palabra secreta** que le das a esa persona (ej. `galaxia-2025`).
  - `nombre` (string): nombre de la persona tal y como quieres mostrarlo en la bienvenida.
  - `usado` (boolean): indica si esa palabra secreta ya se ha utilizado para contestar la encuesta.
  - Opcionalmente puedes añadir otros campos (por ejemplo, grupo, rol, etc.).

- **`respuestas`**: guarda las respuestas a las preguntas de la encuesta.
  - `usuario` (string): nombre de la persona (copiado del documento de `codigos`).
  - `premios` (map): claves = IDs de preguntas, valores = texto libre de la respuesta.
  - `createdAt`: marca de tiempo del servidor.

- **`palabrasClave`** (opcional, ya preparada): guarda palabras clave asociadas a cada usuario, por si quieres reutilizar esa funcionalidad.
  - `usuario` (string)
  - `palabrasClave` (array de strings)
  - `createdAt`: marca de tiempo

Todo el acceso está encapsulado en `src/services/premiosService.ts`.  
Si quieres añadir nuevas colecciones o nuevos campos:

1. Crea nuevas funciones en ese servicio (por ejemplo, `guardarVotosExtra`, `listarRespuestas`, etc.).
2. Usa `addDoc`, `getDocs`, `query`, etc. de `firebase/firestore` según tus necesidades.

### 3.1. Cómo crear los códigos con palabra secreta

En la consola de Firebase, en la colección `codigos`:

- Crea un documento por persona.
- Usa como **ID del documento** la palabra secreta que vas a enviarle (ej. `mvp-sergio-2025`).
- Añade al menos:
  - `nombre`: `"Sergio"` (o el nombre que quieras mostrar).
  - `usado`: `false` (tipo boolean).

La app hará:

- Primer paso: pide la **palabra secreta**.
- Comprueba si existe un documento en `codigos` con ese ID:
  - Si **no existe** → alerta de palabra incorrecta.
  - Si existe y `usado === true` → alerta de que ya ha respondido.
  - Si existe y `usado === false` → entra en la encuesta para ese participante.

Al terminar todas las preguntas:

- Guarda las respuestas en la colección `respuestas`.
- Llama a `marcarCodigoComoUsado`, que pone `usado = true` en el documento de `codigos`.

## 4. Levantar el proyecto en local

1. Instala dependencias:

```bash
cd MentiPremios
npm install
```

2. Asegúrate de tener `.env.local` con las variables de Firebase (ver sección 2).

3. Levanta el servidor de desarrollo:

```bash
npm run dev
```

4. Abre en el navegador la URL que te muestre Vite (por defecto `http://localhost:5173`).

## 5. Ejecutar tests

Para ejecutar la suite de tests unitarios:

```bash
npm test
```

Para modo interactivo con UI:

```bash
npm run test:ui
```

Los tests de ejemplo cubren:

- Comportamiento básico del componente `App.vue` (botón deshabilitado, alta de palabras clave).
- Integración mínima de `premiosService` con Firestore usando mocks.

## 6. Linting

Para lanzar ESLint:

```bash
npm run lint
```

Puedes adaptar las reglas en `.eslintrc.cjs` según tu estilo de código.

## 7. Versionado y release-please

El proyecto está preparado para usar **release-please** como sistema de versionado automático y generación de releases en GitHub.

### Flujo básico recomendado

1. Trabaja siempre en ramas a partir de `main`.
2. Haz tus cambios y crea commits normales.
3. Cuando quieras sacar una nueva versión:

   - Asegúrate de que tu rama está fusionada en `main`.
   - Haz `push` a `main`.

4. El workflow `.github/workflows/release-please.yml` se ejecutará en GitHub:
   - Actualizará la versión en `package.json` (y otros ficheros necesarios).
   - Creará o actualizará un Pull Request de release.
   - Al fusionar ese PR, se generará un tag y una release.

### Uso manual local (opcional)

También puedes usar el comando de npm:

```bash
npm run release:please
```

Esto ejecuta `release-please` en modo CLI, útil si quieres previsualizar cambios.

## 8. Git y despliegue en GitHub

### Inicializar el repositorio (si aún no lo está)

```bash
git init
git add .
git commit -m "0.1.0"
```

> El mensaje de commit inicial es el número de la versión, como solicitaste.

### Enlazar con GitHub

1. Crea en GitHub un repositorio llamado `MentiPremios`.
2. Añade el remoto (elige HTTPS o SSH según cómo trabajes):

```bash
git remote add origin git@github.com:sergiodelatorrevazquez/MentiPremios.git
# o bien
git remote add origin https://github.com/sergiodelatorrevazquez/MentiPremios.git
```

3. Haz push a la rama principal (por ejemplo `main`):

```bash
git branch -M main
git push -u origin main
```

Con esto:

- El workflow de `release-please` quedará activo.
- A partir de ahí, cada vez que merges cambios en `main`, podrás generar nuevas versiones.

## 9. Dónde tocar para nuevas funcionalidades

- **Nuevos premios, campos o lógica de formulario**:
  - Modifica `src/App.vue`, especialmente:
    - El array `preguntas` (lista de preguntas que se muestran una a una).
    - El flujo de pasos (`pasoActual`, `questions`, etc.).
  - Mantén la lógica de guardado desacoplada en `src/services/premiosService.ts` cuando sea algo relacionado con datos.

- **Nuevas colecciones o consultas a Firestore**:
  - Añade funciones nuevas en `src/services/premiosService.ts`.

- **Cambios de estilo / UI**:
  - Ajusta `src/style.css`.
  - Divide `App.vue` en componentes más pequeños en `src/components/` cuando la UI crezca.

### 9.1. Cambiar la imagen del header

En el header de la aplicación hay un avatar circular a la izquierda del título `MentiPremios`.

- El elemento HTML está en `src/App.vue`, clase `avatar-circle`.
- El estilo está en `src/style.css`, también con la clase `.avatar-circle`.

Tienes dos opciones:

1. **Usar una imagen local**:

   - Copia tu imagen (por ejemplo `avatar.png`) dentro de `src/assets/`.
   - En `src/App.vue`, cambia el `div` de `avatar-circle` por algo como:

   ```vue
   <div
     class="avatar-circle"
     style="background-image: url('/src/assets/avatar.png')"
   />
   ```

2. **Usar una URL externa**:

   - En `src/App.vue`, pon:

   ```vue
   <div
     class="avatar-circle"
     style="background-image: url('https://ruta.de/tu/imagen.jpg')"
   />
   ```

El resto de estilos (borde circular, sombra, tamaño) ya están definidos en `.avatar-circle` y no necesitas tocarlos si solo quieres cambiar la foto.

- **Nuevos tests**:
  - Crea nuevos archivos en `tests/unit/` y monta los componentes con `@vue/test-utils`.

Con esto tienes una base sólida para seguir evolucionando MentiPremios con nuevas funcionalidades “top”.

