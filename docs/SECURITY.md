# Arquitectura de seguridad — MentiPremios

## Decisión

El navegador accede **directamente a Firestore**. No hay Cloud Functions, ni
Firebase Authentication, ni App Check obligatorio. La frontera de confianza del
proyecto es el fichero `firestore.rules`, y el modelo entero se sostiene sobre una
sola idea:

> **Se puede hacer `get` de una invitación concreta si ya se conoce su
> identificador —que es la palabra secreta—, pero nunca se puede enumerar la
> colección.**

Sin `list`, nadie puede descubrir las palabras del resto de participantes ni
quién ha respondido ya. Ese es el motivo por el que una aplicación sin servidor
puede seguir tratando las palabras secretas como secretas.

Hay **una sola colección**, `codigos`, con un documento por persona. Antes de
votar ese documento tiene su nombre y `haVotado: false`; al votar, se le
añaden un campo por pregunta con la opción elegida. No hay documento de voto
aparte.

- `codigos`: `get` permitido; `list` prohibido; `create` y `delete` prohibidos;
  `update` permitido solo en el sentido `false → true` del campo `haVotado`, y
  solo los once campos de la lista blanca: `haVotado` y las diez preguntas.
- `palabrasClave`: solo `create`.
- `/{document=**}`: `allow read, write: if false`. Red de seguridad para
  cualquier ruta que no esté declarada de forma explícita.

La lista blanca de `update` es `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`,
y tiene que coincidir con `QUESTION_IDS` de
`src/features/survey/domain/survey.types.ts`. No es decoración: es lo que impide
cambiar `nombre` o escribir un campo inventado, y es la razón por la que añadir
una pregunta al catálogo exige tocar también `firestore.rules`.

## Por qué esto resiste

**Leer una invitación no es una escalada de privilegios.** El identificador del
documento *es* la credencial, y la aplicación no puede validar una palabra que no
ha leído. Permitir `get` no abre nada que no estuviera ya en manos de quien tiene
la palabra.

**Enumerar sí lo sería.** Con `list` sobre `codigos`, cualquiera con la URL de la
aplicación y un script de cinco líneas obtendría todos los identificadores, es
decir, **todas las palabras secretas**, y podría responder por todo el grupo. Es
el ataque que el diseño elimina por completo, no por dificultad.

**Un voto es de un solo uso y a prueba de sobrescritura.** `update` exige que
`haVotado` pase de `false` a `true`, así que un segundo envío choca contra las
reglas en lugar de alterar el primero, y ninguna invitación ya votada se puede
devolver a `false`. La unicidad la garantiza la regla, no una comparación de
contenidos en un servidor.

**No hay nada que reconciliar.** Como el voto vive en el propio documento de la
persona, el envío es una única escritura: no existe el estado en el que la
respuesta está guardada y la invitación libre, ni el caso de una respuesta
huérfana que hubiera que arreglar después.

**El nombre de la persona tampoco lo elige el cliente.** `nombre` no está en la
lista blanca de `update`, así que desde el navegador es inmutable, y no se
escribe nada nuevo con él al votar.

**El comodín no se desactiva.** Declarar `match /codigos/{id}` abre solo esa ruta;
el `allow read, write: if false` final sigue denegando todo lo demás. Por eso
permitir `get` en `codigos` no filtra `palabrasClave`.

## El coste: leer a un amigo devuelve sus respuestas

Es el precio consciente de tener una sola colección, y conviene decirlo claro en
lugar de descubrirlo en la gala.

El `get` que hace el login es el mismo que puede hacer cualquiera que conozca una
palabra, y devuelve el documento **entero**. Como el voto vive ahí, si esa
persona ya ha votado, quien tiene su palabra ve también **cómo votó**: las diez
opciones elegidas. Las reglas no pueden evitarlo sin romper el login, porque el
login necesita exactamente esa lectura.

Qué se gana a cambio:

- Un único documento por persona, sin referencias que mantener entre colecciones.
- Una única escritura al votar, en lugar de dos documentos coordinados.
- Ningún voto huérfano posible, y ninguna reconciliación que hacer después.

