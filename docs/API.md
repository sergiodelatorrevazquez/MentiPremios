# API de MentiPremios — Firestore y Servicios

## Modelo de datos (Firestore)

El proyecto utiliza **Firebase Firestore** con 3 colecciones. No se requiere autenticación de usuarios — el acceso se controla mediante palabras secretas.

---

### Colección `codigos`

Control de acceso. Cada documento es una invitación de una persona.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Palabra secreta única (ej: `galaxia-2025`, `mvp-sergio-2025`) |
| `nombre` | `string` | Nombre de la persona (se muestra en la bienvenida) |
| `usado` | `boolean` | `false` = disponible, `true` = ya respondió |

**Ejemplo en Firebase Console:**
```
codigos/
  └── secreto-de-sergio/
        ├── nombre: "Sergio"
        └── usado: false
```

---

### Colección `respuestas`

Respuestas a las preguntas de la encuesta.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Nombre de usuario (se copia del campo `nombre` de `codigos`, normalizado) |
| `usuario` | `string` | Nombre de la persona |
| `premios` | `map` | Clave = ID de pregunta, Valor = ID de opción seleccionada |
| `createdAt` | `timestamp` | Marca de tiempo del servidor (Firebase `serverTimestamp`) |

**Ejemplo:**
```
respuestas/
  └── SERGIO2024/
        ├── usuario: "Sergio"
        ├── premios: {
        │     tonto: "tonto-1",
        │     casper: "casper-3",
        │     comefeas: "comefeas-2",
        │     soltero: "soltero-4",
        │     anecdata: "anecdota-5",
        │     meme: "meme-1",
        │     mensaje: "mensaje-2",
        │     foto: "foto-3",
        │     video: "video-1",
        │     correa: "correa-2"
        │   }
        └── createdAt: March 15, 2025 at 10:30:00 PM UTC-5
```

---

### Colección `palabrasClave`

Palabras clave opcionales asociadas a usuarios. La funcionalidad existe en el servicio pero **no se usa en la UI actual**.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Auto-generado por Firestore (`addDoc`) |
| `usuario` | `string` | Nombre de la persona |
| `palabrasClave` | `string[]` | Array de palabras clave |
| `createdAt` | `timestamp` | Marca de tiempo del servidor |

---

## Servicio: `src/services/premiosService.ts`

Todas las funciones están definidas con nombres en inglés y exportadas también con alias en español.

### `saveUserAnswer(payload)`
**Alias**: `guardarRespuestaUsuario`

```typescript
async function saveUserAnswer(payload: PremioRespuesta): Promise<void>

interface PremioRespuesta {
  usuario: string;              // nombre de usuario (se usa como document ID)
  premios: Record<string, string>;  // { preguntaId: opcionId }
}
```

**Operación Firestore**: `setDoc(doc(db, 'respuestas', payload.usuario), payload.premios)`

**Uso**:
```typescript
await guardarRespuestaUsuario({
  usuario: 'SERGIO2024',
  premios: { tonto: 'tonto-1', casper: 'casper-3' },
});
```

---

### `saveUserKeywords(payload)`
**Alias**: `guardarPalabrasClaveUsuario`

```typescript
async function saveUserKeywords(payload: PalabraClavePayload): Promise<void>

interface PalabraClavePayload {
  usuario: string;
  palabrasClave: string[];
}
```

**Operación Firestore**: `addDoc(collection(db, 'palabrasClave'), { ...payload, createdAt: serverTimestamp() })`

**Uso**:
```typescript
await guardarPalabrasClaveUsuario({
  usuario: 'Sergio',
  palabrasClave: ['divertido', 'leal', 'fiestero'],
});
```

---

### `getCodeBySecretWord(secretWord)`
**Alias**: `obtenerCodigoPorPalabraSecreta`

```typescript
async function getCodeBySecretWord(
  secretWord: string
): Promise<(CodigoInvitacion & { id: string }) | null>

interface CodigoInvitacion {
  nombre: string;
  usado: boolean;
}
```

**Operación Firestore**: `getDoc(doc(db, 'codigos', secretWord))`

**Retorna**:
- `{ id, nombre, usado }` si el documento existe
- `null` si el documento no existe

**Uso**:
```typescript
const codigo = await obtenerCodigoPorPalabraSecreta('secreto-de-sergio');
if (!codigo) {
  // Palabra incorrecta
} else if (codigo.usado) {
  // Ya respondió
} else {
  // Acceso concedido
}
```

---

### `markCodeAsUsed(secretWord)`
**Alias**: `marcarCodigoComoUsado`

```typescript
async function markCodeAsUsed(secretWord: string): Promise<void>
```

**Operación Firestore**: `updateDoc(doc(db, 'codigos', secretWord), { usado: true })`

**Uso**:
```typescript
await marcarCodigoComoUsado('secreto-de-sergio');
```

---

## Manejo de errores

Todas las funciones envuelven llamadas a Firestore en try/catch. Los errores se transforman en `FirestoreServiceError` (`src/services/premiosService.ts:28-36`):

```typescript
export class FirestoreServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'FirestoreServiceError';
  }
}
```

El `code` contiene el código de error de Firestore (ej: `unavailable`, `not-found`, `permission-denied`).

---

## Preguntas de la encuesta (definidas en `src/App.vue:37-146`)

| ID | Título | Opciones | Multimedia |
|---|---|---|---|
| `tonto` | Tonto del Año | Miguel, Pablo, Dani, Maroto | — |
| `casper` | Casper del Año | Raúl, Jorge, Dani, Jose Álvaro, Pablo, Víctor | — |
| `comefeas` | Comefeas del Año | Fran, Maroto, Dani, Enrique | — |
| `soltero` | Soltero del Año | Sergio Reyes, Ale, Maroto, Dani | — |
| `anecdota` | Anécdota del Año | 6 opciones de momentos del grupo | — |
| `meme` | Meme del Año | 8 opciones de memes internos | — |
| `mensaje` | Mensaje del Año | 4 capturas de mensaje | Imagen (pulsación larga para detalle) |
| `foto` | Foto del Año | 4 fotos | Imagen (pulsación larga para detalle) |
| `video` | Video del Año | 4 videos | Video (pulsación larga para detalle) |
| `correa` | Correa del Año | 4 × Miguel (broma) | — |

**Nota**: Las opciones multimedia se cargan con `import.meta.glob` de Vite. Solo `mensaje-1.jpg` existe actualmente en `src/assets/`. El resto de archivos (`mensaje-2..4.jpg`, `foto-1..4.jpg`, `video-1..4.mp4`) deben añadirse para que las opciones funcionen correctamente.
