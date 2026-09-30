# Despliegue — MentiPremios

Lo mínimo para volver a levantar la web y para dejar el entorno listo para una
gala nueva.

## Desplegar la web

El flujo normal es un `git push` a `main`: Vercel construye y publica solo.

```bash
npm run typecheck && npm run lint && npm test -- --run
git push origin main
```

Las seis variables `VITE_FIREBASE_*` viven en el panel de Vercel. Vite solo
incrusta las que existen **en el momento del build**: si las cambias ahí, hay que
volver a desplegar, no basta con guardar.

Las reglas de Firestore son un despliegue aparte, y no se despliegan solas:

```bash
firebase deploy --only firestore:rules --project mentipremios
```

Si las reglas no están desplegadas o están en otro proyecto, el login falla
siempre con «la palabra secreta es incorrecta».

## Dejar listo una gala nueva

La colección `codes` tiene un documento por persona, y el ID **es** la palabra
secreta. Antes de una gala, cada documento debe estar reducido a un campo:

```
codes/pitufo {
  voted: false
}
```

Se puede hacer a mano en la consola de Firebase (14 documentos), o de una vez
desde la consola de administración de GCP > Firestore, o con la API de Firestore.
Lo importante es que **no quede ningún campo de pregunta ni `voted: true` de la
gala anterior**, porque el cliente nunca borra nada.

Palabras nuevas para una nueva edición: generarlas con entropía suficiente y
entregarlas por privado. Reutilizar las de la edición anterior permite a quien
conservó la suya volver a responder.

## Ver quién ha votado

La consola de Firebase muestra la colección entera, el `voted` de cada quien y
las respuestas ya guardadas: opera con permisos de administrador y no le afectan
`firestore.rules`. Está pensado para montar la gala. Ver
[SECURITY.md](SECURITY.md).

Para un volcado a texto, la misma consola permite exportar la colección.

## Los e2e necesitan librerías del sistema

Los 16 tests de `tests/e2e/` abren Chromium de verdad. Si al lanzarlos falla con
`libnspr4.so: cannot open shared object file`, no es un fallo del proyecto: a
Chromium le faltan cuatro librerías y **no las necesita para esta web**, solo
para arrancar el navegador.

La solución normal es `sudo npx playwright install-deps chromium`, que instala
`libnspr4`, `libnss3` y `libasound2t64` en el sistema.

Sin `sudo` se pueden usar las de los paquetes, sin instalar nada: descárgalas con
`apt-get download`, descomprímelas con `dpkg-deb -x` en un directorio y apunta
`LD_LIBRARY_PATH` a `usr/lib/x86_64-linux-gnu` de ese directorio. El directorio
no es del repositorio a propósito: son unos 2 MB de binarios del sistema, y
meterlos en git no toca nada.

## Si algo va mal

| Síntoma | Causa habitual |
|---|---|
| Pantalla en blanco | Faltan las seis variables en Vercel, o se añadieron después del build. |
| «La palabra secreta es incorrecta» siempre | Reglas sin desplegar, o desplegadas en otro proyecto. |
| Un error de permisos con `list` | Alguien intentó enumerar la colección. Está prohibido a propósito: el `get` con un ID que ya conoces sí funciona. |
| El ID correcto no entra | El ID va en minúsculas y sin espacios al final: se normaliza con `trim()` + `toLowerCase()`. `Galaxia-2025` es invisible. Se arregla renombrando el documento. |
| Una opción con imagen o vídeo sale gris | El asset no está en `src/assets/` con el nombre exacto que espera el catálogo (`foto-3.jpg`, `video-2.webm`…). `import.meta.glob` se resuelve en build: hay que recompilar. |

## Revertir

- **Frontend**: redeployar un commit anterior desde el panel de Vercel.
- **Reglas**: `firebase deploy --only firestore:rules` con la versión anterior
  del fichero. O desplegar un `deny-all` temporal, que es lo más seguro si hay
  duda de en qué estado han quedado las reglas.
- **Datos**: la consola de Firebase. Antes de tocar los datos a mano, exportar la
  colección; los permisos de administrador no hacen preguntas.

## Assets

Las fotos y vídeos son ficheros en `src/assets/` referenciados por el catálogo de
preguntas (`src/features/survey/domain/questions.ts` o el registro multimedia).
Un asset ausente no rompe la build a propósito: la opción sale con un marcador
gris y se cuenta en el contador `multimedia_failed`, para poder detectar que
falta algo en lugar de que nadie lo vea.
