# MentiPremios

Aplicación web para gestionar y recopilar respuestas de unos premios informales entre amigos, utilizando Vue 3, TypeScript, Composition API y Firebase como base de datos.

## Qué puedes hacer con la app

- **Responder a los premios**: cada persona puede rellenar quién se lleva cada premio y por qué.
- **Añadir palabras clave**: cada usuario puede proponer palabras o conceptos que definan a sus amigos.
- **Guardar todo en Firebase**: las respuestas y las palabras clave se guardan en dos colecciones separadas de Firestore.

## Flujo básico de uso

1. **Accede a la URL de la app** (deploy que hagas en Vercel, Netlify, Firebase Hosting, etc.).
2. **Escribe tu nombre o alias** en el campo superior.
3. **Rellena los premios** que quieras (no hace falta completar todos, pero al menos uno).
4. **Añade palabras clave**:
   - Escribe una palabra clave en el campo correspondiente.
   - Pulsa `Enter` o el botón **Añadir**.
   - Repite el proceso para tantas palabras como quieras.
5. **Envía el formulario** pulsando el botón **Enviar mis premios**.
6. Si todo va bien, verás un mensaje de confirmación indicando que las respuestas se han guardado en Firebase.

## Qué se guarda exactamente

- **Colección `respuestas`**:
  - `usuario`: nombre o alias que has escrito.
  - `premios`: objeto con clave = nombre del premio, valor = respuesta libre.
  - `createdAt`: marca de tiempo del servidor (`serverTimestamp` de Firebase).

- **Colección `palabrasClave`**:
  - `usuario`: el mismo identificador que has usado en el formulario.
  - `palabrasClave`: array de cadenas con las palabras clave que has introducido.
  - `createdAt`: marca de tiempo del servidor.

Ninguna de estas respuestas se muestra en la UI de la app al resto de usuarios; se guardan para su posterior consulta en la gala o para preparar contenido.

## Requisitos para que funcione

La app **necesita** que el archivo `.env` (o `.env.local`) esté configurado con tus claves reales de Firebase.  
El desarrollador debe haber configurado esto previamente (ver `DEV.md` para más detalles).

