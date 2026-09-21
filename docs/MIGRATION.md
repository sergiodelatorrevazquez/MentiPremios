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

Resultado: se documentaron los escenarios en `docs/MIGRATION_BASELINE.md` y se ampliaron las pruebas de `tests/unit/App.spec.ts` para cubrir el flujo completo, la restauracion de respuestas y el visor multimedia.

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

## TODO-008. Definir reglas del cuestionario

Crear funciones puras para validar:

- Que todas las preguntas hayan sido respondidas.
- Que una opcion pertenezca a su pregunta.
- Que no existan preguntas desconocidas.
- Que el envio tenga exactamente la estructura esperada.

Ubicacion propuesta:

```text
src/features/survey/domain/survey.rules.ts
```

## TODO-009. Definir el DTO canonico de respuestas

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

---

# Fase 2: estado y flujo del wizard

## TODO-010. Crear un estado puro del wizard

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

## TODO-011. Eliminar el estado duplicado de respuestas

Eliminar gradualmente:

```ts
respuestasAnteriores
```

La respuesta actual debe derivarse siempre de:

```ts
respuestas[preguntaActual.id]
```

**Condicion:** volver atras debe restaurar exactamente la seleccion anterior.

## TODO-012. Crear el composable del wizard

Crear:

```text
src/features/survey/application/useSurveyWizard.ts
```

El composable debe coordinar el estado reactivo, mientras que las reglas permanecen en funciones puras.

## TODO-013. Cubrir las transiciones del wizard

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

## TODO-014. Evitar envios duplicados desde la interfaz

Garantizar que un doble click no ejecute dos envios simultaneos.

Resolverlo en dos niveles:

- Bloqueo visual mediante `enviando`.
- Proteccion real en backend o transaccion.

---

# Fase 3: descomposicion de la interfaz

## TODO-015. Crear el componente raiz de la aplicacion

Reducir `App.vue` a composicion de modulos:

```text
src/app/App.vue
```

Debe encargarse principalmente de:

- Montar el layout.
- Conectar el wizard.
- Seleccionar el paso visible.

## TODO-016. Extraer la pantalla de login

Crear:

```text
src/features/survey/presentation/LoginStep.vue
```

Responsabilidades:

- Campo de palabra secreta.
- Boton de acceso.
- Mensajes de error.
- Estado de carga.

## TODO-017. Extraer la pantalla de bienvenida

Crear:

```text
src/features/survey/presentation/WelcomeStep.vue
```

## TODO-018. Extraer la pantalla de preguntas

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

## TODO-019. Extraer la pantalla final

Crear:

```text
src/features/survey/presentation/CompletionStep.vue
```

## TODO-020. Extraer el visor multimedia

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

## TODO-021. Extraer el visor de la foto del avatar

Separar el modal de la foto del avatar del visor multimedia de respuestas si sus comportamientos son distintos.

## TODO-022. Mantener temporalmente el contrato de `App.vue`

Durante la migracion, `App.vue` puede seguir coordinando los componentes nuevos.

**Condicion:** no mover toda la interfaz de una vez. Cada componente debe tener sus pruebas antes de eliminar la implementacion anterior.

---

# Fase 4: capa de aplicacion

## TODO-023. Crear el caso de uso de validacion

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

## TODO-024. Crear el caso de uso de envio

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

## TODO-025. Definir errores de aplicacion

Crear errores diferenciados:

```text
InvalidInvitationError
InvitationAlreadyUsedError
InvalidSubmissionError
SubmissionAlreadyCompletedError
PersistenceError
```

La UI traducira estos errores a mensajes en espanol.

## TODO-026. Separar textos de usuario de errores tecnicos

La capa de aplicacion no debe depender de textos visuales concretos.

Ejemplo:

```ts
return { type: 'invitation-already-used' };
```

La interfaz decide que mensaje mostrar.

---

# Fase 5: infraestructura y Firebase

## TODO-027. Mover la inicializacion de Firebase a infraestructura

Mover la inicializacion a:

```text
src/infrastructure/firebase/client.ts
```

**Condicion:** los modulos de dominio no deben importar Firebase.

## TODO-028. Crear el repositorio de invitaciones

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

## TODO-029. Crear el repositorio de respuestas

Crear una interfaz:

```ts
interface SurveySubmissionRepository {
  submit(submission: SurveySubmission): Promise<void>;
}
```

Implementacion Firebase separada.

## TODO-030. Crear una composicion de dependencias

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

## TODO-031. Eliminar los alias bilingues del servicio

Actualmente existen nombres ingleses y alias espanoles en el mismo archivo.

Elegir una convencion, preferiblemente nombres de dominio consistentes:

```ts
findInvitationBySecret
submitSurvey
```

La eliminacion debe hacerse solo despues de actualizar consumidores y pruebas.

## TODO-032. Eliminar funcionalidades no utilizadas o aislarlas

`palabrasClave` no forma parte del flujo actual.

Decidir entre:

- Eliminarla.
- Moverla a otro modulo.
- Mantenerla documentada como funcionalidad futura.

No debe permanecer mezclada con el flujo principal sin una razon clara.

---

# Fase 6: envio seguro y atomico

Esta fase requiere especial cuidado porque afecta al modelo de seguridad.

## TODO-033. Definir el modelo de seguridad real

