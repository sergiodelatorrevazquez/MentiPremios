# Seguridad — MentiPremios

## La idea

El navegador accede **directamente a Firestore**. No hay Cloud Functions, ni
Firebase Auth, ni App Check obligatorio. La frontera de confianza es
`firestore.rules`, y todo se sostiene sobre una sola frase:

> Se puede hacer `get` de un documento concreto si ya se conoce su
> identificador —la palabra secreta—, pero **nunca** se puede enumerar la
> colección.

Sin `list`, nadie descubre las palabras del resto ni quién ha voted ya. Eso es
lo que permite que una app sin servidor trate las palabras como secretas.

Hay **una colección por persona**, `codes`, con un documento por persona. Antes
de votar es literalmente un campo, `voted: false`. Al votar se le añade
`voted: true` y un campo por pregunta con la opción elegida. **No guarda ningún
dato de la persona** —ni nombre, ni horas, ni versión—, porque el identificador
ya la identifica. No hay documento de voto aparte.

Y hay un **único documento de totales**, `resumen/actual`, con un contador por
opción de la galería. No es una colección de personas: es un contador agregado,
y su identificador está escrito en el bundle. Las reglas no permiten crearlo ni
borrarlo desde un cliente, así que ese documento lo crea el organizador a mano,
una vez, en la consola.

## Qué permiten las reglas

| Ruta | Permitido |
|---|---|
| `codes/{id}` | `get`. `update` solo en el sentido `false → true` de `voted`, y solo los once campos de la lista blanca: `voted` y las diez preguntas. `list`, `create` y `delete` prohibidos. |
| `resumen/actual` | Solo `get`. `update` únicamente con los diez contadores, uno por pregunta, cada uno exactamente `+ 1`. `list`, `create` y `delete` prohibidos. |
| `palabrasClave/{id}` | Solo `create`. |
| `/{document=**}` | Nada. Red de seguridad para lo que no se declare. |

