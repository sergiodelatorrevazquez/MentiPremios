# Recuperación ante fallos

Este documento fija qué hace la aplicación cuando algo se rompe a mitad de una
encuesta. Es deliberadamente explícito: los casos raros que no están escritos
terminan siendo decididos por el código en el momento en que aparecen, que es
la peor forma de decidir.

## Principio general

La invitación es el único estado que sobrevive a un fallo, y solo porque la
pide la persona, no porque la aplicación lo guarde. Todo lo demás —palabra
secreta, respuestas y nombre— vive en memoria. No hay `localStorage`, ni
`sessionStorage`, ni cookies. La razón es directa: son datos personales y
guardarlos en el navegador del participante convertiría un fallo de red en una
fuga de datos.

La contrapartida es que la aplicación no puede hacer magia con lo que no
tiene, y por eso cada escenario de abajo dice exactamente qué se pierde.

## 1. La persona cierra la pestaña o recarga la página

**Qué ocurre:** se pierde todo. Al volver, la aplicación muestra la pantalla
de bienvenida, como si fuera la primera visita.

**Por qué:** las respuestas solo existen en la memoria de la pestaña. Recuperar
la palabra secreta automáticamente significaría guardarla en el dispositivo, y
guardarla junto con las respuestas convertiría un ordenador compartido en un
sitio donde se pueden leer datos de otra persona.

**Qué hacer si ocurre:** volver a introducir la palabra secreta de la
invitación y contestar de nuevo. El borrador en papel o el correo de la
invitación siguen ahí, y la encuesta es corta.

**Lo que no se hace:** no se pide confirmación de salida ni se intenta
`beforeunload`. Un aviso que aparece en cada pregunta estorba más de lo que
informa, y no protege el dato: si la pestaña se cierra, el dato ya se ha
quedado solo en una memoria que el sistema operativo acabará borrando.

## 2. Falla la red después del envío

Este es el caso que más cuidado merece, porque **el servidor puede haber
guardado la respuesta aunque la persona viera un error**.

**Qué ocurre:** si la red se cae antes de que la transacción llegue al
servidor, aparece el mensaje del error clasificado (sin conexión, timeout o
servicio no disponible) y se ofrece «Reintentar envío». Las respuestas siguen
en memoria, así que el reintento no obliga a reescribir nada.

**Si la transacción sí llegó a guardarse y lo que se perdió fue la respuesta
HTTP**, el reintento devuelve «invitación ya usada». La aplicación lo trata
como un acierto: muestra la pantalla de confirmación con un mensaje que explica
que las respuestas ya estaban guardadas de un intento anterior, y no cuenta un
fallo en las métricas. Pedirle a alguien que vuelva a escribir veinte
respuestas que ya están en Firestore sería un fallo de la aplicación, no de la
persona.

**Por qué la invitación es la que arbitra:** el servidor marca la invitación
como usada dentro de la misma transacción que escribe la respuesta. O pasan
las dos cosas, o no pasa ninguna. No existe un estado intermedio en el que la
respuesta esté guardada y la invitación libre, así que el mensaje de la
invitación es una fuente fiable, no una heurística.

## 3. El servidor responde tarde

**Qué ocurre:** Cloud Functions da por agotado su propio plazo y responde con
`deadline-exceeded`. La aplicación lo clasifica como `timeout` y lo traduce a un
mensaje que pide reintentar en un momento.

**Sobre la escritura perezosa:** la transacción se confirma con una escritura
diferida, de modo que el servidor responde antes de terminar de escribir. Esto
reduce la ventana del caso 2, pero no la cierra, y por eso el caso 2 se
resuelve igual. Un mensaje de éxito no es la prueba de que haya datos en
disco; la invitación consumida sí lo es.

**Qué hacer si ocurre:** reintentar. Si el reintento dice que la invitación ya
se usó, el caso 2 aplica y la respuesta está a salvo.

## 4. El código queda marcado pero la pantalla no cambia

**Qué ocurre:** la invitación se consumió en el servidor y la pantalla sigue
mostrando las preguntas, con respuestas que en realidad ya no cuentan.

**Cómo se detecta:** solo hay dos caminos, y los dos convergen en lo mismo.
Si la persona vuelve a enviar, el servidor responde «invitación ya usada» y
la aplicación pasa a la pantalla de confirmación. Si la persona valida una
invitación consumida, aparece el mensaje de «ya has respondido» en el
formulario, que es un final honesto y no un error.

**Lo que no se hace:** la aplicación no consulta al servidor «¿esta invitación
sigue viva?» en cada cambio de pantalla. Sería una petición de red por cada
pregunta para cerrar un caso que el propio envío ya cierra, y convertiría un
móvil con mala cobertura en una aplicación inservible. La comprobación se hace
en los dos momentos que importan: al entrar y al enviar.

## Resumen

| Escenario | Se pierden datos | Qué ve la persona | Requiere reescribir |
| --- | --- | --- | --- |
| Cierre de pestaña | Sí, todo | Bienvenida inicial | Sí |
| Red caída antes de llegar al servidor | No | Error de red con reintento | No |
| Red caída con transacción ya confirmada | No | Confirmación, con explicación | No |
| Timeout del servidor | No | Mensaje de timeout | No |
| Invitación consumida con la pantalla sin cambiar | No | Confirmación o «ya has respondido» | No |

## Pruebas que sostienen este documento

- `tests/integration/App.spec.ts` cubre la confirmación tras un envío que el
  servidor ya tenía, y que no se contabiliza como fallo.
- `tests/integration/App.spec.ts` cubre los cinco tipos de error de red con su
  mensaje, incluido el reintento.
- `tests/unit/application/networkError.spec.ts` fija la clasificación de cada
  código y mensaje, y que la causa de un error envolvido no se pierde.
- `tests/e2e/responsive.spec.ts` cubre que la acción de reintento siga siendo
  alcanzable con el mensaje de error en pantalla.
