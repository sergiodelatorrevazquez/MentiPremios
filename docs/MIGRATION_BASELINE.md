# Linea base funcional

Esta linea base describe el comportamiento que debe conservarse durante la migracion hacia el monolito modular, y que sigue siendo valido despues del cambio al acceso directo a Firestore ([Fase 13](MIGRATION.md#fase-13-acceso-directo-del-cliente-a-firestore)).

## Flujo principal

1. La aplicacion comienza en la pantalla de login.
2. El boton de entrada permanece deshabilitado mientras la palabra secreta esta vacia.
3. Una palabra secreta inexistente muestra un error de invitacion incorrecta.
4. Una invitacion marcada como usada muestra un error y no permite continuar.
5. Una invitacion valida muestra la pantalla de bienvenida con el nombre del participante.
6. El usuario puede iniciar la encuesta y avanzar por diez preguntas.
7. Cada pregunta permite seleccionar una unica opcion.
8. La navegacion hacia atras vuelve a la pregunta anterior y conserva su seleccion.
9. La primera pregunta mantiene deshabilitado el boton de volver atras.
10. En la ultima pregunta, el envio guarda las diez respuestas y marca la invitacion como usada.
11. Tras un envio correcto se muestra la pantalla de agradecimiento.

## Visores

- El avatar abre el visor de la foto grupal mediante click.
- El visor del avatar se cierra haciendo click fuera o usando el boton de cierre.
- Las opciones multimedia abren el visor mediante pulsacion larga.
- El visor multimedia se cierra usando el boton de cierre.

## Contrato observado en Firestore

El envio se materializa en una unica transaccion que escribe dos documentos:

```ts
// respuestas/{invitationId}
{
  schemaVersion: 2,
  participantName: string,        // copiado de codigos/{invitationId}.nombre
  answers: Record<string, string>,
  createdAt: Timestamp,
  submittedAt: Timestamp,
}

// codigos/{invitationId}
{ usado: true }
```

El identificador del documento de respuesta es el mismo que el de la invitacion, y
el nombre de la persona se copia de la invitacion en lugar de venir del cliente.
Estas dos cosas son el contrato, no detalles de implementacion: la primera es lo que
impide sobrescribir un envio anterior, y la segunda es lo que impide escribir el
nombre de otra persona.

El contrato legado `{ usuario, premios }` que se observaba en las primeras fases ya
no existe: `respuestas/{invitationId}` guarda un documento por pregunta dentro de
`answers`, versionado con `schemaVersion: 2`.

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