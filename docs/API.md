# API de MentiPremios — Cloud Functions y Firestore

## Modelo de datos (Firestore)

El proyecto utiliza **Firebase Firestore** con tres colecciones. El navegador usa autenticación anónima y App Check para invocar Cloud Functions; `firestore.rules` deniega toda lectura y escritura directa, incluidas las colecciones que no están declaradas, mediante una regla comodín final.

Las tres collections siguen el patrón de validar en dos sitios: el documento se parsea con un esquema (`functions/src/firestoreSchemas.ts`) y la petición se valida en el handler. Un documento que no encaja no es «un documento raro», es un documento inexistente para el servidor.

---

### Colección `codigos`

Control de acceso. Cada documento es una invitación de una persona.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Palabra secreta normalizada (`trim()` + `toLowerCase()`, máx. 128 caracteres, sin `/`) |
| `nombre` | `string` | Nombre de la persona; no puede estar vacío ni ser solo espacios |
| `usado` | `boolean` | `false` = disponible, `true` = ya respondió |
| `responseId` | `string?` | ID del documento de respuesta; lo escribe el servidor al enviar. Máx. 150 caracteres, sin `/` |

**Ejemplo en Firebase Console:**
```
codigos/
  └── secreto-de-sergio/
        ├── nombre: "Sergio"
        ├── usado: false
        └── responseId: "kQ7fZ2mXpR4t"   ← solo después de responder
```

`responseId` es lo que hace idempotente el reintento: sin él, un reenvío no tendría forma de distinguir «ya guardado» de «nunca guardado».

---

### Colección `respuestas`

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | ID opaco generado por el servidor; en documentos legacy es el propio código |
| `schemaVersion` | `number` | `2` para documentos nuevos; **ausente** en documentos legacy (se infieren por v1) |
| `participantName` | `string` | Nombre visible; no puede estar vacío |
| `answers` | `map` | ID de pregunta → ID de opción, exactamente 10 entradas de la allowlist |
| `createdAt` | `timestamp` | `FieldValue.serverTimestamp()` |
| `submittedAt` | `timestamp` | `FieldValue.serverTimestamp()` |

**Ejemplo:**
```
respuestas/{id-aleatorio} {
  schemaVersion: 2,
  participantName: "Sergio",
  answers: { tonto: "tonto-1", casper: "casper-3" /* ... */ },
  createdAt: Timestamp,
  submittedAt: Timestamp
}
```

Los documentos v2 deben tener **exactamente** esas cinco claves: un campo extra hace que el documento se lea como inválido. Los legacy no llevan versión, se leen por la forma plana y no se reescriben.

El nombre de la persona se copia desde la invitación, no desde el cliente: es la invitación la única fuente autorizada, y así el DTO remoto no necesita transportar el nombre.

---

### Colección `palabrasClave`

Palabras clave opcionales asociadas a usuarios. La funcionalidad existe en `FirestoreKeywordsRepository` pero **no se usa en la UI actual**.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Auto-generado por Firestore (`addDoc`) |
| `usuario` | `string` | Nombre de la persona |
| `palabrasClave` | `string[]` | Array de palabras clave |
| `createdAt` | `timestamp` | Marca de tiempo del servidor |

---

## Cloud Functions

Las operaciones de invitación y envío se ejecutan en Cloud Functions callable, región `us-central1`. Ambas exigen `enforceAppCheck: true` y reciben el usuario de la autenticación anónima; un `HttpsError` con `unauthenticated` es la respuesta cuando falta.

### `validateInvitation`

**Entrada** — `{ secret: string }`:

| Regla | Detalle |
|---|---|
| Tipo | `string`; el resto de formas se rechaza con `invalid-argument` |
| Normalización | `trim()` + `toLowerCase()`, idéntica a la del cliente |
| Longitud | Entre 1 y 128 caracteres |
| Separadores | No puede contener `/` |

**Salida** — `{ participantName: string }`. El ID del documento y el resto de campos no se exponen nunca.

### `submitSurvey`

**Entrada** — `{ invitationId: string, answers: Record<QuestionId, OptionId> }`:

