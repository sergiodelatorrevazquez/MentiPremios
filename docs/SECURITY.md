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

Hay **una sola colección**, `codes`, con un documento por persona. Antes de
votar es literalmente un campo, `voted: false`. Al votar se le añade
`voted: true` y un campo por pregunta con la opción elegida. **No guarda ningún
dato de la persona** —ni nombre, ni horas, ni versión—, porque el identificador
ya la identifica. No hay documento de voto aparte.

## Qué permiten las reglas

| Ruta | Permitido |
|---|---|
| `codes/{id}` | `get`. `update` solo en el sentido `false → true` de `voted`, y solo los once campos de la lista blanca: `voted` y las diez preguntas. `list`, `create` y `delete` prohibidos. |
| `palabrasClave/{id}` | Solo `create`. |
| `/{document=**}` | Nada. Red de seguridad para lo que no se declare. |

La lista blanca es
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` y tiene
que coincidir con `QUESTION_IDS` de
`src/features/survey/domain/survey.types.ts`. No es decoración: es lo que impide
escribir un campo inventado, y la razón de que añadir una pregunta al catálogo
exija tocar también `firestore.rules`.

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

**No hay nada que reconciliar.** El voto vive en el propio documento, así que el
envío es **una única escritura**. No existe el estado en que la respuesta está
guardada y la invitación libre, ni el voto huérfano que haya que arreglar.

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
coincide con `QUESTION_IDS` y que el comodín lo deniega todo. Una edición que
abra la colección entera es un test rojo antes de llegar a producción: este
proyecto no tiene un servidor al que culpar si las reglas se aflojan.
