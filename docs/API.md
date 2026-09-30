# API de MentiPremios — Firestore y acceso del cliente

## Modelo de datos (Firestore)

El proyecto utiliza **Firebase Firestore** con tres colecciones, y el navegador accede a ellas **directamente**: no hay servidor, ni Cloud Functions, ni Firebase Auth, ni App Check obligatorio. La API que consume la aplicación son dos operaciones del SDK de cliente, implementadas en `src/infrastructure/firebase/firestoreSurveyRepository.ts`, y el contrato de seguridad lo impone `firestore.rules`, que cierra con una regla comodín `/{document=**}` cualquier colección que no esté declarada.

Un documento que no encaja con lo esperado no es «un documento raro»: para la aplicación es un documento inexistente. `parseInvitation` en el repositorio devuelve `null` si falta `nombre` o si `usado` no es un booleano, y el caso de uso lo traduce al mismo error que un `null` de verdad.

---

### Colección `codigos`

Control de acceso. Cada documento es una invitación de una persona.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Palabra secreta normalizada (`trim()` + `toLowerCase()`, sin `/`) |
| `nombre` | `string` | Nombre de la persona; no puede estar vacío ni ser solo espacios |
| `usado` | `boolean` | `false` = disponible, `true` = ya respondió |

**Ejemplo en Firebase Console:**
```
codigos/
  └── secreto-de-sergio/
        ├── nombre: "Sergio"
        └── usado: false
```

> No hay ningún campo más. Estas dos columnas son el contrato completo: el cliente nunca escribe aquí, salvo el paso de `usado` a `true`.

---

### Colección `respuestas`

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | **El mismo ID de la invitación.** Es lo que impide sobrescribir un envío anterior |
| `schemaVersion` | `number` | `2` |
| `participantName` | `string` | Nombre visible; copiado de la invitación, no del cliente |
| `answers` | `map` | ID de pregunta → ID de opción, exactamente 10 entradas del catálogo |
| `createdAt` | `timestamp` | `serverTimestamp()` |
| `submittedAt` | `timestamp` | `serverTimestamp()` |

**Ejemplo:**
```
respuestas/secreto-de-sergio {
  schemaVersion: 2,
  participantName: "Sergio",
  answers: { tonto: "tonto-1", casper: "casper-3" /* ... */ },
  createdAt: Timestamp,
  submittedAt: Timestamp
}
```

Las reglas exigen que `create` lleve **exactamente** esas cinco claves (`request.resource.data.keys().hasOnly([...])`). Un campo de más hace que la escritura se rechace, y una clave de menos también.

El nombre de la persona se copia desde la invitación dentro de la transacción: la invitación es la única fuente autorizada, y así el cliente no puede escribir el nombre de otra persona aunque manipule el DOM.

> **El documento no guarda el código secreto en ningún campo, pero su identificador es la palabra secreta.** Es aceptable precisamente porque `respuestas` no admite `list`: sin enumeración, nadie puede recorrer los identificadores. Si algún día se permitiera listar esa colección, este diseño dejaría de ser seguro.

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

## Operaciones del cliente

Dos, y solo dos. Las expone `FirestoreSurveyRepository`, que implementa el contrato `SurveyStore`:

```typescript
interface SurveyStore {
  findInvitation(id: string): Promise<StoredInvitation | null>;
  saveSurvey(response: SurveyResponseRecord): Promise<SaveSurveyOutcome>;
}
```

### `findInvitation(id)`

**Entrada** — un `string`: la palabra secreta ya normalizada.

| Regla | Detalle |
|---|---|
| Normalización | `trim()` + `toLowerCase()` en `validateInvitation`, antes de llamar al repositorio |
| Vacío | Un secreto vacío o solo espacios se rechaza sin preguntar a Firestore |
| Forma del documento | `nombre` debe ser un `string` no vacío y `usado` un `boolean` |

**Operación** — `getDoc(doc(db, 'codigos', id))`.

**Salida** — la invitación (`{ id, nombre, usado }`) o `null` si no existe o si el documento no encaja. Nunca devuelve el documento completo ni el resto de campos.

> **No hay ninguna consulta en todo el repositorio.** Ni `getDocs`, ni `query`, ni `where`. Una consulta sobre `codigos` sería un `list`, y `list` está prohibido en las reglas. `tests/unit/contracts/repositoryContracts.spec.ts` lo fija leyendo el fuente, porque la consulta no fallaría en los tests: fallaría en producción, en la casa de quien participa.

