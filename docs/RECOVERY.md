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

> No hay servidor detrás: cuando este documento habla de «la transacción» habla
> de la de Firestore que el navegador envía (`runTransaction` en
> `firestoreSurveyRepository.ts`), y cuando habla de un fallo de permisos habla de
> que la operación no encaja con `firestore.rules`. Ver [SECURITY.md](SECURITY.md).

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

Este es el caso que más cuidado merece, porque **la transacción puede haber
llegado a guardarse aunque la persona viera un error**.

**Qué ocurre:** si la red se cae antes de que la transacción llegue a Firestore,
aparece el mensaje del error clasificado (sin conexión, timeout o servicio no
disponible) y se ofrece «Reintentar envío». Las respuestas siguen en memoria, así
que el reintento no obliga a reescribir nada.

**Si la transacción sí llegó a guardarse y lo que se perdió fue el acuse de
Firestore**, el reintento devuelve «invitación ya usada». La aplicación lo trata
como un acierto: muestra la pantalla de confirmación con un mensaje que explica
que las respuestas ya estaban guardadas de un intento anterior, y no cuenta un
fallo en las métricas. Pedirle a alguien que vuelva a escribir veinte
respuestas que ya están en Firestore sería un fallo de la aplicación, no de la
persona.

**Por qué la invitación es la que arbitra:** la transacción marca la invitación
como usada y escribe la respuesta en la misma operación. O pasan las dos cosas, o
no pasa ninguna. No existe un estado intermedio en el que la respuesta esté
guardada y la invitación libre, así que el mensaje de la invitación es una fuente
fiable, no una heurística.

**Un matiz que conviene saber:** la persona no puede distinguir su respuesta ya
guardada de la que ella acaba de enviar. Su voto no se ve, así que tampoco hay
forma de arreglarlo desde su navegador. Es un coste aceptado del modelo: la
protección de una palabra que se comparte por privado, en lugar de una sesión de
usuario.

## 3. Firestore tarda o no está disponible

**Qué ocurre:** la petición no llega a completarse dentro del tiempo esperado o el
servicio responde con un error transitorio. `classifyNetworkError` lo clasifica
como `timeout` o `unavailable` y lo traduce a un mensaje que pide reintentar en un
momento.

**Un caso particular de este proyecto:** si la transacción entra en conflicto con
otra escritura, Firestore la aborta (`aborted`) y el SDK del cliente la reintenta
por su cuenta un número acotado de veces. El conflicto real aquí es doble envío
—dos pestañas con la misma palabra—, y como la segunda transacción ve `usado:
true`, sale por `already-used` en lugar de sobrescribir.

**Qué hacer si ocurre:** reintentar. Si el reintento dice que la invitación ya
se usó, el caso 2 aplica y la respuesta está a salvo.

**Sobre el momento del mensaje:** una confirmación en pantalla no es la prueba de
que haya datos en disco —la red puede cortarse entre la confirmación de Firestore
y la respuesta al navegador—. La invitación consumida sí lo es, y por eso el
mensaje que ve la persona no es la fuente fiable: lo es el estado de `usado`.

## 4. El código queda marcado pero la pantalla no cambia

**Qué ocurre:** la invitación se consumió en Firestore y la pantalla sigue
mostrando las preguntas, con respuestas que en realidad ya no cuentan.

**Cómo se detecta:** solo hay dos caminos, y los dos convergen en lo mismo. Si la
persona vuelve a enviar, la transacción ve la invitación usada y la aplicación pasa
a la pantalla de confirmación. Si la persona valida una invitación consumida,
aparece el mensaje de «ya has respondido» en el formulario, que es un final
honesto y no un error.

**Lo que no se hace:** la aplicación no consulta «¿esta invitación sigue viva?» en
cada cambio de pantalla. Sería una petición de red por cada pregunta para cerrar
un caso que el propio envío ya cierra, y convertiría un móvil con mala cobertura
en una aplicación inservible. La comprobación se hace en los dos momentos que
importan: al entrar y al enviar.

## 5. El despliegue de reglas se ha equivocado

**Qué ocurre:** se despliegan reglas que no encajan con lo que hace la aplicación.
El síntoma típico es un login que siempre responde «palabra secreta incorrecta»,
porque `getDoc` recibe `permission-denied` y el repositorio traduce el fallo como
invitación inexistente.

**Por qué el síntoma engaña:** «invitación no encontrada» y «no tienes permiso para
leerla» son la misma frase para quien está delante de la pantalla, y a propósito
—para no confirmar a un probador de palabras que la palabra existe o no—. El
diagnóstico está en la consola del navegador, en la petición que falla, y en la
pestaña de reglas de la consola de Firebase.

**Qué hacer si ocurre:** `firebase deploy --only firestore:rules --project mentipremios`,
y comprobar en la consola que las reglas desplegadas coinciden con el fichero del
repositorio. El flujo de pruebas de la lista de verificación de
[DEPLOYMENT.md §8](DEPLOYMENT.md#8-lista-de-verificación-pre-despliegue) existe
precisamente para que esto se detecte con una invitación de prueba antes de la gala.

## Resumen

| Escenario | Se pierden datos | Qué ve la persona | Requiere reescribir |
| --- | --- | --- | --- |
| Cierre de pestaña | Sí, todo | Bienvenida inicial | Sí |
| Red caída antes de llegar a Firestore | No | Error de red con reintento | No |
| Red caída con transacción ya confirmada | No | Confirmación, con explicación | No |
| Timeout o servicio no disponible | No | Mensaje de red con reintento | No |
| Invitación consumida con la pantalla sin cambiar | No | Confirmación o «ya has respondido» | No |
| Reglas desplegadas que no encajan | No | «Palabra secreta incorrecta» siempre | No, es un redeploy |

## Pruebas que sostienen este documento

- `tests/integration/App.spec.ts` cubre la confirmación tras un envío que ya
  estaba guardado, y que no se contabiliza como fallo.
- `tests/integration/App.spec.ts` cubre los cinco tipos de error de red con su
  mensaje, incluido el reintento.
- `tests/unit/application/networkError.spec.ts` fija la clasificación de cada
  código y mensaje, y que la causa de un error envolvido no se pierde.
- `tests/integration/bootstrap.spec.ts` cubre que `already-used` durante el envío
  se traduzca a un error que la interfaz trata como acierto.
- `tests/unit/contracts/firestoreRules.spec.ts` fija que `get` está permitido y
  `list` no, que es lo que hace que el caso 5 sea diagnosticable desde la consola.
- `tests/e2e/responsive.spec.ts` cubre que la acción de reintento siga siendo
  alcanzable con el mensaje de error en pantalla.
