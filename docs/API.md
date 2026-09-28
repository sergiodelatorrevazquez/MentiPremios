# API de MentiPremios — Cloud Functions y Firestore

## Modelo de datos (Firestore)

El proyecto utiliza **Firebase Firestore** con tres colecciones. El navegador usa autenticación anónima y App Check para invocar Cloud Functions; las reglas no permiten acceso Firestore directo desde el cliente.

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

Respuestas a las preguntas de la encuesta. El esquema actualmente desplegado es legado; los documentos nuevos pasarán al esquema versionado descrito en TODO-040 a TODO-042.

| Campo | Tipo | Descripción |
|---|---|---|
| **Document ID** | `string` | Actualmente el código de invitación; el nuevo esquema usa un ID aleatorio |
| Campos actuales | `string` | Un campo por pregunta, con el ID de la opción seleccionada |

**Ejemplo:**
```
respuestas/{codigo-de-invitacion} {
  tonto: "tonto-1",
  casper: "casper-3",
  // ... los diez campos de pregunta
}
```

El esquema actual no persiste nombre del participante, código de invitación como campo ni marcas de tiempo. No confundirlo con el DTO de entrada de la callable, que usa `{ invitationId, answers }`.

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

Las operaciones de invitación y envío se ejecutan en Cloud Functions callable. Todas requieren Firebase Authentication y App Check.

### `validateInvitation`

Entrada: `{ secret: string }`. El servidor normaliza el código, comprueba que la invitación exista y no esté usada, y devuelve únicamente `{ participantName: string }`. El documento y su ID no se exponen al cliente.

### `submitSurvey`

Entrada: `{ invitationId: string, answers: Record<QuestionId, OptionId> }`. El servidor vuelve a validar la invitación y persiste la respuesta y el estado de uso dentro de una transacción. Los reintentos idénticos son idempotentes; uno conflictivo se rechaza.

## Repositorio opcional de palabras clave

Esta funcionalidad no forma parte del flujo de encuesta ni se expone al navegador. `FirestoreKeywordsRepository` conserva el contrato en infraestructura para un futuro uso server-side; las reglas actuales bloquean escrituras directas del cliente.

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