Qué se pierde:

- El secreto de la palabra pasa a ser también el secreto de las respuestas de esa
  persona. No es un fallo de implementación: es la consecuencia directa de que el
  documento sea la invitación y el voto a la vez.

Por qué es aceptable aquí: las respuestas son votaciones de premios entre amigos,
no datos personales ni información que alguien quiera mantener en privado frente
al propio grupo, y quien tiene la palabra de alguien ya es alguien de confianza
para ella. Si algún día eso dejara de ser cierto, el sitio correcto para
separarlo es volver a dos colecciones —o mover el voto al lado del servidor—, y
la decisión queda anotada en [MIGRATION.md](MIGRATION.md) para que no se pierda.

## Qué se puede ver desde la consola de Firebase

**Todo.** La consola opera con permisos de administrador del proyecto y no le
afectan estas reglas, que gobiernan a los clientes del SDK. Eso significa que el
organizador puede seguir viendo la colección `codigos` entera, el estado de
`haVotado` de cada participante y las respuestas ya guardadas, para organizar la
gala.

Es una distinción que conviene tener clara porque se presta a confusión: la
regla protege contra navegadores ajenos, no contra quien administra el proyecto.
Quien tenga acceso a la consola ya puede leer los datos de todas formas; lo que
no puede hacer sin querer es publicarlos.

## Límites de la credencial

La palabra secreta es una **credencial bearer**: quien la conoce puede responder.
No acredita identidad real, no se puede revocar sin invalidar el enlace de la
persona, y no protege frente a alguien que la haya vista por un canal que no
controlamos. Con el modelo de una sola colección, quien la conoce además puede
leer las respuestas de esa persona si ya ha votado (ver
[El coste](#el-coste-leer-a-un-amigo-devuelve-sus-respuestas)): es la otra cara
de que el identificador sea la credencial y de que el documento sea a la vez la
invitación y el voto.

Esto es aceptable para unas votaciones privadas entre amigos, y es una decisión,
no un descuido. Si algún día hay datos que exijan más, el sitio correcto para
añadir identidad es Firebase Authentication, no una palabra más larga.

Las palabras deben generarse con entropía suficiente y entregarse por privado.
Reutilizarlas entre ediciones permite a quien conserve la antigua volver a
responder.

## App Check

Opcional, y **no es lo que protege las palabras**. `client.ts` solo llama a
`initializeAppCheck` si existe `VITE_FIREBASE_APP_CHECK_SITE_KEY`; si falta, la
aplicación arranca igual y no lanza ningún error. La razón de que sea opcional es
que una variable de entorno ausente no puede ser la causa de que la gala no
funcione.

Si se activa, añade una defensa frente a clientes que no son esta aplicación —
bots que reutilicen las credenciales públicas del bundle—, pero sigue sin ser una
sustitución de la regla `list: if false`, que es la que impide descubrir las
palabras.

## Requisitos de despliegue

- Un proyecto de Firebase con Firestore habilitado. **El plan gratuito basta**: no
  hay Functions que desplegar.
- Una app web registrada, para obtener las seis variables `VITE_FIREBASE_*`. Ninguna
  es secreta; el prefijo `VITE_` significa que viajan en el bundle.
- `firestore.rules` desplegadas con `firebase deploy --only firestore:rules --project mentipremios`.
- Nunca expongas credenciales de Admin SDK ni claves privadas de cuenta de servicio
  al navegador. El proyecto no las usa en absoluto: el acceso es el de un cliente
  del SDK, sujeto a las reglas.

## El contrato está verificado

`tests/unit/contracts/firestoreRules.spec.ts` fija estas reglas por texto: que
`codigos` tiene `get` y no `list`, que `create` y `delete` están negadas, que
`update` exige `false → true` en `haVotado` con `diff(...).hasOnly([...])`, que
esa lista coincide con `QUESTION_IDS`, que no queda rastro de la colección
`respuestas` y que el comodín lo deniega todo. Una edición que abra la colección
entera es un test rojo antes de llegar a producción, que es exactamente la
intención: este proyecto no tiene un servidor al que culpar si las reglas se
aflojan.