| Regla | Detalle |
|---|---|
| Claves | Exactamente dos: `invitationId` y `answers`. Cualquier clave extra se rechaza |
| Tamaño | El JSON serializado no puede superar 4096 bytes (`MAX_SUBMISSION_BYTES`) |
| `invitationId` | `string` de 1 a 128 caracteres, sin espacios en los extremos y sin `/` |
| `answers` | Exactamente 10 entradas, una por cada pregunta, todas de la allowlist `SURVEY_OPTION_IDS` |

La allowlist vive en `functions/src/surveySchema.ts` y no se deriva del catálogo del cliente. Es la que impide que alguien envíe una respuesta arbitraria con `curl` sin pasar por la interfaz.

**Salida** — `{ submitted: true }`.

**Transacción.** Todo ocurre dentro de una `runTransaction`: se lee la invitación, se escribe la respuesta con `create` y se marca la invitación con `update { usado: true, responseId }`. Las dos escrituras pasan o no pasan juntas, así que no existe un estado en el que la respuesta esté guardada y la invitación libre.

**Idempotencia.** Un reintento idéntico devuelve `{ submitted: true }` sin escribir nada. Un reintento con respuestas distintas recibe `failed-precondition`. Es exactamente lo que permite tratar la invitación consumida como acierto después de un fallo de red (`docs/RECOVERY.md`).

---

## Códigos de error

El servidor devuelve `HttpsError`; el cliente los ve como `functions/<código>`. La columna de la derecha es la traducción en `src/app/bootstrap.ts` y, cuando no hay traducción, en `classifyNetworkError`.

| Código | Callable | Cuándo ocurre | Qué hace el cliente |
|---|---|---|---|
| `unauthenticated` | Ambas | Sin sesión anónima activa | `classifyNetworkError` → `permission` |
| `invalid-argument` | Ambas | DTO inválido: tipo, longitud, `/`, claves de más, tamaño, allowlist | `validateInvitation` → `InvalidInvitationError`; en `submitSurvey` → `classifyNetworkError` → `permission` |
| `not-found` | Ambas | La invitación no existe o su documento no encaja en el esquema | `validateInvitation` → `InvalidInvitationError`; en `submitSurvey` → `classifyNetworkError` → `permission` |
| `failed-precondition` | Ambas | Invitación ya usada, o reintento con respuestas distintas | `validateInvitation` → `InvitationAlreadyUsedError`; en `submitSurvey` se trata como **acierto** |
| `internal` | Ambas | Cualquier fallo inesperado en el servidor | `classifyNetworkError` → `unavailable` |
| `deadline-exceeded` | Implícito | Cloud Functions agota su plazo | `classifyNetworkError` → `timeout` |
| `unavailable` | Implícito | Backend no disponible | `classifyNetworkError` → `unavailable` |

`invalid-argument` y `not-found` se colapsan en el mismo error de cliente a propósito: distinguir «el código no existe» de «el código es incorrecto» solo ayudaría a quien está probando códigos ajenos.

El mensaje que ve la persona sale de `classifyNetworkError`, no del texto del servidor. Los textos de `HttpsError` están en inglés y sirven para los logs.

---

## Repositorio opcional de palabras clave

Esta funcionalidad no forma parte del flujo de encuesta ni se expone al navegador. `FirestoreKeywordsRepository` conserva el contrato en infraestructura para un futuro uso server-side; las reglas actuales bloquean escrituras directas del cliente.

---

## Preguntas de la encuesta (definidas en `src/features/survey/domain/questions.ts`)

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

**Nota**: las opciones multimedia se resuelven con `import.meta.glob` de Vite desde `src/features/survey/domain/multimediaRegistry.ts`. En el repositorio solo existe `mensaje-1.jpg`; el resto de archivos (`mensaje-2..4.jpg`, `foto-1..4.jpg`, `video-1..4.mp4`) **no están** y por eso las opciones correspondientes caen en el marcador `/media-unavailable.svg` con el sufijo «(recurso no disponible)» en su texto alternativo. Abrir cualquiera de esos visores incrementa `multimedia_failed`, que es la forma de detectar el hueco desde el propio producto. Al añadir un archivo, el registro lo encuentra solo en el siguiente build, sin tocar código.
