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
galería anterior**, porque el cliente nunca borra nada.

Palabras nuevas para una nueva edición: generarlas con entropía suficiente y
entregarlas por privado. Reutilizar las de la edición anterior permite a quien
conservó la suya volver a responder.

## Dejar listo el documento de totales

Para la galería hace falta **un documento más**, y las reglas no dejan crearlo
desde la app. Hay que hacerlo en la consola de Firebase, **una vez**:

```
resumen/actual {
  // puede empezar vacío
}
```

Y hay que **dejar los contadores a cero** de la gala anterior, no solo vaciar
`voted`. El documento de totales no se reinicia solo: si se queda con los
números de la edición pasada, la galería los sumará y anunciará como ganador
quien ya ganó la otra vez. Lo más limpio es borrarlo y volver a crearlo vacío
desde la consola.

Si falta, **el primer voto de la gala falla entero**: el contador y la respuesta
se escriben en la misma transacción, así que si el documento no existe no se
guarda ninguno de los dos. Quien ya había votado antes de crearlo se encuentra
con «su palabra ya está usada», y lo que hay que hacer es borrar el `voted: true`
de esa invitación y dejar que vuelva a votar.

Para comprobar que está bien, basta con enviar un voto de prueba y mirar que en
el documento aparecen los diez contadores con un `1`.

## Marcar la palabra del organizador

La galería se abre con la palabra cuyo documento lleve la marca `admin: true`, y
esa marca **solo se puede poner desde la consola**, nunca desde la app:

```
codes/admindltv {
  voted: false,
  admin: true
}
```

Sin ella, la palabra hace su camino normal y quien la escribe contesta la
encuesta. Comprobación rápida: entrar con esa palabra y ver que aparecen las
tartas en lugar del cuestionario.

## Ver quién ha votado

La consola de Firebase muestra la colección entera, el `voted` de cada quien y
las respuestas ya guardadas: opera con permisos de administrador y no le afectan
`firestore.rules`. Está pensado para montar la galería. Ver
[SECURITY.md](SECURITY.md).

Para un volcado a texto, la misma consola permite exportar la colección.

## Los e2e necesitan librerías del sistema

Los 30 tests de `tests/e2e/` abren Chromium de verdad. Si al lanzarlos falla con
`libnspr4.so: cannot open shared object file`, no es un fallo del proyecto: a
Chromium le faltan `libnspr4`, `libnss3` y `libasound2t64`, y esta web **no usa
ninguna** de las tres. Solo hacen falta para que el navegador arranque.

La solución permanente es `sudo npx playwright install-deps chromium`.

Si no hay `sudo`, `scripts/fetch-e2e-libs.sh` deja esas librerías en
`~/.local/share/pwlibs` (unos 5 MB) **sin instalar nada en el sistema**: las
descarga de los paquetes de Ubuntu y las descomprime ahí. Es idempotente, así
que repetirlo no hace nada. A partir de ese momento `npm run test:e2e` las
encuentra solo, porque `scripts/e2e.sh` añade ese directorio a `LD_LIBRARY_PATH`
solo si existe.

Las dos librerías se pueden dejar donde uno quiera con la variable `PWLIBS`.

## Si algo va mal

| Síntoma | Causa habitual |
|---|---|
| Pantalla en blanco | Faltan las seis variables en Vercel, o se añadieron después del build. |
| «La palabra secreta es incorrecta» siempre | Reglas sin desplegar, o desplegadas en otro proyecto. |
| Un error de permisos con `list` | Alguien intentó enumerar la colección. Está prohibido a propósito: el `get` con un ID que ya conoces sí funciona. |
| El ID correcto no entra | El ID va en minúsculas y sin espacios al final: se normaliza con `trim()` + `toLowerCase()`. `Galaxia-2025` es invisible. Se arregla renombrando el documento. |
| Una opción con imagen o vídeo sale gris | El asset no está en `src/assets/` con el nombre exacto que espera el catálogo (`foto-3.jpg`, `video-2.webm`…). `import.meta.glob` se resuelve en build: hay que recompilar. |
| Al entrar da error y no guarda el voto | Falta el documento `resumen/actual`. Voto y contadores van en la misma transacción, así que sin ese documento no se guarda ninguno de los dos. Ver [Dejar listo el documento de totales](#dejar-listo-el-documento-de-totales). |
| La palabra del organizador entra al cuestionario | Su documento no lleva `admin: true`, o las reglas sin desplegar. Ver [Marcar la palabra del organizador](#marcar-la-palabra-del-organizador). |
| La galería sale vacía aunque haya votos | El documento de totales se creó en otro proyecto. |
| La galería anuncia un ganador de la edición anterior | Los contadores de `resumen/actual` no se pusieron a cero al preparar la gala nueva. |

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
