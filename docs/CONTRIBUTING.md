# Guía de contribución — MentiPremios

Esta guía responde a las seis preguntas que aparecen siempre la primera vez que
se toca el proyecto: **dónde añado una pregunta, dónde toco el modelo, dónde
añado un repositorio, cómo paso los tests, cómo paso el typecheck y cómo
añado multimedia.**

Si algo de lo que hay aquí no coincide con el código, es un bug de esta guía y
corrección bienvenido.

---

## Antes de tocar nada

```bash
npm ci                                  # o npm install la primera vez
cp .env.example .env.local              # credenciales de desarrollo
firebase deploy --only firestore:rules --project mentipremios
npm run dev
```

Las seis variables `VITE_FIREBASE_*` están explicadas en
[DEV_SETUP.md](DEV_SETUP.md#3-configurar-firebase). Ninguna es secreta: el prefijo
`VITE_` significa que viajan dentro del bundle.

`VITE_FIREBASE_APP_CHECK_SITE_KEY` es **opcional** y no hace falta para trabajar.
Si la defines, se activa reCAPTCHA v3; si no, la aplicación arranca igual y no
lanza ningún error. No hay que habilitar nada en Firebase Authentication: el
proyecto no usa Firebase Auth.

El paso de `firebase deploy` es el que más se olvida: **sin reglas desplegadas el
login no funciona**, porque el navegador accede a Firestore directamente y las
reglas son la frontera de seguridad del proyecto.

---

## 1. Dónde añadir una pregunta

Hay **un** sitio: `src/features/survey/domain/questions.ts`, el array `preguntas`.

Ejemplo de pregunta nueva:

```typescript
{
  id: 'nueva',
  titulo: 'Nueva Pregunta del Año',
  opciones: [
    { id: 'nueva-1', texto: 'Opción 1' },
    { id: 'nueva-2', texto: 'Opción 2' },
  ],
}
```

No hay allowlist en un servidor que pueda irse por detrás: `validateSurveyAnswers`
valida cada respuesta contra el catálogo y `submitSurvey` exige una respuesta por
cada pregunta. El catálogo es la única fuente de verdad.

**Añadir una opción a una pregunta que ya existe sí es compatible**: los
documentos ya guardados siguen siendo válidos porque la validación es por
pertenencia. Añadir, quitar o renombrar una pregunta **no** lo es, porque cambia
el número de respuestas que se exigen. Para un cuestionario que ya tiene respuestas,
planéalo como una migración: ver
[DEPLOYMENT.md §4.2](DEPLOYMENT.md#42-cambiar-el-catálogo-de-preguntas).

---

## 2. Dónde modificar el modelo

| Cambio | Dónde |
|---|---|
| Un campo nuevo en una invitación | `firestore.rules` (si el cliente va a escribirlo) y `parseInvitation` en `firestoreSurveyRepository.ts` |
| Un campo nuevo en lo que se guarda al votar | `firestoreSurveyRepository.ts` (el `update`) **y** la lista `hasOnly` de `firestore.rules` |
| Una pregunta nueva en el catálogo | `questions.ts` y `QUESTION_IDS` en `survey.types.ts` **y** la lista `hasOnly` de `firestore.rules` |
| Un tipo del cliente | `src/features/survey/domain/survey.types.ts` |
| Una regla de validación de respuestas | `src/features/survey/domain/survey.rules.ts` |

**Aviso que no es negociable:** las reglas acotan `update` a una lista blanca
exacta —`haVotado` y los diez IDs de pregunta—, y esa lista tiene que coincidir
con `QUESTION_IDS`. Si añades un campo al `update` del repositorio y olvidas la
lista, la escritura se rechaza con `permission-denied` y el envío falla en la
casa de quien participa. Un cambio de esquema son **dos** cambios, siempre, y uno
de ellos está en un fichero que no es TypeScript. El test de contrato
`tests/unit/contracts/firestoreRules.spec.ts` es el que avisa del desajuste.

El tipo que se valida y el que se guarda **no son el mismo**, y confundirlos rompe
el contrato. El caso de uso produce `{ invitationId, answers }` —sin
`participantName` ni nada más, porque la persona ya la identifica el id del
documento— y el `update` escribe `{ haVotado: true, ...answers }` sobre el
documento de la invitación. El nombre no se toca: no está en la lista blanca, así
que desde el navegador es inmutable.

---

## 3. Dónde añadir un repositorio

En `src/infrastructure/firebase/`, con un fichero por colección y una función por
operación. `firestoreSurveyRepository.ts` es la referencia a copiar:

```typescript
// src/infrastructure/firebase/miColeccionRepository.ts
export class MiColeccionRepository implements MiContrato {
  constructor(private readonly db: Firestore) {}

  guardar(datos: Dato): Promise<Resultado> { /* … */ }
}
```

Y su contrato se fija en `tests/unit/contracts/repositoryContracts.spec.ts`, que
comprueba la forma de la API, no su implementación.

Dos restricciones que no son de estilo:

- **Lo que el navegador puede hacer lo deciden las reglas, no el repositorio.**
  `firestore.rules` deniega por defecto. Una colección nueva necesita su propio
  `match` desplegado antes de que el código funcione, y hay que decidir con
  cuidado si admite `list`: permitirlo publica la colección entera.
- **`infrastructure/` no contiene reglas de interfaz.** Nada de Vue, nada de
  SFC, nada de CSS. Está verificado en `dependencyRules.spec.ts` y romperlo es un
  test rojo, no una discusión.

Y una restricción que aquí sí es técnica y no de diseño: sobre `codigos` no se
puede consultar, solo leer por identificador. El repositorio **no usa
`getDocs`, `query` ni `where`**, porque una consulta es un `list` y `list` está
prohibido. También lo fija un test.

---

## 4. Cómo ejecutar los tests

```bash
npm run test:unit -- --run         # unitarias, la respuesta rápida
npm run test:integration -- --run  # la app entera con los dobles externos
npm run test:e2e                   # Chromium real, móvil y escritorio
npm test -- --run                  # unitarias + integración de golpe
npm run test:ui                    # dashboard interactivo
```

Las tres capas no sonidian el mismo aviso:

| Capa | Responde a |
|---|---|
| `unit` | ¿La lógica hace lo que dice? |
| `integration` | ¿Las piezas encajan de verdad? |
| `e2e` | ¿Se ve bien y se puede usar en un móvil? |

Un test que se puede pasar sin montar la app va a `unit`. Si necesita Vue Test
Utils, va a `components/`. Si necesita la app entera con un solo doble, va a
`tests/integration/`. `tests/unit/contracts/testLayout.spec.ts` falla si una spec
aparece fuera de sitio, así que la decisión no es libre.

**Lo que debe fijar cada cambio:**

- Una función nueva → su test va primero, y falla antes de existir la función.
- Un bug de lógica → un test que lo reproduzca, que falle, y que deje de fallar al arreglarlo.
- Un cambio de UI → un test de `components/` y, si cambia el recorrido, uno de `integration`.

En local, Playwright necesita las librerías de Chromium del sistema. Si falla al arrancar:

```bash
LD_LIBRARY_PATH=/ruta/a/chromium-libs/usr/lib/x86_64-linux-gnu npm run test:e2e
```

---

## 5. Cómo ejecutar el typecheck

```bash
npm run typecheck
```

Es `vue-tsc --noEmit`: comprueba los `.ts` y también las plantillas de los
`.vue`, que es donde se cuelan los errores. No emite nada, así que se puede
ejecutar en cualquier momento.

Si toca añadir un tipo para un SFC y el IDE protesta con que no encuentra el
módulo `*.vue`, el shim ya está en `src/vue-shim.d.ts`; si sigue fallando,
falta el `vue-tsc` y no el shim.

**Limpieza de `any`:** si te ves obligado a escribir `any`, casi siempre falta
un tipo en `survey.types.ts` en lugar de faltar una aserción. Los `unknown` con
`instanceof` son la herramienta para tratar datos externos, no un atajo.

---

## 6. Cómo añadir multimedia

1. Mete el archivo en `src/assets/` con el nombre exacto que espera el
   catálogo: `mensaje-N.jpg`, `foto-N.jpg`, `video-N.mp4`.
2. Para vídeos, añade también `video-N.webm`. El registro genera las dos
   fuentes y reproduce la que el navegador soporte; con una sola, se ve en un
   navegador y falla en el otro.
3. Nada más. `multimediaRegistry.ts` lo recoge con `import.meta.glob` en el
   siguiente build.

Por qué el nombre importa tanto: el patrón `import.meta.glob` **es** el
contrato. Un archivo llamado `Foto-3.JPG` no se encuentra, y el fallo no rompe
la build, sino que la opción cae en el marcador `/media-unavailable.svg` con
«(recurso no disponible)» en su texto alternativo. Es silencioso a propósito
para no tumbar la aplicación por un asset, y por eso hay un contador
`multimedia_failed` que es la forma de detectarlo desde el producto.

La foto del avatar es la excepción: no pasa por el registro, y su ruta está
escrita a mano en `src/style.css` y en `AvatarPhotoViewer.vue`.

---

## 7. Reglas de dependencia

Están en `docs/ARCHITECTURE.md` y se verifican en
`tests/unit/contracts/dependencyRules.spec.ts`:

```text
domain          no importa Vue ni Firebase
application     no importa componentes
presentation    no accede directamente a Firestore
infrastructure  no contiene reglas de interfaz
```

La tercera sigue siendo la que más importa con el acceso directo: `presentation`
no habla con Firestore nunca, y quien lo hace es `infrastructure`, inyectado desde
`main.ts` a través de `bootstrap.ts`.

Tres excepciones documentadas, y no son puerta giratoria: `app/` puede conocer el
SDK de Firebase por ser el composition root, `useSurveyWizard.ts` es el único
fichero de `application/` que importa Vue, e `infrastructure/` puede importar
tipos del dominio porque un adaptador implementa un contrato.

---

## 8. Seguridad: la línea que no se cruza

Este proyecto maneja palabras secretas, nombres y respuestas, y **no hay backend
que valide nada**: `firestore.rules` es la frontera de confianza. Ver
[SECURITY.md](SECURITY.md).

1. **Nunca permitas `list` sobre `codigos`.** Se puede leer una invitación por su
   identificador —la palabra secreta—; enumerar la colección publicaría las
   palabras de todo el grupo. Si alguna vez necesitas listar para una pantalla
   interna, no lo hagas desde el cliente: la consola de Firebase ya te deja verlo
   con permisos de administrador, y esas reglas no le afectan.
2. **`update` sobre `codigos` solo para el paso `false → true` de `haVotado`, y
   solo con la lista blanca.** `resource.data.haVotado == false &&
   request.resource.data.haVotado == true` impide resucitar una invitación ya
   votada, y el `diff(...).hasOnly([...])` impide renombrarla o escribir campos
   inventados. La lista tiene que coincidir con `QUESTION_IDS`.
3. **No rompas el comodín `/{document=**}`.** Es la red de seguridad de cualquier
   colección que alguien añada dentro de seis meses.

Y recuerda el coste de que solo haya una colección, para no romperlo por
descuido: el mismo `get` que hace el login devuelve el documento entero, así que
quien tenga la palabra de otra persona ve también sus respuestas. Está
analizado en [SECURITY.md](SECURITY.md).

Y las tres reglas de privacidad que se comprueban con tests:

1. **Nada de `console.*` en `src/`.** Se usa `logger` de
   `infrastructure/logging/`, que redacta secretos y campos sensibles
   (`tests/unit/contracts/logging.spec.ts`). No hay ya ninguna excepción: no
   existe un `console.error` en un entorno externo que lo justifique.
2. **Las métricas no llevan datos personales.** Los nombres de contador son una
   constante cerrada y la API no admite contexto libre. Un contador que acepta
   un string libre es un contador que algún día lleva un nombre dentro.
3. **No se guarda nada en el navegador.** Sin `localStorage` ni
   `sessionStorage`, ni siquiera como borrador. Ver
   [RECOVERY.md](RECOVERY.md) para por qué.

---

## 9. Commits y pull requests

- **Un commit por TODO**, con el mensaje exacto `TODO-NNN`.
- Los commits que no son de la migración usan frases cortas y en imperativo.
- Antes de abrir el PR: `npm run typecheck`, `npm run lint`, los tres niveles de
  test y `npm run build`.
- Si el PR toca `firestore.rules`, el diff se lee con calma: es la última línea de
  defensa del proyecto.
- Si el PR cambia documentación, que la documentación sea la parte difícil del
  PR. Una guía que describe lo que había antes es peor que ninguna.
- Actualiza `docs/MIGRATION.md` marcando el TODO como `[COMPLETADO]` y contando
  lo que salió mal por el camino. Ese párrafo es lo primero que se lee cuando
  algo se rompe dentro de seis meses.

CI ejecuta en cada push y PR a `main`: `npm ci`, `typecheck`, `lint`, unitarias,
integración, build y un job de e2e en paralelo. El workflow **no despliega**.

---

## Documentos relacionados

| Documento | Para qué |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Capas, flujo de datos, decisiones y sus alternativas |
| [API.md](API.md) | Colecciones, operaciones del cliente, reglas y traducción de errores |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Variables, despliegue, migraciones, rollback y assets |
| [RECOVERY.md](RECOVERY.md) | Qué pasa y qué se recupera cuando algo falla |
| [DEV_SETUP.md](DEV_SETUP.md) | Entorno de desarrollo y tareas comunes |
| [SECURITY.md](SECURITY.md) | Por qué las palabras secretas lo son sin backend |
| [USER_GUIDE.md](USER_GUIDE.md) | Lo que ve quien participa |