La lista blanca de `codes` es
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` y tiene
que coincidir con `QUESTION_IDS` de
`src/features/survey/domain/survey.types.ts`. No es decoración: es lo que impide
escribir un campo inventado, y la razón de que añadir una pregunta al catálogo
exija tocar también `firestore.rules`.

Las de `resumen` son más estrictas, porque los contadores los van a escribir
clientes y de ellos sale lo que se anuncia como ganador:

- `changed().size() == 10` y `changed().hasOnly([...48 opciones del catálogo])`
  impiden añadir campos o tocar contadores de la nada.
- Diez cláusulas `changed().hasAny([...opciones de esa pregunta])` obligan a que
  cada voto toque **exactamente una** opción de cada premio. Sin ellas, un
  cliente podría sumar su voto solo a los premios que le convienen.
- Cuarenta y ocho cláusulas `!changed.has(id) || request... == resource... + 1`
  obligan a que cada contador que toque suba **de uno en uno**. Por eso el
  cliente escribe el número final y no usa `increment()`: la regla solo puede
  comprobar un incremento si ve la cantidad en `request.resource.data`.

El paréntesis que abre esa disyunción y el que la cierra son obligatorios. Sin
él, `a && b || c || d` se lee como `((a && b) || c) || d`, y como casi todas las
condiciones son ciertas el `||` final dejaría pasar la escritura entera: la
regla comprobaría nada. Hay un test que fija la forma exacta.

## Por qué aguanta

**Leer una invitación no es una escalada.** El identificador *es* la
credencial, y la app no puede validar una palabra que no ha leído. Permitir
`get` no abre nada que no estuviera ya en manos de quien tiene la palabra.

**Enumerar sí lo sería.** Con `list` sobre `codes`, cualquiera con la URL y un
script de cinco líneas obtendría todos los identificadores, es decir **todas las
palabras**, y podría responder por el grupo entero. Es el ataque que este
diseño elimina por completo, no por dificultad.

**Un voto es de un solo uso.** `update` exige que `voted` pase de `false` a
`true`, así que un segundo envío choca contra las reglas en vez de sobrescribir,
y ninguna invitación ya votada vuelve a `false`. Lo garantiza la regla, no una
comparación en un servidor.

**No hay nada que reconciliar.** El voto vive en el propio documento, así que
guardarlo es **una única escritura**. Los contadores de la galería son una segunda
escritura, pero **van en la misma transacción de Firestore**: el servidor aplica
las dos o ninguna. No existe el estado en que la respuesta está guardada y la
invitación libre, ni el voto huérfano que haya que arreglar, ni el caso
contrario —el contador que sube y la respuesta que no— que dejaría la gala
anunciando un reparto que nadie votó.

## El coste: leer a un amigo devuelve sus respuestas

El `get` del login es el mismo que puede hacer cualquiera con una palabra, y
devuelve el documento entero. Como el voto vive ahí, **quien tiene la palabra de
alguien ve también cómo votó**. Las reglas no pueden evitarlo sin romper el
login, que necesita exactamente esa lectura.

Se gana un documento por persona, una escritura y cero reconciliación. Se
pierde que el secreto de la palabra sea también el secreto de las respuestas de
esa persona. Es aceptable aquí porque son votaciones entre amigos y quien tiene
la palabra de alguien ya es alguien de confianza para ella. Si algún día dejaría
de ser cierto, el sitio es volver a dos colecciones o mover el voto al servidor.

## Quién abre la gala

La palabra del organizador no está escrita en el bundle. La app no la compara con
una constante: al escribir una palabra pregunta primero si el documento
`codes/{esa palabra}` lleva `admin: true`, y solo entonces lee los totales. Esa
marca **no la puede poner un cliente**, porque la lista blanca de `update` en
`codes` no la incluye; solo la consola del proyecto puede añadirla. Un
visitante que se inventase su propia invitación con `admin: true` vería la
escritura rechazada por las reglas.

El número de lecturas es mínimo: un `get` de la invitación, un `get` de
`resumen/actual` y nada más. No hay `list` en ninguna de las dos rutas.

## El coste: los totales son públicos para quien tenga la app

`resumen/actual` se puede leer sin presentar ninguna palabra. No es un descuido:
su ruta está en el bundle y `get` no admite condiciones sin credenciales, porque
no hay ninguna. Quien abra las herramientas de desarrollo de la web y pegue
cinco líneas verá **el reparto completo de los votos**.

Es aceptable porque el documento **no contiene datos de nadie**: ni quién votó,
ni qué palabra usó, ni cuándo. Solo diez preguntas por el número de personas que
eligió cada opción, que es exactamente la información que la gala enseña a
mayor parte del grupo en la misma habitación. Aun así conviene decirlo: si algún
día el reparto llegara a tener que ser secreto, este diseño no sirve y el sitio
es mover los contadores al servidor.

## Lo que ve la consola de Firebase

**Todo.** Opera con permisos de administrador y no le afectan estas reglas, que
gobiernan a los clientes del SDK. El organizador sigue viendo la colección
entera, el `voted` de cada quien y las respuestas, para montar la gala. La regla
protege contra navegadores ajenos, no contra quien administra el proyecto.

## Límites de la credencial

La palabra es una **credencial bearer**: quien la conoce puede responder. No
acredita identidad real, no se revoca sin invalidar el enlace de esa persona, y
no protege frente a quien la haya visto por un canal que no controlamos. Si
algún día hacen falta datos que exijan más, el sitio es Firebase Auth, no una
palabra más larga.

App Check es opcional y **no es lo que protege las palabras**: `client.ts` solo
llama a `initializeAppCheck` si existe `VITE_FIREBASE_APP_CHECK_SITE_KEY`, y si
falta la app arranca igual sin error. Una variable ausente no puede ser la causa
de que la gala no funcione.

## Requisitos

- Firestore habilitado. **El plan gratuito basta**: no hay Functions que desplegar.
- Las seis variables `VITE_FIREBASE_*`. Ninguna es secreta; el prefijo `VITE_`
  significa que viajan en el bundle.
- `firebase deploy --only firestore:rules --project mentipremios`.
- Nunca expongas credenciales de Admin SDK ni claves privadas al navegador. El
  proyecto no las usa: el acceso es el de un cliente del SDK, sujeto a las reglas.

## El contrato está verificado

`tests/unit/contracts/firestoreRules.spec.ts` fija las reglas por texto: que
`codes` tiene `get` y no `list`, que `create` y `delete` están negadas, que
`update` exige `false → true` con `diff(...).hasOnly([...])`, que esa lista
coincide con `QUESTION_IDS` y que el comodín lo deniega todo. Para la galería
añade que `resumen` solo deja leer el documento `actual`, que su lista blanca y
sus diez listas por pregunta **se generan del catálogo real de preguntas** y que
las 48 comprobaciones de incremento están presentes y agrupadas en paréntesis.
Si alguien añade una opción al catálogo y olvida las reglas, el test se pone
rojo antes de que nadie vote.

`tests/unit/contracts/repositoryContracts.spec.ts` fija el lado del cliente: que
el voto y los contadores se escriben en la **misma** transacción, que las dos
lecturas ocurren **antes** de cualquier escritura —Firestore rechaza lo
contrario— y que el cliente calcula el número final en vez de usar
`increment()`.

Una edición que abra la colección entera, que permita subir un contador de más de
uno, o que rompa el orden de la transacción es un test rojo antes de llegar a
producción: este proyecto no tiene un servidor al que culpar si las reglas se
aflojan.

**Lo que no está verificado:** las reglas no se han compilado con el emulador de
Firestore, porque este entorno no tiene Java instalado. Los tests comprueban el
texto, no que el emulador lo acepte. Antes de dar la gala por buena, hay que
desplegar las reglas y comprobar en la consola que un voto suma y que una
escritura amañada se rechaza.
