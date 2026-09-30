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

- `codigos`: `get` permitido; `list` prohibido; `create` y `delete` prohibidos;
  `update` permitido solo en el sentido `false → true` del campo `usado`, y solo
  ese campo.
- `respuestas`: solo `create`, exigiendo exactamente las cinco claves
  `schemaVersion`, `participantName`, `answers`, `createdAt`, `submittedAt`.
  `read`, `update` y `delete` prohibidos.
- `palabrasClave`: solo `create`.
- `/{document=**}`: `allow read, write: if false`. Red de seguridad para
  cualquier ruta que no esté declarada de forma explícita.

## Por qué esto resiste

**Leer una invitación no es una escalada de privilegios.** El identificador del
documento *es* la credencial, y la aplicación no puede validar una palabra que no
ha leído. Permitir `get` no abre nada que no estuviera ya en manos de quien tiene
la palabra.

**Enumerar sí lo sería.** Con `list` sobre `codigos`, cualquiera con la URL de la
aplicación y un script de cinco líneas obtendría todos los identificadores, es
decir, **todas las palabras secretas**, y podría responder por todo el grupo. Es
el ataque que el diseño elimina por completo, no por dificultad.

**La respuesta guardada es de un solo uso y a prueba de sobrescritura.** El
documento de `respuestas` usa el mismo identificador que la invitación, y como
`update` está prohibido allí, un segundo envío choca contra las reglas en lugar de
alterar el primero. La unicidad la garantiza la regla, no una comparación de
contenidos en un servidor.

**El nombre de la persona no lo elige el cliente.** La transacción copia
`nombre` desde la invitación. Aunque alguien manipule el DOM, el voto guardado
lleva el nombre de la invitación a la que pertenece.

**El comodín no se desactiva.** Declarar `match /codigos/{id}` abre solo esa ruta;
el `allow read, write: if false` final sigue denegando todo lo demás. Por eso
permitir `get` en `codigos` no filtra `palabrasClave`.

## Qué se puede ver desde la consola de Firebase

**Todo.** La consola opera con permisos de administrador del proyecto y no le
afectan estas reglas, que gobiernan a los clientes del SDK. Eso significa que el
organizador puede seguir viendo la colección `codigos` entera y el estado de
`usado` de cada participante para organizar la gala.

Es una distinción que conviene tener clara porque se presta a confusión: la
regla protege contra navegadores ajenos, no contra quien administra el proyecto.
Quien tenga acceso a la consola ya puede leer los datos de todas formas; lo que
no puede hacer sin querer es publicarlos.

## Límites de la credencial

La palabra secreta es una **credencial bearer**: quien la conoce puede responder.
No acredita identidad real, no se puede revocar sin invalidar el enlace de la
persona, y no protege frente a alguien que la haya visto por un canal que no
controlamos.

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
`codigos` tiene `get` y no `list`, que `update` está acotado a `usado` con `diff`,
que `respuestas` solo admite `create` con las cinco claves, y que el comodín lo
deniega todo. Una edición que abra la colección entera es un test rojo antes de
llegar a producción, que es exactamente la intención: este proyecto no tiene un
servidor al que culpar si las reglas se aflojan.