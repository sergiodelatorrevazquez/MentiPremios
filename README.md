# 🏆 MentiPremios

**MentiPremios** — *"Sin Mentirosas no hay Traidores"*

Aplicación web para gestionar los premios anuales del grupo de amigos. Cada persona recibe una palabra secreta, responde a 10 preguntas con los candidatos de cada categoría, y todo se guarda en Firebase para la gala final.

---

## ✨ Funcionalidades

- **Acceso por palabra secreta** — cada participante tiene una clave única e intransferible
- **10 categorías de premios** — desde "Tonto del Año" hasta "Correa del Año" (con sorpresa)
- **Soporte multimedia** — imágenes y vídeos en las opciones con visor a pantalla completa
- **Progreso visual** — barra de progreso y navegación entre preguntas
- **Respuesta única** — cada palabra secreta solo puede usarse una vez
- **Persistencia en Firebase** — todos los votos se guardan en Firestore

## 🚀 Demo

```bash
npm run dev
```

Abre `http://localhost:5173` e introduce una palabra secreta que hayas creado en Firestore.

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

Crea un archivo `.env.local` con tus credenciales de Firebase:

```bash
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
```

Luego, crea al menos un código de invitación en la consola de Firebase (colección `codigos`):

```
codigos/
  └── palabra-de-prueba/
        ├── nombre: "Usuario de prueba"
        └── usado: false
```

```bash
npm run dev
```

## 📖 Documentación

| Documento | Descripción |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, flujo de datos y decisiones técnicas |
| [docs/API.md](docs/API.md) | Modelo de datos Firestore y referencia del servicio |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Guía de uso para participantes |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Despliegue en producción (Vercel, Netlify, Firebase) |
| [docs/DEV_SETUP.md](docs/DEV_SETUP.md) | Configuración del entorno de desarrollo |

## 🧪 Tests

```bash
npm test -- --run       # Una ejecución
npm test                # Modo watch
npm run test:ui         # Dashboard interactivo
```

## 🔧 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Vista previa de la build |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios |

## 🏗️ Estructura del proyecto

```
src/
├── App.vue                  # Wizard completo (4 pasos)
├── main.ts                  # Bootstrap de Vue
├── firebase.ts              # Inicialización Firebase
├── style.css                # Estilos globales
├── vue-shim.d.ts            # Tipos .vue
├── assets/                  # Imágenes y vídeos
└── services/
    └── premiosService.ts    # Capa de acceso a Firestore
```

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Haz tus cambios y ejecuta `npm run lint && npm test -- --run`
4. Envía un pull request

## 📄 Licencia

Este proyecto es de uso privado para el grupo de amigos.
