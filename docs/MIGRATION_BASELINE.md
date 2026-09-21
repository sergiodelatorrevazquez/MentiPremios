# Linea base funcional

Esta linea base describe el comportamiento que debe conservarse durante la migracion hacia el monolito modular.

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

## Contrato observado del envio actual

La implementacion actual envia este formato al servicio:

```ts
{
  usuario: string,
  premios: Record<string, string>
}
```

El ID de `usuario` corresponde actualmente al ID de la invitacion. Este contrato debe considerarse legado hasta que se complete la definicion del DTO canonico.

## Comando de verificacion

```bash
npm test -- --run tests/unit/App.spec.ts
```

Las pruebas de esta linea base estan en `tests/unit/App.spec.ts`. No se debe eliminar ni modificar su comportamiento esperado durante las primeras fases de la migracion sin actualizar primero este documento y acordar el nuevo contrato.