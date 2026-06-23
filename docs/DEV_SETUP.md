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
| `npm test` | Ejecuta tests en modo watch |
| `npm test -- --run` | Ejecuta tests una sola vez (modo CI) |
| `npm run test:ui` | Abre Vitest UI (dashboard interactivo) |
| `npm run lint` | Ejecuta ESLint en `src/` |

---

## Estructura del proyecto

```
src/
├── App.vue                  # Componente principal (wizard completo)
├── main.ts                  # Punto de entrada de la app
├── firebase.ts              # Inicialización de Firebase
├── style.css                # Estilos globales
├── vue-shim.d.ts            # Tipos para archivos .vue
├── assets/                  # Imágenes y vídeos
│   ├── foto-amigos.jpg
│   └── mensaje-1.jpg
└── services/
    └── premiosService.ts    # Acceso a Firestore

tests/unit/
├── App.spec.ts              # Tests del componente App
└── premiosService.spec.ts   # Tests del servicio
```

---

## Ejecutar tests

```bash
# Una sola ejecución
npm test -- --run

# Modo watch (re-ejecuta al cambiar archivos)
npm test

# Con interfaz gráfica
npm run test:ui
```

### Tests existentes

**`tests/unit/App.spec.ts`** — Tests de integración del wizard:
- Login: renderizado inicial, input, botón habilitado/deshabilitado, errores de palabra incorrecta y ya usada
- Welcome: muestra el nombre del usuario
- Questions: renderizado de opciones, selección, progreso, navegación siguiente/anterior, guardado al completar, pantalla de gracias
- Visor de foto: apertura y cierre del modal

**`tests/unit/premiosService.spec.ts`** — Tests unitarios del servicio:
- Guardar respuestas con `setDoc`
- Obtener código por palabra secreta
- Marcar código como usado

### Mocking

- `App.spec.ts` mockea todo el módulo `premiosService` con `vi.mock`
- `premiosService.spec.ts` mockea `firebase/firestore` y el módulo `firebase.ts`

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

En `src/App.vue:37-146`, añade un nuevo objeto al array `preguntas`:

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

1. Añade constantes en `src/services/premiosService.ts` (ej: `const NUEVA_COLECCION = 'nuevaColeccion'`)
2. Crea funciones con `addDoc`, `getDocs`, `setDoc`, etc.
3. Exporta las funciones (con y sin alias en español)

### Cambiar la imagen del avatar

Reemplaza `src/assets/foto-amigos.jpg` por otra imagen con el mismo nombre, o cambia la URL en la clase `.avatar-circle` en `src/App.vue:625` y `src/style.css:90`.