### `saveSurvey(response)`

**Entrada** — `{ invitationId, participantName, answers }`.

**Transacción** — `runTransaction` sobre `db`:

1. Lee `codigos/{invitationId}` dentro de la transacción.
2. Si no existe, o si el documento no encaja → `'not-found'`.
3. Si `usado === true` → `'already-used'`, sin escribir nada.
4. Si no, escribe `respuestas/{invitationId}` con `schemaVersion: 2`, `participantName` tomado de la invitación y los dos `serverTimestamp()`.
5. Actualiza `codigos/{invitationId}` con `{ usado: true }`.

Las dos escrituras son atómicas. No existe un estado en el que el voto esté guardado y la invitación libre.

**Salida** — `'saved' | 'already-used' | 'not-found'`.

Se devuelven como **dato y no como excepción** a propósito: los tres son resultados esperables, no fallos. El repositorio no decide qué ve la persona; eso es tarea de la capa de aplicación.

> **Sobre la idempotencia.** El esquema ya no usa un `responseId` ni compara respuestas: la unicidad la garantiza la propia regla. Como el documento de respuesta se identifica con el mismo ID que la invitación y `update` está prohibido, un reintento choca contra las reglas en lugar de duplicar o sobrescribir. Quien ya respondió recibe «invitación ya usada», que la aplicación trata como acierto (ver [RECOVERY.md](RECOVERY.md)).

---

## Traducción a errores de aplicación

La interfaz (`AppServices`) no cambia: recibe errores de dominio, no códigos de Firestore. La traducción vive en `createAppServices` (`src/app/bootstrap.ts`):

| Resultado | Error de aplicación | Qué ve la persona |
|---|---|---|
| `not-found` (validación) | `InvalidInvitationError` | «La palabra secreta es incorrecta» |
| Invitación con `usado: true` | `InvitationAlreadyUsedError` | «Ya has respondido a la encuesta» |
| `not-found` (envío) | `InvalidInvitationError` | «La palabra secreta es incorrecta» |
| `already-used` (envío) | `InvitationAlreadyUsedError` | Confirmación: las respuestas ya estaban guardadas |
| Excepción del SDK | `PersistenceError`, y luego `classifyNetworkError` | Mensaje de red con opción de reintentar |

`not-found` se colapsa en «palabra incorrecta» a propósito: distinguir «el código no existe» de «el código es incorrecto» solo ayudaría a quien está probando códigos ajenos.

Lo que llega desde Firestore entra por `classifyNetworkError` (`src/features/survey/application/networkError.ts`), que clasifica en cinco tipos —`offline`, `timeout`, `permission`, `unavailable`, `unknown`— contra conjuntos cerrados de códigos del SDK. `permission-denied` es el caso relevante aquí: significa que la operación no encaja con las reglas, y es reintentable solo si el despliegue de reglas cambia.

---

## Reglas de seguridad

`firestore.rules` es la frontera de confianza del proyecto. Resumen operativo:

| Ruta | Operaciones permitidas |
|---|---|
| `codigos/{invitationId}` | `get` · `update` solo `false → true` en `usado`, y solo ese campo |
| `respuestas/{responseId}` | `create` con exactamente las cinco claves del esquema |
| `palabrasClave/{entryId}` | `create` |
| `/{document=**}` | ninguna |

La idea que sostiene el modelo está en el par `get` / `list` de `codigos`: **se puede leer una invitación concreta si ya se conoce el identificador —la palabra secreta—, pero nunca se puede enumerar la colección.** Sin enumeración no se pueden descubrir las palabras del resto de participantes ni quién ha contestado ya.

> **La consola de Firebase sí puede ver la colección entera.** Opera con permisos de administrador del proyecto y no le afectan estas reglas, que gobiernan a los clientes del SDK. Organizar la gala mirando quién ha respondido sigue siendo posible.

---

## Repositorio opcional de palabras clave

Esta funcionalidad no forma parte del flujo de encuesta. `FirestoreKeywordsRepository` conserva el contrato en infraestructura para un uso futuro; su escritura es un `addDoc` directo y las reglas solo le permiten `create`, así que nunca podrá leer ni modificar lo que ya ha escrito.

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
