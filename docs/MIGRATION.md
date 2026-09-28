# Plan de migracion de MentiPremios

Este documento contiene el backlog para evolucionar MentiPremios desde un monolito funcional hacia un monolito modular.

La migracion debe hacerse de forma incremental. Cada TODO debe dejar la aplicacion funcionando como antes. La estrategia es anadir la nueva estructura, mover la logica gradualmente y eliminar la implementacion antigua solo cuando exista cobertura equivalente.

## Principios de migracion

- Mantener el despliegue como una unica aplicacion.
- Mantener el flujo actual de cuatro pasos: login, bienvenida, preguntas y confirmacion.
- No introducir Vue Router ni Pinia sin una necesidad demostrable.
- Mantener los textos, preguntas y comportamiento visibles salvo que se decida explicitamente cambiarlos.
- Separar dominio, casos de uso, presentacion e infraestructura.
- No permitir que el dominio dependa de Vue o Firebase.
- Validar cada bloque con typecheck, lint, tests y build.
- No eliminar codigo antiguo hasta que el reemplazo este conectado y probado.

## Regla de trabajo

Cada bloque debe seguir este ciclo:

```text
anadir nueva implementacion
-> conectar la nueva implementacion
-> ejecutar typecheck, lint, tests y build
-> verificar el flujo manual
-> eliminar la implementacion antigua
-> volver a validar
```

---

# Fase 0: proteccion del comportamiento actual

## TODO-001. Crear una linea base funcional [COMPLETADO]

Documentar y probar el flujo actual completo:

- Login con palabra secreta valida.
- Palabra incorrecta.
- Codigo ya utilizado.
- Pantalla de bienvenida.
- Navegacion entre preguntas.
- Navegacion hacia atras.
- Seleccion de opciones.
- Envio final.
- Pantalla de confirmacion.
- Visores de imagen y video.

**Condicion:** no modificar la logica existente durante este paso.

Resultado: se documentaron los escenarios en `docs/MIGRATION_BASELINE.md` y se ampliaron las pruebas de `tests/integration/App.spec.ts` para cubrir el flujo completo, la restauracion de respuestas y el visor multimedia.

## TODO-002. Corregir el chequeo de tipos [COMPLETADO]

Anadir el script:

```json
"typecheck": "vue-tsc --noEmit"
```

Corregir los errores actuales de `vi.Mock` en los tests.

**Condicion:** `npm run typecheck` debe pasar antes de iniciar la migracion.

Resultado: se anadio el script `typecheck` y se corrigieron los tipos de los mocks de Vitest en `tests/unit/premiosService.spec.ts`. `npm run typecheck` pasa correctamente.

## TODO-003. Anadir validacion completa a CI [COMPLETADO]

Incorporar a GitHub Actions:

