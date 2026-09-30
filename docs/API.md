# API de MentiPremios — Firestore y acceso del cliente

## Modelo de datos (Firestore)

El proyecto utiliza **Firebase Firestore** y el navegador accede a él **directamente**: no hay servidor, ni Cloud Functions, ni Firebase Auth, ni App Check obligatorio. Hay **una sola colección**, `codigos`, con un documento por persona. La API que consume la aplicación son dos operaciones del SDK de cliente, implementadas en `src/infrastructure/firebase/firestoreSurveyRepository.ts`, y el contrato de seguridad lo impone `firestore.rules`, que cierra con una regla comodín `/{document=**}` cualquier colección que no esté declarada.

Un documento que no encaja con lo esperado no es «un documento raro»: para la aplicación es un documento inexistente. `parseInvitation` en el repositorio devuelve `null` si el documento no es un objeto o si `voted` no es un `boolean`, y el caso de uso lo traduce al mismo error que un `null` de verdad. Ya no valida ningún otro campo, porque ya no hay ningún otro campo: el documento no guarda datos sobre la persona aparte del identificador.

---

### Colección `codigos`

Control de acceso. Cada documento es una persona, y **ese mismo documento guarda también su voto** cuando responde. No hay una segunda colección de respuestas.

| Campo | Tipo | Cuándo existe | Descripción |
|---|---|---|---|
| **Document ID** | `string` | siempre | Palabra secreta normalizada (`trim()` + `toLowerCase()`, sin `/`) |
| `voted` | `boolean` | siempre | `false` = disponible, `true` = ya respondió |
| `<pregunta>` | `string` | solo tras votar | ID de la opción elegida, con la forma `<pregunta>-<n>` (`tonto-1`, `casper-3`…) |

Los diez campos de pregunta son exactamente los del catálogo: `tonto`, `casper`, `comefeas`, `soltero`, `anecdota`, `meme`, `mensaje`, `foto`, `video` y `correa`. Coinciden con `QUESTION_IDS` en `src/features/survey/domain/survey.types.ts`, y `tests/unit/contracts/firestoreRules.spec.ts` es el test de contrato que falla si se añade una pregunta y no se añade a la lista blanca de `firestore.rules`.

**Antes de votar, en Firebase Console:**
```
codigos/pitufo {
  voted: false
}
```

**Después de votar, en ese mismo documento:**
```
codigos/og {
  voted: true,
  tonto: "tonto-1",
  casper: "casper-6",
  ...las otras ocho
}
```

> **No hay ningún dato sobre la persona.** El campo `nombre` ya no existe y nada lo sustituye: el identificador del documento *es* quien responde, y tanto la pantalla de bienvenida como la de confirmación lo muestran tal cual. `WelcomeStep.vue` y `CompletionStep.vue` reciben un prop `codigo: string` —antes el nombre de la persona— que hoy lleva el identificador; el prop es deliberadamente neutro, así que más adelante se puede pasar un saludo personalizado por identificador sin tocar los componentes.

> **Lo que ya no existe.** El documento ya no lleva ningún campo con datos de la persona: ni nombre, ni versión del esquema, ni marcas de tiempo de creación o de envío. Tampoco hay colección de respuestas aparte ni mapa anidado de respuestas: el voto se escribe plano, un campo por pregunta, dentro de la invitación. El único booleano es `voted`.

> **El identificador del documento es la palabra secreta, y sigue siendo aceptable** precisamente porque `codigos` no admite `list`: sin enumeración, nadie puede recorrer los identificadores. Si algún día se permitiera listar esa colección, este diseño dejaría de ser seguro.

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
| Forma del documento | `voted` tiene que ser un `boolean`; no se valida ningún otro campo |

**Operación** — `getDoc(doc(db, 'codigos', id))`.

**Salida** — la invitación (`{ id, voted }`) o `null` si no existe o si el documento no encaja. Nunca devuelve el resto de campos del documento.

Los tipos que viajan por aquí son deliberadamente mínimos: `CodigoInvitacion` es `{ voted }`, y `StoredInvitation` en el repositorio e `InvitationRecord` en el caso de uso `validateInvitation` son `{ id, voted }`. `validateInvitation` lanza `InvitationAlreadyUsedError` si `voted === true`.

> **No hay ninguna consulta en todo el repositorio.** Ni `getDocs`, ni `query`, ni `where`. Una consulta sobre `codigos` sería un `list`, y `list` está prohibido en las reglas. `tests/unit/contracts/repositoryContracts.spec.ts` lo fija leyendo el fuente, porque la consulta no fallaría en los tests: fallaría en producción, en la casa de quien participa.