Decidir si el sistema usara:

- Firebase Authentication.
- Cloud Functions callable.
- Backend propio.
- Firestore con transacciones controladas.

La palabra secreta no deberia considerarse una autorizacion fuerte por si sola.

## TODO-034. Crear un endpoint unico de envio

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

## TODO-035. Hacer el envio idempotente

Si el usuario reintenta despues de un error de red, el servidor debe devolver un resultado consistente en lugar de crear duplicados.

## TODO-036. Validar las respuestas en servidor

No confiar unicamente en la UI. Validar:

- IDs de preguntas.
- IDs de opciones.
- Numero de respuestas.
- Invitacion valida.
- Invitacion no usada.
- Formato de datos.
- Tamano maximo de los datos.

## TODO-037. Crear reglas de Firestore restrictivas

Eliminar las reglas de desarrollo:

```text
allow read, write: if true;
```

Las reglas deben impedir:

- Lecturas globales de invitaciones.
- Modificacion arbitraria de respuestas.
- Reutilizacion de codigos.
- Escrituras con campos inesperados.

## TODO-038. Separar lectura de invitacion y autorizacion

Si se mantiene el acceso por palabra secreta, disenar cuidadosamente que datos puede devolver el cliente y que operaciones deben permanecer server-side.

---

# Fase 7: modelo de datos y migracion

## TODO-039. Corregir el esquema documentado de respuestas

Alinear documentacion e implementacion respecto a:

- ID del documento.
- Nombre del participante.
- Palabra secreta.
- Respuestas.
- Fecha de creacion.
- Fecha de envio.

## TODO-040. Crear una estrategia para documentos existentes

Antes de cambiar el formato, decidir si se requiere:

- Compatibilidad de lectura.
- Script de migracion.
- Nueva coleccion.
- Version de esquema.

Por ejemplo:

```ts
schemaVersion: 2
```

## TODO-041. Evitar usar la palabra secreta como ID visible

Evaluar el uso de un ID interno aleatorio para respuestas. La palabra secreta no deberia aparecer innecesariamente en documentos o informes.

## TODO-042. Anadir marcas de tiempo reales

Usar `serverTimestamp()` en el documento definitivo de respuesta.

## TODO-043. Anadir validacion de documentos leidos

No hacer casts directos inseguros como:

```ts
snap.data() as CodigoInvitacion
```

Crear parseadores o validadores para documentos incompletos o corruptos.

---

# Fase 8: multimedia

## TODO-044. Resolver assets inexistentes

Decidir entre:

- Anadir los archivos faltantes.
- Eliminar las opciones que no tienen recurso.
- Mostrar un placeholder controlado.

Nunca dejar `src` indefinidos.

## TODO-045. Crear un registro tipado de multimedia

En lugar de acceder a claves manualmente:

```ts
multimediaAssets['./assets/foto-1.jpg']
```

Crear una funcion que valide si el recurso existe.

## TODO-046. Anadir pruebas de recursos

Comprobar que todas las opciones multimedia tienen:

- Tipo valido.
- URL valida.
- Texto alternativo para imagenes.
- Recurso existente.

## TODO-047. Corregir el favicon

Mover la imagen a `public/` o actualizar el enlace del favicon para que apunte a un recurso generado por Vite.

## TODO-048. Revisar carga y peso de videos

Evaluar:

- Tamano de los videos.
- Carga diferida.
- Previsualizaciones.
- Formatos compatibles.
- Rendimiento movil.

---

# Fase 9: estilos y experiencia visual

## TODO-049. Centralizar los estilos globales

Decidir que estilos son globales y cuales pertenecen a componentes.

Eliminar duplicaciones entre:

- `src/style.css`.
- El bloque de estilos de `App.vue`.

## TODO-050. Aplicar `scoped` donde corresponda

Los estilos especificos de componentes deben estar aislados para evitar efectos colaterales.

## TODO-051. Crear tokens visuales centralizados

Mantener variables para:

- Colores.
- Espaciado.
- Radios.
- Sombras.
- Tipografia.
- Breakpoints.

## TODO-052. Anadir estados completos de interfaz

Verificar cada pantalla en estados:

- Inicial.
- Cargando.
- Error.
- Vacio.
- Exito.
- Reintento.
- Deshabilitado.

## TODO-053. Mejorar accesibilidad

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

## TODO-054. Probar responsive

Verificar movil y escritorio para:

- Login.
- Preguntas con muchas opciones.
- Opciones multimedia.
- Modales.
- Mensajes largos.
- Botones durante carga.

---

# Fase 10: pruebas

## TODO-055. Separar pruebas por nivel

Crear:

```text
tests/unit/domain/
tests/unit/application/
tests/unit/components/
tests/integration/
```

## TODO-056. Probar el dominio sin Vue

Anadir pruebas para:

- Validacion de respuestas.
- Reglas de preguntas.
- Progreso.
- Transiciones.
- Respuestas completas.

## TODO-057. Probar los casos de uso

Cubrir:

- Invitacion inexistente.
- Invitacion utilizada.
- Error de repositorio.
- Envio correcto.
- Envio invalido.
- Reintento.
- Doble envio.

## TODO-058. Probar repositorios con contrato

Comprobar que los adaptadores Firebase cumplen las interfaces de aplicacion.

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
