# Linea base funcional

Esta linea base describe el comportamiento que debe conservarse durante la migracion hacia el monolito modular, y que sigue siendo valido despues del cambio al acceso directo a Firestore ([Fase 13](MIGRATION.md#fase-13-acceso-directo-del-cliente-a-firestore)) y de la unificacion de las votaciones en la propia coleccion de invitaciones ([Fase 14](MIGRATION.md#fase-14-una-sola-coleccion-codigos)).

## Flujo principal

1. La aplicacion comienza en la pantalla de login.
2. El boton de entrada permanece deshabilitado mientras la palabra secreta esta vacia.
3. Una palabra secreta inexistente muestra un error de invitacion incorrecta.
4. Una invitacion con `haVotado: true` muestra un error y no permite continuar.
5. Una invitacion valida muestra la pantalla de bienvenida con el nombre del participante.
6. El usuario puede iniciar la encuesta y avanzar por diez preguntas.
7. Cada pregunta permite seleccionar una unica opcion.
8. La navegacion hacia atras vuelve a la pregunta anterior y conserva su seleccion.
9. La primera pregunta mantiene deshabilitado el boton de volver atras.
10. En la ultima pregunta, el envio guarda las diez respuestas y marca la invitacion como ya votada.
11. Tras un envio correcto se muestra la pantalla de agradecimiento.

## Visores

- El avatar abre el visor de la foto grupal mediante click.
- El visor del avatar se cierra haciendo click fuera o usando el boton de cierre.
- Las opciones multimedia abren el visor mediante pulsacion larga.
- El visor multimedia se cierra usando el boton de cierre.

## Contrato observado en Firestore

Solo hay una coleccion, `codigos`, y el envio se materializa en una unica
transaccion que hace una unica escritura sobre el documento de la propia persona:

```ts
// codigos/{invitationId}
{
  haVotado: true,
  tonto: "tonto-1",
  casper: "casper-3",
  comefeas: "comefeas-2",
  soltero: "soltero-1",
  'anecdota': "anecdota-1",   // el id del campo no lleva tilde
  meme: "meme-4",
  mensaje: "mensaje-1",
  foto: "foto-2",
  video: "video-1",
  correa: "correa-1",
}
```

El documento de la invitacion ya traia `nombre` y `haVotado: false`; el envio
anade los diez campos de pregunta, uno por cada entrada de `QUESTION_IDS`, con
el id de la opcion elegida en la forma `<pregunta>-<n>`. No hay un mapa
anidado `answers`, ni `schemaVersion`, ni `participantName`, ni `createdAt` o
`submittedAt`, y no hay documento de voto aparte: la coleccion `respuestas` ya no
existe.

Que `haVotado` solo pueda pasar de `false` a `true` es parte del contrato, no un
detalle: es lo que impide sobrescribir un envio anterior. Y `nombre` no se
escribe al enviar, de modo que desde el cliente es inmutable.

El contrato legado `{ usuario, premios }` que se observaba en las primeras fases,
y despues el `respuestas/{invitationId}` con `schemaVersion: 2`, ya no existen:
el voto vive dentro del propio documento de la invitacion.

## Invariante que no debe romperse

La palabra secreta debe seguir siendo la unica credencial. Ninguna de estas
condiciones puede relajarse sin romper la funcionalidad:

- La validacion de una invitacion es una lectura **por identificador**, nunca una
  consulta sobre la coleccion.
- La coleccion de invitaciones **no se puede enumerar** desde el cliente.

Mientras esas dos cosas sean verdad, la linea base se sostiene con o sin backend.

## Comando de verificacion

```bash
npm test -- --run tests/integration/App.spec.ts
```

Las pruebas de esta linea base estan en `tests/integration/App.spec.ts`. No se debe eliminar ni modificar su comportamiento esperado sin actualizar primero este documento y acordar el nuevo contrato.