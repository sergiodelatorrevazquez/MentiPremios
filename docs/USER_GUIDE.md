# Guía de usuario — MentiPremios

**MentiPremios** es una aplicación para votar los premios anuales de tu grupo de amigos. Cada persona recibe una **palabra secreta** única para acceder y responder.

---

## Acceder a la aplicación

1. Abre la URL que te haya enviado el organizador.
2. Verás la pantalla de bienvenida de **Sin Mentirosas no hay Traidores**.

## Introducir tu palabra secreta

1. Escribe la **palabra secreta** que te llegó por privado en el campo "Clave".
2. Pulsa el botón **"Entrar a mi encuesta"** o la tecla `Enter`.

**Posibles errores:**

| Mensaje | Qué significa |
|---|---|
| "La palabra secreta es incorrecta" | La palabra no existe. Revisa que la has escrito bien. |
| "Ya has respondido a la encuesta... con esta palabra secreta" | Ya usaste esta palabra antes. No se puede votar dos veces. |

## Pantalla de bienvenida

- Verás tu palabra secreta en grande.
- Lee la descripción (contiene una pista importante sobre la última pregunta).
- Pulsa **"Empezar la encuesta"** para comenzar.

## Responder las preguntas

Las 10 preguntas aparecen **una a una**. En cada pantalla:

1. **Barra de progreso**: muestra "Pregunta X de 10" y una barra de progreso visual.
2. **Título**: nombre de la categoría (ej: "Tonto del Año").
3. **Opciones**: botones con los candidatos. Pulsa uno para seleccionarlo (se resalta en verde).
4. **Navegación**:
   - **"← Atrás"**: vuelve a la pregunta anterior (solo disponible desde la 2ª pregunta en adelante).
   - **"Siguiente pregunta"**: avanza a la siguiente pregunta (solo disponible si has seleccionado una opción).
5. En la **última pregunta**, el botón cambia a **"Enviar y cerrar"**.

### Preguntas con imágenes o vídeos

Para las preguntas **Mensaje del Año**, **Foto del Año** y **Video del Año**:

- **Pulsa normalmente** sobre una opción para seleccionarla.
- **Mantén pulsado** (~300ms) sobre una opción para ver la imagen o el vídeo a pantalla completa. Puedes cerrar el visor pulsando fuera o en la **✕**.

### Lista completa de preguntas

| # | Categoría | Candidatos |
|---|---|---|
| 1 | Tonto del Año | Miguel, Pablo, Dani, Maroto |
| 2 | Casper del Año | Raúl, Jorge, Dani, Jose Álvaro, Pablo, Víctor |
| 3 | Comefeas del Año | Fran, Maroto, Dani, Enrique |
| 4 | Soltero del Año | Sergio Reyes, Ale, Maroto, Dani |
| 5 | Anécdota del Año | La quedada de verano, La cena de Navidad, El finde en el pueblo, etc. |
| 6 | Meme del Año | 8 memes internos del grupo |
| 7 | Mensaje del Año | 4 capturas de pantalla de mensajes |
| 8 | Foto del Año | 4 fotos del grupo |
| 9 | Video del Año | 4 vídeos del grupo |
| 10 | Correa del Año | Miguel (×4) — ¡todos los candidatos son Miguel! |

> **Nota sobre la Correa del Año**: todas las opciones son "Miguel". Es una pregunta de broma — no pienses demasiado.

## Finalizar la encuesta

Tras responder la última pregunta y pulsar **"Enviar y cerrar"**:

1. Tus respuestas se guardan en Firebase.
2. Tu palabra secreta queda marcada como ya utilizada, en el mismo paso que las respuestas.
3. Verás la pantalla **"Gracias por participar, [tu palabra]"** con un mensaje de confirmación.

Ya has terminado. Tus votos se usarán durante la gala de premios del grupo.

> Tus respuestas se guardan desde tu propio navegador, en una sola operación que las escribe y marca la palabra como utilizada. Si pierdes la conexión en ese instante, la aplicación te ofrecerá «Reintentar envío»: si ya se había guardado, te lo dirá y no tendrás que volver a escribir nada.

## Tu palabra secreta es la clave

Unos pocos detalles sobre seguridad que explican por qué la aplicación se comporta como se comporta:

- **No hay cuentas ni contraseñas.** Tu palabra secreta *es* tu credencial, y quien la tenga puede responder con ella.
- **Nadie puede ver el listado de palabras.** Aunque alguien tenga el enlace de la web, no puede abrir la lista de participantes ni descubrir las palabras del resto.
- **La palabra es de un solo uso.** En cuanto envías, deja de funcionar.
- **Tus respuestas se guardan en tu propia ficha.** Van en el mismo sitio que tu palabra, así que quien tenga tu palabra puede ver cómo votaste. Envía solo a gente de confianza.

Por eso la palabra debe viajar por privado: es tu voto, no solo tu entrada.

## Ver la foto del grupo

En la esquina superior izquierda hay un círculo con la foto del grupo. Púlsalo para verla a pantalla completa. Puedes cerrarla pulsando fuera o en la **✕**.

## Solución de problemas

| Problema | Solución |
|---|---|
| No recibo la palabra secreta | Contacta con el organizador del grupo |
| La app no carga | Comprueba tu conexión a internet |
| Error "Firebase" o "red" | Espera unos segundos y vuelve a intentarlo |
| Error de permisos al entrar | Espera unos minutos: lo más probable es que estén actualizando el sitio. Si persiste, avisa al organizador |
| No puedo pulsar "Siguiente" | Asegúrate de haber seleccionado una opción (se resalta en verde) |
| Dice que ya he respondido | Ya está guardado. No hace falta volver a hacerlo |