### `saveSurvey(response)`

**Entrada** — `{ invitationId, answers }`. No hay ningún dato más en el payload: la persona ya la identifica el id del documento, así que solo van las respuestas.

**Transacción** — `runTransaction` sobre `db`:

1. Lee `codigos/{invitationId}` dentro de la transacción.
2. Si no existe, o si el documento no encaja → `'not-found'`.
3. Si `voted === true` → `'already-used'`, sin escribir nada.
4. Si no, hace **una sola escritura**: `transaction.update(invitationRef, { voted: true, ...answers })`.

No hay documento aparte ni segunda escritura, así que no puede quedar medio guardado: o se escriben las diez respuestas y `voted` pasa a `true`, o no se escribe nada. Por eso `docs/RECOVERY.md` puede tratar «invitación ya votada» durante el envío como prueba de que las respuestas están a salvo.

**Salida** — `'saved' | 'already-used' | 'not-found'`.

Se devuelven como **dato y no como excepción** a propósito: los tres son resultados esperables, no fallos. El repositorio no decide qué ve la persona; eso es tarea de la capa de aplicación.

> **Sobre la idempotencia.** La unicidad la garantiza la propia regla, no una comparación de contenidos: `update` solo se admite cuando `voted` pasa de `false` a `true`, así que un segundo envío choca contra las reglas en lugar de duplicar o sobrescribir. Quien ya respondió recibe «invitación ya utilizada», que la aplicación trata como acierto (ver [RECOVERY.md](RECOVERY.md)).

---

## Traducción a errores de aplicación

La interfaz (`AppServices`) no cambia: recibe errores de dominio, no códigos de Firestore. La traducción vive en `createAppServices` (`src/app/bootstrap.ts`):

| Resultado | Error de aplicación | Qué ve la persona |
|---|---|---|
| `not-found` (validación) | `InvalidInvitationError` | «La palabra secreta es incorrecta» |
| Invitación con `voted: true` | `InvitationAlreadyUsedError` | «Ya has respondido a la encuesta» |
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
| `codigos/{invitationId}` | `get` · `update` solo `false → true` en `voted`, y solo los once campos de la lista blanca |
| `palabrasClave/{entryId}` | `create` |
| `/{document=**}` | ninguna |

`list`, `create` y `delete` están negadas en `codigos`: las invitaciones las crea el organizador desde la consola, no un navegador.

La condición de `update` es doble, y las dos mitades importan. La primera es la dirección: `resource.data.voted == false && request.resource.data.voted == true`, que hace imposible devolver una invitación a sin votar. La segunda es el alcance, con `diff`:

```rules
request.resource.data.diff(resource.data).affectedKeys().hasOnly([
  'voted', 'tonto', 'casper', 'comefeas', 'soltero', 'anecdota',
  'meme', 'mensaje', 'foto', 'video', 'correa',
])
```

Esa lista blanca es lo que impide escribir un campo inventado —o tocar cualquier dato sobre la persona, porque ya no hay ninguno—, y tiene que coincidir con `QUESTION_IDS` de `src/features/survey/domain/survey.types.ts`: si se añade una pregunta al catálogo y no a la lista, el voto se guardaría y las reglas lo rechazarían. `tests/unit/contracts/firestoreRules.spec.ts` comprueba esa coincidencia.

La idea que sostiene el modelo está en el par `get` / `list` de `codigos`: **se puede leer una invitación concreta si ya se conoce el identificador —la palabra secreta—, pero nunca se puede enumerar la colección.** Sin enumeración no se pueden descubrir las palabras del resto de participantes ni quién ha contestado ya.

> **El coste consciente de una sola colección: leer a un amigo devuelve también sus respuestas.** El `get` que hace el login no distingue entre una invitación sin votar y una ya votada, así que quien conozca la palabra de otra persona obtiene también sus diez respuestas. A cambio hay un único documento por persona, una única escritura al votar y ninguna posibilidad de voto huérfano. Es un intercambio deliberado, y está en [SECURITY.md](SECURITY.md) con su análisis.

> **La consola de Firebase sí puede ver la colección entera.** Opera con permisos de administrador del proyecto y no le afectan estas reglas, que gobiernan a los clientes del SDK. Organizar la gala mirando quién ha votado sigue siendo posible.

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