```text
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

**Condicion:** ningun cambio arquitectonico podra integrarse si rompe una de estas validaciones.

Resultado: el workflow `.github/workflows/tests.yml` ejecuta `typecheck`, `lint`, tests y build en cada push o pull request contra `main`.

## TODO-004. Definir criterios de compatibilidad [COMPLETADO]

Documentar que durante la migracion deben conservarse:

- Las rutas existentes.
- El diseno visible.
- Los textos actuales.
- El formato de las preguntas.
- El flujo de cuatro pasos.
- El comportamiento de las invitaciones.
- El contrato de despliegue actual.

Resultado: los criterios quedan definidos en la seccion `Contrato de compatibilidad` de este documento.

## Contrato de compatibilidad

Durante la migracion se pueden cambiar la organizacion interna, los nombres de modulos y la implementacion tecnica siempre que se mantengan estos limites:

### Interfaz y navegacion

- La aplicacion sigue siendo una SPA servida desde la ruta `/`.
- El flujo mantiene cuatro estados visibles: login, bienvenida, preguntas y confirmacion.
- Se conservan los textos funcionales actuales, salvo cambio aprobado expresamente.
- Se conservan los controles actuales: entrada de palabra secreta, avance, retroceso, seleccion de opciones y envio final.
- Se conserva el comportamiento de los visores de foto y multimedia, incluido cierre y pulsacion larga.
- No se introduce una URL publica nueva como requisito para completar una encuesta.

### Encuesta y datos de usuario

- Se mantienen las diez preguntas, sus IDs, el orden y los IDs de sus opciones.
- Los valores almacenados de preguntas y opciones no se renombran durante una migracion estructural.
- Una invitacion valida permite acceder una vez al cuestionario.
- Una invitacion inexistente o ya utilizada sigue mostrando un estado de error comprensible y no permite continuar.
- Una respuesta completada sigue mostrando una confirmacion de exito.

### Persistencia

- Los documentos existentes deben seguir pudiendo leerse mientras se migra el modelo.
- Ningun cambio de esquema puede eliminar o reinterpretar datos existentes sin una estrategia de migracion documentada.
- El contrato legado actual del envio es `{ usuario, premios }` y no se modifica hasta definir un DTO versionado y su adaptacion retrocompatible.
- La migracion no debe cambiar silenciosamente la identificacion de una invitacion ni el significado de `usado`.

### Configuracion y despliegue

- Se mantiene el despliegue como una unica aplicacion.
- Se mantienen Vite, Vue 3, TypeScript y Firebase mientras no exista una decision explicita de sustitucion.
- Se conservan los nombres de las variables `VITE_FIREBASE_*` existentes o se proporciona una migracion compatible.
- Los comandos `npm run dev`, `npm run build`, `npm test -- --run` y `npm run typecheck` deben seguir funcionando.
- La CI debe ejecutar typecheck, lint, tests y build antes de aceptar cambios.

### Criterio de aceptacion por bloque

Un bloque de migracion es compatible cuando:

1. Las pruebas de `docs/MIGRATION_BASELINE.md` siguen pasando.
2. El flujo manual completo conserva sus pantallas y transiciones.
3. Los documentos existentes no requieren una migracion destructiva.
4. Los comandos de validacion definidos en TODO-003 pasan.
5. La documentacion refleja cualquier cambio intencionado de contrato.

---

# Fase 1: contratos y modelo de dominio

## TODO-005. Crear los tipos del dominio [COMPLETADO]

Mover desde `App.vue`:

- `Paso`.
- `Multimedia`.
- `Opcion`.
- `Pregunta`.
- Tipos de respuestas.
- Tipos de invitacion.
- Tipos de envio.

Ubicacion propuesta:

```text
src/features/survey/domain/survey.types.ts
```

**Condicion:** `App.vue` debe seguir funcionando importando los tipos nuevos.

Resultado: se creo `src/features/survey/domain/survey.types.ts`, `App.vue` consume sus tipos y `premiosService.ts` los reexporta temporalmente para mantener compatibilidad con sus consumidores actuales.

## TODO-006. Extraer el catalogo de preguntas [COMPLETADO]

Mover `preguntas` a:

```text
src/features/survey/domain/questions.ts
```

Debe conservar:

- IDs.
- Titulos.
- Opciones.
- Orden.
- Textos.
- Multimedia.

**Condicion:** el wizard debe mostrar exactamente las mismas diez preguntas.

Resultado: el catalogo se movio a `src/features/survey/domain/questions.ts` y `App.vue` lo consume como estado reactivo sin modificar sus IDs, orden, textos, opciones ni referencias multimedia.

## TODO-007. Definir IDs como constantes o tipos [COMPLETADO]

Evitar IDs dispersos como strings libres:

```ts
'tonto'
'casper'
'mensaje'
```

Crear tipos o constantes para preguntas y opciones.

**Condicion:** no cambiar los valores almacenados actualmente.

Resultado: se anadieron `QUESTION_IDS`, `QuestionId` y `OptionId` en `src/features/survey/domain/survey.types.ts`. El catalogo usa las constantes de preguntas y el mapa de respuestas conserva los mismos valores persistidos.

## TODO-008. Definir reglas del cuestionario [COMPLETADO]

Crear funciones puras para validar:

- Que todas las preguntas hayan sido respondidas.
- Que una opcion pertenezca a su pregunta.
- Que no existan preguntas desconocidas.
- Que el envio tenga exactamente la estructura esperada.

Ubicacion propuesta:

```text
src/features/survey/domain/survey.rules.ts
```

Resultado: se creo `validateSurveyAnswers` con errores de dominio tipados para respuestas faltantes, preguntas desconocidas, opciones invalidas y cantidad incorrecta. Sus casos principales estan cubiertos en `tests/unit/domain/survey.rules.spec.ts`.

## TODO-009. Definir el DTO canonico de respuestas [COMPLETADO]

Elegir y documentar un unico formato. Por ejemplo:

```ts
interface SurveySubmission {
  invitationId: string;
  participantName: string;
  answers: Record<string, string>;
}
```

Decidir explicitamente si el documento Firestore tendra:

- `usuario`.
- `premios`.
- `createdAt`.
- `invitationId`.

**Condicion:** mantener compatibilidad de lectura con documentos existentes.

Resultado: el contrato canonico de aplicacion es `SurveySubmission`, definido en `src/features/survey/domain/survey.types.ts`:

```ts
interface SurveySubmission {
  invitationId: string;
  participantName: string;
  answers: Record<QuestionId, OptionId>;
}
```

La persistencia actual mantiene temporalmente el contrato legado `{ usuario, premios }`. No se modifica el servicio ni el esquema existente en este TODO. Un adaptador posterior sera responsable de traducir el DTO canonico al formato persistido y de mantener compatibilidad de lectura.

La decision de esquema para la futura persistencia es conservar conceptualmente `invitationId`, `participantName`, `answers` y `createdAt`. La migracion de documentos existentes se definira antes de escribir ese formato.

---

# Fase 2: estado y flujo del wizard

## TODO-010. Crear un estado puro del wizard [COMPLETADO]

Extraer la logica de:

- Pregunta actual.
- Indice.
- Respuestas.
- Paso actual.
- Avance.
- Retroceso.
- Progreso.

Ubicacion propuesta:

```text
src/features/survey/application/surveyWizard.ts
```

Debe ser una funcion o modulo testeable sin Vue.

Resultado: se creo `src/features/survey/application/surveyWizard.ts` con estado y transiciones puras para iniciar, seleccionar, avanzar, retroceder, consultar la pregunta actual y calcular el progreso. Sus transiciones estan cubiertas en `tests/unit/application/surveyWizard.spec.ts`.

## TODO-011. Eliminar el estado duplicado de respuestas [COMPLETADO]

Eliminar gradualmente:

```ts
respuestasAnteriores
```

La respuesta actual debe derivarse siempre de:

```ts
respuestas[preguntaActual.id]
```

**Condicion:** volver atras debe restaurar exactamente la seleccion anterior.

Resultado: `respuestasAnteriores` ya no existe. `App.vue` usa `respuestas` como unica fuente de verdad y restaura la seleccion desde el ID de la pregunta anterior. La misma transicion esta cubierta en `tests/unit/application/surveyWizard.spec.ts` y en la linea base de `tests/integration/App.spec.ts`.

## TODO-012. Crear el composable del wizard [COMPLETADO]

Crear:

```text
src/features/survey/application/useSurveyWizard.ts
```

El composable debe coordinar el estado reactivo, mientras que las reglas permanecen en funciones puras.

Resultado: se creo `src/features/survey/application/useSurveyWizard.ts` como adaptador reactivo sobre `surveyWizard.ts`. `App.vue` usa el composable para el estado, seleccion, avance y retroceso del cuestionario, manteniendo fuera la persistencia y los modales.

## TODO-013. Cubrir las transiciones del wizard [COMPLETADO]

Anadir pruebas para:

- Estado inicial.
- Login a bienvenida.
- Bienvenida a preguntas.
- Pregunta siguiente.
- Pregunta anterior.
- Respuesta restaurada.
- Ultima pregunta.
- Envio incompleto.
- Bloqueo durante envio.

Resultado: `tests/unit/application/surveyWizard.spec.ts` cubre estado inicial, inicio, avance, retroceso, restauracion, limites, respuesta faltante, ultima pregunta y progreso. `tests/integration/App.spec.ts` mantiene la cobertura de las transiciones visibles de login, bienvenida y envio.

## TODO-014. Evitar envios duplicados desde la interfaz [COMPLETADO]

Garantizar que un doble click no ejecute dos envios simultaneos.

Resolverlo en dos niveles:

- Bloqueo visual mediante `enviando`.
- Proteccion real en backend o transaccion.

Resultado: `App.vue` mantiene el boton deshabilitado mediante `enviando` y añade una guarda dentro del handler para rechazar eventos duplicados aunque lleguen antes de actualizar la interfaz. La prueba de `App.spec.ts` verifica que un doble envio durante una persistencia pendiente solo ejecuta una escritura. La proteccion server-side/transaccional queda pendiente de TODO-033 a TODO-037, ya que el proyecto actual no incluye backend.

---

# Fase 3: descomposicion de la interfaz

## TODO-015. Crear el componente raiz de la aplicacion [COMPLETADO]

Reducir `App.vue` a composicion de modulos:

```text
src/app/App.vue
```

Debe encargarse principalmente de:

- Montar el layout.
- Conectar el wizard.
- Seleccionar el paso visible.

Resultado: se crea la raiz modular en `src/app/App.vue`, manteniendo el comportamiento actual del flujo de encuesta y eliminando la duplicidad de puntos de entrada.

## TODO-016. Extraer la pantalla de login [COMPLETADO]

Crear:

```text
src/features/survey/presentation/LoginStep.vue
```

Responsabilidades:

- Campo de palabra secreta.
- Boton de acceso.
- Mensajes de error.
- Estado de carga.

Resultado: la pantalla de login queda separada en `src/features/survey/presentation/LoginStep.vue`, conectada desde `src/app/App.vue` y cubierta por pruebas en `tests/unit/components/LoginStep.spec.ts` sin cambiar el flujo actual.

## TODO-017. Extraer la pantalla de bienvenida [COMPLETADO]

Crear:

```text
src/features/survey/presentation/WelcomeStep.vue
```

Resultado: la pantalla de bienvenida queda separada en `src/features/survey/presentation/WelcomeStep.vue`, conectada desde `src/app/App.vue` y cubierta por pruebas en `tests/unit/components/WelcomeStep.spec.ts`. El flujo sigue siendo el mismo: nombre del participante + inicio de la encuesta.

## TODO-018. Extraer la pantalla de preguntas [COMPLETADO]

Crear:

```text
src/features/survey/presentation/QuestionStep.vue
```

Responsabilidades:

- Titulo.
- Progreso.
- Opciones.
- Seleccion.
- Botones anterior y siguiente.

Resultado: la pantalla de preguntas queda separada en `src/features/survey/presentation/QuestionStep.vue`, conectada a `src/app/App.vue` y cubierta por pruebas en `tests/unit/components/QuestionStep.spec.ts` manteniendo la misma logica de seleccion, progreso, retroceso y envio.

## TODO-019. Extraer la pantalla final [COMPLETADO]

Crear:

```text
src/features/survey/presentation/CompletionStep.vue
```

Resultado: la pantalla final queda separada en `src/features/survey/presentation/CompletionStep.vue`, conectada desde `src/app/App.vue` y cubierta por pruebas en `tests/unit/components/CompletionStep.spec.ts`, manteniendo el mismo mensaje de agradecimiento y finalizacion de la encuesta.

## TODO-020. Extraer el visor multimedia [COMPLETADO]

Crear:

```text
src/features/survey/presentation/MultimediaViewer.vue
```

Debe conservar:

- Click largo.
- Tecla Escape.
- Imagen.
- Video.
- Cierre del modal.
- Accesibilidad.

Resultado: el visor multimedia queda separado en `src/features/survey/presentation/MultimediaViewer.vue`, conectado desde `src/app/App.vue` y cubierto por pruebas en `tests/unit/components/MultimediaViewer.spec.ts`, manteniendo la vista completa de imagen o video y el cierre por click/escape.

## TODO-021. Extraer el visor de la foto del avatar [COMPLETADO]

Separar el modal de la foto del avatar del visor multimedia de respuestas si sus comportamientos son distintos.

Resultado: el modal de la foto del avatar queda extraido a `src/features/survey/presentation/AvatarPhotoViewer.vue`, `src/app/App.vue` solo coordina su apertura/cierre y se cubre con `tests/unit/components/AvatarPhotoViewer.spec.ts` para mantener el comportamiento visual y de cierre.

## TODO-022. Mantener temporalmente el contrato de `App.vue` [COMPLETADO]

Durante la migracion, `App.vue` puede seguir coordinando los componentes nuevos.

**Condicion:** no mover toda la interfaz de una vez. Cada componente debe tener sus pruebas antes de eliminar la implementacion anterior.

Resultado: la aplicacion mantiene una capa de coordinacion en `src/app/App.vue` mientras los pasos y modales se extraen de forma incremental. El shell sigue siendo el punto de entrada estable para el flujo, pero la responsabilidad visual y de comportamiento queda separada en componentes como `LoginStep`, `QuestionStep`, `MultimediaViewer` y `AvatarPhotoViewer`, cada uno con pruebas asociadas. Este enfoque cumple la compatibilidad temporal sin forzar una migracion destructiva de la interfaz.

---

# Fase 4: capa de aplicacion

## TODO-023. Crear el caso de uso de validacion [COMPLETADO]

Crear:

```text
src/features/survey/application/validateInvitation.ts
```

Debe encargarse de:

- Normalizar la palabra secreta.
- Consultar la invitacion.
- Distinguir invitacion inexistente.
- Distinguir invitacion ya utilizada.
- Devolver una invitacion valida.

Resultado: la validacion de invitacion queda encapsulada en un caso de uso aislado, con pruebas en `tests/unit/application/validateInvitation.spec.ts` y manejo de errores de dominio.

## TODO-024. Crear el caso de uso de envio [COMPLETADO]

Crear:

```text
src/features/survey/application/submitSurvey.ts
```

Debe coordinar:

- Validacion del cuestionario.
- Construccion del DTO.
- Persistencia.
- Manejo de errores.
- Resultado final.

La interfaz no debe llamar directamente a varias operaciones de Firebase.

Resultado: el envio queda orquestado por una unica funcion de aplicacion, con validacion del cuestionario, construccion del payload y persistencia ordenada, cubierto por `tests/unit/application/submitSurvey.spec.ts`.

## TODO-025. Definir errores de aplicacion [COMPLETADO]

Crear errores diferenciados:

```text
InvalidInvitationError
InvitationAlreadyUsedError
InvalidSubmissionError
SubmissionAlreadyCompletedError
PersistenceError
```

La UI traducira estos errores a mensajes en espanol.

Resultado: se crean las clases en `src/features/survey/application/errors.ts` con codigo interno para distinguir cada caso y permitir a la capa de presentacion traducir mensajes sin depender de strings visuales.

## TODO-026. Separar textos de usuario de errores tecnicos [COMPLETADO]

La capa de aplicacion no debe depender de textos visuales concretos.

Ejemplo:

```ts
return { type: 'invitation-already-used' };
```

La interfaz decide que mensaje mostrar.

Resultado: la capa de aplicacion expone errores tipados con `code` y nombre de dominio; la UI no depende de mensajes en texto humano de la aplicacion y puede traducirlos con criterio de presentacion.

---

# Fase 5: infraestructura y Firebase

## TODO-027. Mover la inicializacion de Firebase a infraestructura [COMPLETADO]

Mover la inicializacion a:

```text
src/infrastructure/firebase/client.ts
```

**Condicion:** los modulos de dominio no deben importar Firebase.

## TODO-028. Crear el repositorio de invitaciones [COMPLETADO]

Crear una interfaz:

```ts
interface InvitationRepository {
  findBySecret(secret: string): Promise<Invitation | null>;
}
```

Implementacion:

```text
src/infrastructure/firebase/firestoreInvitationRepository.ts
```

## TODO-029. Crear el repositorio de respuestas [COMPLETADO]

Crear una interfaz:

```ts
interface SurveySubmissionRepository {
  submit(submission: SurveySubmission): Promise<void>;
}
```

Implementacion Firebase separada.

Resultado: se implemento `FirestoreSurveySubmissionRepository`, tipado con el DTO canonico `SurveySubmission`. El repositorio traduce el envio al formato de persistencia legado escribiendo solo el mapa de respuestas en `respuestas/{invitationId}`, manteniendo el contrato existente mientras se migra la arquitectura. El test verifica la ruta y el contenido persistido.

## TODO-030. Crear una composicion de dependencias [COMPLETADO]

Crear:

```text
src/app/bootstrap.ts
```

Ahi se conectaran:

```text
casos de uso
  -> repositorios Firebase
```

La UI no deberia conocer `db`, `doc`, `setDoc` ni `updateDoc`.

Resultado: `main.ts` crea los servicios y los proporciona mediante `APP_SERVICES_KEY`; `App.vue` consume los casos de uso sin importar el servicio Firebase legacy. `createAppServices` conecta validacion y envio con los repositorios Firebase, incluido el marcado de invitaciones usadas. Los tests cubren el wiring y el flujo de UI.

## TODO-031. Eliminar los alias bilingues del servicio [COMPLETADO]

Actualmente existen nombres ingleses y alias espanoles en el mismo archivo.

Elegir una convencion, preferiblemente nombres de dominio consistentes:

```ts
findInvitationBySecret
submitSurvey
```

La eliminacion debe hacerse solo despues de actualizar consumidores y pruebas.

Resultado: se eliminaron los cuatro exports en espanol, se actualizaron los tests y la documentacion al API en ingles, y se corrigio el mock del cliente Firebase usado por el test del servicio.

## TODO-032. Eliminar funcionalidades no utilizadas o aislarlas [COMPLETADO]

`palabrasClave` no forma parte del flujo actual.

Decidir entre:

- Eliminarla.
- Moverla a otro modulo.
- Mantenerla documentada como funcionalidad futura.

No debe permanecer mezclada con el flujo principal sin una razon clara.

Resultado: se mantuvo `palabrasClave` como funcionalidad opcional y se aislo en `features/keywords` y `FirestoreKeywordsRepository`. Se conservaron el esquema y el timestamp existentes; `premiosService` ya no importa ni expone esta capacidad y la documentacion deja claro que no forma parte del flujo activo.

---

# Fase 6: envio seguro y atomico

Esta fase requiere especial cuidado porque afecta al modelo de seguridad.

## TODO-033. Definir el modelo de seguridad real [COMPLETADO]

Decidir si el sistema usara:

- Firebase Authentication.
- Cloud Functions callable.
- Backend propio.
- Firestore con transacciones controladas.

La palabra secreta no deberia considerarse una autorizacion fuerte por si sola.

Resultado: se eligieron Cloud Functions callable con Admin SDK, Firebase Authentication anonima y App Check obligatorio. Firestore quedara accesible solo desde el servidor para las colecciones de invitaciones y respuestas. La decision y sus limites quedan documentados en `docs/SECURITY.md`: el codigo sigue siendo una credencial bearer y App Check mitiga abuso, pero no acredita identidad real.

## TODO-034. Crear un endpoint unico de envio [COMPLETADO]

El cliente debe llamar a una unica operacion:

```text
submitSurvey(invitationId, answers)
```

El servidor debe:

1. Leer la invitacion.
2. Comprobar que no esta usada.
3. Validar las respuestas.
4. Crear la respuesta.
5. Marcar la invitacion como usada.
6. Ejecutarlo todo de forma atomica.

Resultado: se anadio la callable `submitSurvey` en `functions/`, protegida por Firebase Auth y App Check. Lee la invitacion, rechaza codigos inexistentes/usados y crea la respuesta junto con `usado: true` en una unica transaccion. El cliente ya envia por esta callable; la validacion exhaustiva queda en TODO-036. CI compila las Functions y el predeploy de Firebase ejecuta su build.

## TODO-035. Hacer el envio idempotente [COMPLETADO]

Si el usuario reintenta despues de un error de red, el servidor debe devolver un resultado consistente en lugar de crear duplicados.

Resultado: la transaccion tambien lee `respuestas/{invitationId}`. Si la invitacion ya esta usada y el mapa persistido coincide exactamente, el endpoint devuelve el mismo exito sin escrituras; si difiere o el estado es inconsistente, rechaza el reintento sin sobrescribir datos.

## TODO-036. Validar las respuestas en servidor [COMPLETADO]

No confiar unicamente en la UI. Validar:

- IDs de preguntas.
- IDs de opciones.
- Numero de respuestas.
- Invitacion valida.
- Invitacion no usada.
- Formato de datos.
- Tamano maximo de los datos.

Resultado: `parseSurveySubmission` valida exactamente el conjunto de preguntas/opciones permitido, IDs y campos inesperados, formato de valores y un maximo de 4 KiB. El handler tambien exige documentos de invitacion con `nombre` y `usado` bien formados. Un test de paridad alerta si el catalogo del frontend cambia sin actualizar la allowlist del servidor.

## TODO-037. Crear reglas de Firestore restrictivas [COMPLETADO]

Eliminar las reglas de desarrollo:

```text
allow read, write: if true;
```

Las reglas deben impedir:

- Lecturas globales de invitaciones.
- Modificacion arbitraria de respuestas.
- Reutilizacion de codigos.
- Escrituras con campos inesperados.

Resultado: `firestore.rules` usa denegacion por defecto y bloquea todas las lecturas/escrituras cliente de `codigos`, `respuestas` y `palabrasClave`. `firebase.json` referencia las reglas y el despliegue esta documentado.

## TODO-038. Separar lectura de invitacion y autorizacion [COMPLETADO]

Si se mantiene el acceso por palabra secreta, disenar cuidadosamente que datos puede devolver el cliente y que operaciones deben permanecer server-side.

Resultado: la validacion se movio a la callable autenticada `validateInvitation`, que normaliza el codigo, verifica que exista y no este usado, y devuelve unicamente `participantName`. Se retiro la lectura Firestore del cliente, se eliminaron los servicios legacy de lectura/escritura directa y las reglas deniegan tambien `get` individual de invitaciones. Las pruebas cubren autenticacion, estados de invitacion, normalizacion y respuesta minima.

---

# Fase 7: modelo de datos y migracion

## TODO-039. Corregir el esquema documentado de respuestas [COMPLETADO]

Alinear documentacion e implementacion respecto a:

- ID del documento.
- Nombre del participante.
- Palabra secreta.
- Respuestas.
- Fecha de creacion.
- Fecha de envio.

Resultado: `docs/API.md` y `docs/ARCHITECTURE.md` ahora reflejan lo que el handler persiste actualmente: `respuestas/{invitationId}` con un campo plano por pregunta, sin nombre ni timestamps. Se distingue explícitamente el DTO de la callable del documento almacenado y se señala la transición de esquema que sigue.

## TODO-040. Crear una estrategia para documentos existentes [COMPLETADO]

Antes de cambiar el formato, decidir si se requiere:

- Compatibilidad de lectura.
- Script de migracion.
- Nueva coleccion.
- Version de esquema.

Por ejemplo:

```ts
schemaVersion: 2
```

Resultado/decision: conservar `respuestas` como coleccion y tratar los documentos actuales sin `schemaVersion` como legacy v1. No se reescribiran ni borraran en una migracion masiva; permanecen disponibles para informes y exportaciones. Las nuevas respuestas usaran v2, con `schemaVersion: 2`, `participantName`, `answers`, `createdAt` y `submittedAt`; el ID sera opaco y se enlazara desde el documento de invitacion mediante `responseId`. La logica de reintentos reconocera la respuesta legacy asociada al ID antiguo sin copiar el codigo secreto a documentos nuevos. Cualquier backfill futuro requiere export/respaldo y un plan de rollback.

## TODO-041. Evitar usar la palabra secreta como ID visible [COMPLETADO]

Evaluar el uso de un ID interno aleatorio para respuestas. La palabra secreta no deberia aparecer innecesariamente en documentos o informes.

Resultado: las respuestas nuevas usan IDs aleatorios de Firestore; el documento de invitacion conserva el enlace `responseId`. El esquema nuevo incluye `schemaVersion: 2`, nombre y mapa de respuestas, sin copiar el secreto. Los reintentos legacy siguen comprobando el documento con el ID anterior y las pruebas cubren el enlace v2, la idempotencia y la ausencia de escrituras duplicadas.

## TODO-042. Anadir marcas de tiempo reales [COMPLETADO]

Usar `serverTimestamp()` en el documento definitivo de respuesta.

Resultado: cada documento v2 se crea con `createdAt` y `submittedAt` usando `FieldValue.serverTimestamp()` de Admin SDK dentro de la transaccion. Los reintentos idempotentes no reescriben ni alteran las fechas. El test del handler comprueba ambos campos.

## TODO-043. Anadir validacion de documentos leidos [COMPLETADO]

No hacer casts directos inseguros como:

```ts
snap.data() as CodigoInvitacion
```

Crear parseadores o validadores para documentos incompletos o corruptos.

Resultado: `firestoreSchemas.ts` valida invitaciones y sus `responseId`, mapas completos de opciones, respuestas legacy planas y documentos v2 con version, nombre, campos exactos y timestamps Firestore validos. Los handlers usan estos parseadores antes de devolver nombres o aceptar reintentos; los documentos ausentes, corruptos o de versiones desconocidas se rechazan. Hay pruebas de campos faltantes/extra, IDs inseguros, opciones invalidas, timestamps fuera de rango y formato legacy.

---

# Fase 8: multimedia

## TODO-044. Resolver assets inexistentes [COMPLETADO]

Decidir entre:

- Anadir los archivos faltantes.
- Eliminar las opciones que no tienen recurso.
- Mostrar un placeholder controlado.

Nunca dejar `src` indefinidos.

Resultado: se conserva el catálogo de opciones y se muestra `public/media-unavailable.svg` para recursos ausentes. El descriptor mantiene tipo y alt, marca `unavailable` y siempre tiene una URL definida; miniaturas y visor renderizan el fallback como imagen aunque la opción original fuera un video. Tests cubren fallback y ausencia de fuentes `undefined`.

## TODO-045. Crear un registro tipado de multimedia [COMPLETADO]

En lugar de acceder a claves manualmente:

```ts
multimediaAssets['./assets/foto-1.jpg']
```

Crear una funcion que valide si el recurso existe.

Resultado: `multimediaRegistry.ts` define las rutas admitidas como union literal y un registro completo tipado con tipo, URL, disponibilidad y ruta física. `resolveMultimediaAsset` valida la entrada y usa el placeholder de TODO-044 cuando falta el archivo; el catálogo ya no indexa un glob arbitrario ni fuerza casts a `string`.

## TODO-046. Anadir pruebas de recursos [COMPLETADO]

Comprobar que todas las opciones multimedia tienen:

- Tipo valido.
- URL valida.
- Texto alternativo para imagenes.
- Recurso existente.

Resultado: `multimediaFallback.spec.ts` recorre las rutas esperadas y todas las opciones, comprueba tipo, alt, URL no vacia, extension correspondiente y existencia fisica del asset o placeholder. Tambien impide que la imagen del avatar entre accidentalmente en el catalogo de respuestas.

## TODO-047. Corregir el favicon [COMPLETADO]

Mover la imagen a `public/` o actualizar el enlace del favicon para que apunte a un recurso generado por Vite.

Resultado: el favicon ya referencia `/foto-amigos.jpg`, que existe en `public/` y Vite copia tal cual a `dist`. No se cambia a import transformado porque `index.html` es un HTML de entrada estatico. `favicon.spec.ts` comprueba que el enlace siempre resuelva a un archivo publico.

## TODO-048. Revisar carga y peso de videos [COMPLETADO]

Evaluar:

- Tamano de los videos.
- Carga diferida.
- Previsualizaciones.
- Formatos compatibles.
- Rendimiento movil.

Resultado/decision: el inventario actual no contiene videos; solo existe `mensaje-1.jpg` (16,043 bytes), y la foto del avatar (450,398 bytes, duplicada entre `public` y `src/assets`) no forma parte de respuestas. No hay archivos de video cuyo peso pueda medirse o recomprimirse. Las tarjetas usan `preload="none"`; el visor, montado solo al abrirse, usa `preload="metadata"`, controles, `playsinline` y no autoplay. El registro acepta MP4 (`video/mp4`) como fuente compatible y WebM (`video/webm`) como alternativa; al incorporar videos se medirá cada archivo y se generará una previsualizacion ligera/poster antes de activar el catalogo. Tests verifican los formatos, la carga diferida y que el visor no inicie reproducción automáticamente.

---

# Fase 9: estilos y experiencia visual

## TODO-049. Centralizar los estilos globales [COMPLETADO]

Decidir que estilos son globales y cuales pertenecen a componentes.

Eliminar duplicaciones entre:

- `src/style.css`.
- El bloque de estilos de `App.vue`.

Resultado: las reglas compartidas del shell, wizard, controles, opciones y visor se consolidaron en `src/style.css`; se retiró el bloque global de `App.vue`. Los estilos de la aplicación se cargan desde un único entrypoint y los componentes mantienen su presentación propia para TODO-050.

## TODO-050. Aplicar `scoped` donde corresponda [COMPLETADO]

Los estilos especificos de componentes deben estar aislados para evitar efectos colaterales.

Resultado: los SFC conservan sus estilos locales con `scoped`; el antiguo bloque global de `App.vue` se encuentra en `src/style.css`. `tests/unit/contracts/styleScope.spec.ts` recorre los componentes para evitar introducir nuevos bloques `<style>` globales.

## TODO-051. Crear tokens visuales centralizados [COMPLETADO]

Mantener variables para:

- Colores.
- Espaciado.
- Radios.
- Sombras.
- Tipografia.
- Breakpoints.

Resultado: `src/style.css` es la unica fuente de tokens para color, tipografia, line-height, espaciado, radios, sombras, foco y breakpoint movil; se eliminaron las declaraciones `:root` duplicadas de los SFC. `designTokens.spec.ts` verifica el contrato. CSS nativo no permite interpolar custom properties en condiciones `@media`, por lo que el breakpoint queda duplicado como literal `640px` en la regla responsive, documentado junto al token.

## TODO-052. Anadir estados completos de interfaz [COMPLETADO]

Verificar cada pantalla en estados:

- Inicial.
- Cargando.
- Error.
- Vacio.
- Exito.
- Reintento.
- Deshabilitado.

Resultado: login expone inicial, validando/deshabilitado y errores recuperables; el wizard mantiene progreso y selección durante errores de persistencia, cambia la acción a `Reintentar envío` y confirma éxito al completar; `QuestionStep` muestra estado vacío si no hay opciones y conserva controles deshabilitados cuando no se puede avanzar. `App.spec.ts` y `QuestionStep.spec.ts` cubren estas transiciones y estados.

## TODO-053. Mejorar accesibilidad [COMPLETADO]

Revisar:

- Navegacion por teclado.
- Foco visible.
- `aria-label`.
- `aria-live` para errores.
- Modales.
- Escape.
- Contraste.
- Lectores de pantalla.
- Uso de video sin sonido.
Resultado: el login asocia label y error con el input (`aria-invalid`, `aria-describedby`, `role=alert`); progreso y opciones exponen `progressbar`/`aria-pressed`; errores y éxito usan regiones vivas. Se añadió foco `:focus-visible`; ambos modales enfocan el botón de cierre al abrirse, contienen Tab, cierran con Escape y restauran foco al disparador. Miniaturas de video permanecen silenciadas y el visor no reproduce automáticamente; controles permiten decidir la reproducción. El texto oscuro sobre superficies claras y el indicador de foco azul mantienen contraste perceptible. Tests cubren estos contratos.

## TODO-054. Probar responsive [COMPLETADO]

Verificar movil y escritorio para:

- Login.
- Preguntas con muchas opciones.
- Opciones multimedia.
- Modales.
- Mensajes largos.
- Botones durante carga.

Resultado: la revision revelo seis defectos reales que se corrigieron. El boton de cerrar de los modales estaba a `top: -40px` sobre un overlay con `padding: 18px`, por lo que con un medio alto caia fuera de la pantalla y era inalcanzable; ahora el overlay reserva `padding-top: 60px` y el boton usa `top: -52px` con un tamaño de `44px`, y un test verifica la relacion entre ambos valores para que la banda siga siendo suficiente. El alto maximo del medio pasa de `100vh` a `calc(100dvh - …)` con fallback `100vh`, porque `100vh` excede el viewport visible cuando el navegador movil muestra u oculta la barra de direccion. `QuestionStep.vue` usaba `repeat(2, 1fr)`, lo que anulaba el `minmax(0, 1fr)` de `src/style.css` y dejaba el grid sin proteccion frente a etiquetas largas; ahora las opciones pasan a una sola columna por debajo de `640px`, las acciones del pie se apilan a ancho completo, `.option-text` y `.hero-title` usan `overflow-wrap: anywhere`, los botones alcanzan `44px` de alto y la cabecera reduce su padding y el tamano del titulo en movil. Los visores fijan `document.body.style.overflow` mientras estan abiertos y lo restauran al cerrar o desmontarse. `tests/unit/contracts/responsiveLayout.spec.ts` recorre `src/**` con un parser de CSS y fija el contrato: un unico breakpoint coherente con `--breakpoint-mobile`, regla movil en cada componente, banda suficiente para el boton de cierre, guardas de envoltura de texto, ausencia de anchos fijos superiores a `320px` y de `repeat(n, 1fr)` sin `minmax(0, …)`. `tests/e2e/responsive.spec.ts` anade Playwright con proyectos `mobile` (Pixel 5) y `desktop`, y recorre el flujo real sobre `tests/e2e/harness/`, que monta `App.vue` con `AppServices` simulados y no importa `infrastructure/firebase/client.ts`, de modo que la app arranca sin credenciales ni red; comprueba overflow horizontal, objetivos tactiles de `44px`, cierre accesible con un medio vertical de `1:4` y etiquetas largas de carga y reintento. `vite.config.ts` acota `test.include` a `tests/unit/**/*.spec.ts` para que Vitest no intente ejecutar las specs de Playwright, y `.github/workflows/tests.yml` anade un job `e2e` en paralelo.

---

# Fase 10: pruebas

## TODO-055. Separar pruebas por nivel [COMPLETADO]

Crear:

```text
tests/unit/domain/
tests/unit/application/
tests/unit/components/
tests/integration/
```

Resultado: se reorganizaron las 21 specs existentes con `git mv` para conservar el historial y se dividio la suite en tres niveles ejecutables por separado. `tests/unit/` agrupa por capa hexagonal y quedo en cinco carpetas, dos mas de las previstas porque las specs que ya existian no encajaban en ninguna: `infrastructure` para `firestoreKeywordsRepository.spec.ts`, que prueba un adaptador de Firebase con el SDK simulado, y `contracts` para las cinco specs que verifican invariantes del repositorio mas que una capa (`designTokens`, `favicon`, `styleScope`, `firestoreSchemas` y `responsiveLayout`). `App.spec.ts` y `bootstrap.spec.ts` son los unicos casos de integracion porque componen la app o el composition root reales y solo falsean la frontera externa. Los handlers de Cloud Functions se dejaron en `unit/application`: son adaptadores finos sobre los mismos casos de uso que ya prueban las specs del cliente, con stores falsos en lugar de Firestore real, asi que siguen siendo unitarias y no hace falta abrir un cuarto nivel. Se anadieron `test:unit` y `test:integration` a `package.json`, `vite.config.ts` incluye ahora los dos niveles de Vitest, y el job `test` de CI ejecuta los pasos por separado para que un fallo senale el nivel. `tests/unit/contracts/testLayout.spec.ts` cierra el circuito: falla si `tests/` expone un directorio que no sea `e2e`, `integration` o `unit`, si `tests/unit/` gana una capa desconocida, si una spec aparece en la raiz de `unit` o si `vite.config.ts` deja de cubrir un nivel o arrastra las specs de Playwright, de modo que la estructura no se deshaga con un `mv` descuidado. Los imports y las rutas `__dirname` de las specs movidas se ajustaron a la nueva profundidad.

## TODO-056. Probar el dominio sin Vue [COMPLETADO]

Anadir pruebas para:

- Validacion de respuestas.
- Reglas de preguntas.
- Progreso.
- Transiciones.
- Respuestas completas.

Resultado: se ampliaron las pruebas puras hasta cubrir las cinco areas y se anadio `tests/unit/domain/isolation.spec.ts`, que verifica por codigo fuente que el dominio no importa Vue, ni infraestructura, ni ninguna dependencia externa, y que el wizard construye un estado nuevo en vez de mutar el recibido. `tests/unit/domain/questions.spec.ts` fija las reglas del catalogo: cobertura exacta de `QUESTION_IDS`, unicidad de identificadores de pregunta y de opcion dentro y entre preguntas, derivacion del identificador de opcion a partir del de su pregunta, textos no vacios, numero de opciones dentro de las reticulas que la interfaz soporta (4, 6 y 8), contenido multimedia limitado a `mensaje`, `foto` y `video` con un unico tipo de medio por pregunta y ausencia de campos no declarados. `tests/unit/domain/survey.rules.spec.ts` crecio de 4 a 15 pruebas sobre `validateSurveyAnswers`, ahora con catalogos reales y arbitraros: acumula todos los errores en una sola pasada, rechaza cadena vacia y `undefined` explicito, distingue error de opcion invalida del de pregunta desconocida, valida contra el catalogo recibido y no contra uno global, no muta sus entradas y exige exactamente una respuesta por pregunta. `tests/unit/application/surveyWizard.spec.ts` paso de 9 a 19 pruebas sobre transiciones, progreso y respuestas completas, incluyendo indices fuera de rango, catalogo vacio, ida y vuelta entre preguntas, eleccion de la ultima opcion de cada pregunta y comprobacion de que el cuestionario resultante supera `validateSurveyAnswers`. Al mutar el codigo para verificar que los tests detectan la regresion, fallan 8 pruebas entre las tres specs. La suite unitaria queda en 137 pruebas.

## TODO-057. Probar los casos de uso [COMPLETADO]

Cubrir:

- Invitacion inexistente.
- Invitacion utilizada.
- Error de repositorio.
- Envio correcto.
- Envio invalido.
- Reintento.
- Doble envio.

Resultado: `tests/unit/application/validateInvitation.spec.ts` paso de 3 a 10 pruebas y cubre los siete casos sobre el caso de uso puro: invitacion inexistente (`invitation-not-found`), invitacion ya utilizada (`invitation-already-used`), fallo del repositorio propagado sin envolver ni confundir con `InvalidInvitationError`, normalizacion del secreto antes de consultar, rechazo de un secreto vacio o solo espacios sin llegar al finder, y devolucion del registro sin modificar. `tests/unit/application/submitSurvey.spec.ts` paso de 3 a 17 pruebas: envio correcto (incluido un `persist` sincrono, el orden de las claves y las diez preguntas reales), envio invalido (respuestas incompletas, opcion ajena a la pregunta, preguntas desconocidas o sobrantes) sin escribir nada, error de repositorio envuelto en `PersistenceError` tanto para `Error` como para rechazos no-`Error`, reintento tras un fallo con el mismo resultado y sin escritura cuando sigue siendo invalido, y doble envio, donde se documenta que el caso de uso persiste en cada invocacion y que la deduplicacion vive en el handler. Tambien queda cubierta la union vacia: `validateSurveyAnswers` solo comprueba consistencia con el catalogo recibido, asi que un catalogo vacio con cero respuestas es mutuo-validado y el endpoint lo cierra con la allowlist de `SURVEY_OPTION_IDS`. `tests/integration/bootstrap.spec.ts` paso de 3 a 10 pruebas para la traduccion de errores entre el endpoint y la UI: `not-found` e `invalid-argument` se convierten en `InvalidInvitationError`, `failed-precondition` en `InvitationAlreadyUsedError`, un fallo de backend no mapeado se propaga intacto, una respuesta mal formada se rechaza en vez de aceptarse, y quedan cubiertos el reintento de un envio, el doble envio ya consumido como `PersistenceError`, el inicio de sesion anonimo frente al reuse de sesion existente y la normalizacion del secreto antes de la llamada remota. Las suites quedan en 158 unitarias y 33 de integracion.

## TODO-058. Probar repositorios con contrato [COMPLETADO]

Comprobar que los adaptadores Firebase cumplen las interfaces de aplicacion.

Resultado: se anadio `tests/unit/contracts/repositoryContracts.spec.ts`, que comprueba la conformidad de los adaptadores con los contratos que consumen. Para el repositorio de palabras clave se asigna `FirestoreKeywordsRepository` a `KeywordsRepository`, de modo que una deviation en la firma rompe la compilacion, y se verifica que recibe el `KeywordSubmission` del dominio y no un DTO propio. Para los adaptadores de Cloud Function se comprueba que los stores falsos usados en las pruebas satisfacen `InvitationLookupStore` y `SubmissionStore` tal y como los declaran los handlers, y que el endpoint de envio acepta exactamente el payload que produce `submitSurvey` (solo `invitationId` y `answers`): `participantName` lo resuelve el servidor desde la invitacion, y se verifica que incluirlo hace fallar `parseSurveySubmission`. Tambien se fija que la allowlist `SURVEY_OPTION_IDS` coincide con el catalogo del cliente. `tests/unit/infrastructure/firestoreKeywordsRepository.spec.ts` paso de 1 a 5 pruebas de comportamiento del adaptador: escritura con timestamp del servidor, timestamp que no pisa los campos del envio, envio sin palabras clave, propagacion del error del SDK y ausencia de escritura cuando falla la construccion de la referencia. La suite unitaria queda en 168 pruebas.

## TODO-059. Mejorar pruebas de componentes

Cada componente extraido debe probar:

- Renderizado.
- Eventos emitidos.
- Props.
- Estados de carga.
- Estados de error.

## TODO-060. Corregir el test de navegacion atras

No basta con verificar que vuelve al primer indice. Debe verificar que la opcion previamente seleccionada continua seleccionada.

## TODO-061. Verificar el payload enviado

El test debe comprobar exactamente:

```ts
{
  invitationId,
  participantName,
  answers
}
```

o el formato definitivo que se elija.

---

# Fase 11: observabilidad y operacion

## TODO-062. Crear logging controlado

Evitar `console.error` directo en componentes. Crear un logger que permita:

- Registrar errores tecnicos.
- No exponer palabras secretas.
- No exponer datos personales innecesarios.
- Desactivar logs detallados en produccion.

## TODO-063. Anadir metricas basicas

Medir, sin datos sensibles:

- Inicios de encuesta.
- Envios correctos.
- Errores de envio.
- Invitaciones usadas.
- Fallos de multimedia.

## TODO-064. Anadir manejo de errores de red

Distinguir:

- Sin conexion.
- Timeout.
- Permisos.
- Servicio no disponible.
- Error desconocido.

## TODO-065. Documentar recuperacion ante fallos

Definir que ocurre si:

- El usuario cierra la pestana.
- Falla la red despues del envio.
- El servidor responde tarde.
- El codigo queda marcado pero la pantalla no cambia.

---

# Fase 12: documentacion

## TODO-066. Actualizar `ARCHITECTURE.md`

Documentar la arquitectura real despues de cada fase:

- Modulos.
- Dependencias.
- Flujo de datos.
- Reglas de importacion.
- Casos de uso.
- Adaptadores.

## TODO-067. Actualizar `API.md`

Alinear la documentacion con:

- DTOs reales.
- Colecciones reales.
- Campos reales.
- Errores reales.
- Operaciones disponibles.

## TODO-068. Actualizar la guia de despliegue

Documentar:

- Variables de entorno.
- Reglas de Firebase.
- Backend o Cloud Functions.
- Migraciones.
- Rollback.
- Gestion de assets.

## TODO-069. Crear reglas de dependencia

Documentar y revisar que:

```text
domain no importa Vue ni Firebase
application no importa componentes
presentation no accede directamente a Firestore
infrastructure no contiene reglas de interfaz
```

## TODO-070. Crear guia de contribucion

Documentar:

- Donde anadir preguntas.
- Donde modificar el modelo.
- Donde anadir un repositorio.
- Como ejecutar tests.
- Como ejecutar typecheck.
- Como anadir multimedia.

---

# Orden recomendado de implementacion

## Bloque 1: estabilizacion

- TODO-001
- TODO-002
- TODO-003
- TODO-004

## Bloque 2: dominio sin cambiar la interfaz

- TODO-005
- TODO-006
- TODO-007
- TODO-008
- TODO-009
- TODO-010
- TODO-011
- TODO-012
- TODO-013
- TODO-014

## Bloque 3: componentes visuales

- TODO-015 a TODO-022

## Bloque 4: aplicacion e infraestructura

- TODO-023 a TODO-032

## Bloque 5: seguridad y persistencia

- TODO-033 a TODO-043

## Bloque 6: recursos y experiencia

- TODO-044 a TODO-054

## Bloque 7: calidad y operacion

- TODO-055 a TODO-070

---

# Criterio de finalizacion

La migracion se considerara completada cuando:

- El flujo funcional actual siga operativo.
- `npm run typecheck` pase.
- `npm run lint` pase sin warnings relevantes.
- `npm test -- --run` pase.
- `npm run build` pase.
- El dominio no dependa de Vue ni Firebase.
- La interfaz no acceda directamente a Firestore.
- El envio sea atomico e idempotente.
- Las reglas de Firebase no permitan acceso indiscriminado.
- La documentacion refleje la arquitectura y el modelo de datos reales.
