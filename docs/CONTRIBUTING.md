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
npm run dev
```

Las siete variables `VITE_FIREBASE_*` están explicadas en
[DEV_SETUP.md](DEV_SETUP.md#3-configurar-firebase). En desarrollo,
`VITE_FIREBASE_APP_CHECK_SITE_KEY` es opcional; en producción es obligatoria y
la aplicación no arranca sin ella.

---

## 1. Dónde añadir una pregunta

Hay **dos** sitios y basta con tocar uno mal para que nada funcione:

| Fichero | Qué contiene |
|---|---|
| `src/features/survey/domain/questions.ts` | El catálogo que ve la persona |
| `functions/src/surveySchema.ts` | La allowlist que acepta el servidor |

Las dos tienen que moverse en el mismo despliegue. Si el servidor acepta una
pregunta que el cliente no conoce, el envío falla con `invalid-argument`; si el
cliente ofrece una que el servidor no acepta, también. El síntoma es siempre el
mismo —el formulario no avanza— y por eso la lista de comprobación de este
README insiste en probar el flujo completo, no solo la build.

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

Y su allowlist:

```typescript
export const SURVEY_OPTION_IDS = {
  // …
  nueva: ['nueva-1', 'nueva-2'],
} as const satisfies Record<string, readonly string[]>;
```

**Añadir una opción a una pregunta que ya existe sí es compatible**: la
allowlist se comprueba con `includes`, así que los documentos ya guardados
siguen siendo válidos. Añadir una pregunta **no** lo es: `submitSurvey` exige
exactamente diez respuestas, una por cada clave de la allowlist.

Para añadir una pregunta a un cuestionario que ya tiene respuestas, planéalo
como una migración y no como un commit: ver
[DEPLOYMENT.md §4.2](DEPLOYMENT.md#42-cambiar-el-catálogo-de-preguntas).

---

## 2. Dónde modificar el modelo

| Cambio | Dónde |
|---|---|
| Un campo nuevo en una invitación | `functions/src/firestoreSchemas.ts` (`StoredInvitation` y `parseInvitationDocument`) |
| Un campo nuevo en una respuesta guardada | `functions/src/firestoreSchemas.ts` (`StoredSurveyResponse` y `parseStoredSurveyResponse`) |
| El cuerpo de un DTO remoto | `functions/src/surveyValidation.ts` |
| Un tipo del cliente | `src/features/survey/domain/survey.types.ts` |
| Una regla de validación de respuestas | `src/features/survey/domain/survey.rules.ts` |

**Aviso que no es negociable:** `parseStoredSurveyResponse` exige que un
documento v2 tenga **exactamente** cinco claves. Si añades un campo a una
respuesta ya guardada sin actualizar el parser en el mismo despliegue, el
documento pasa a leerse como inválido y el reintento de esa persona deja de ser
idempotente: en lugar de un acierto recibo un `failed-precondition`. Un cambio
de esquema son dos cambios, siempre.

El tipo que viaja a la red y el que se guarda en Firestore **no son el mismo**,
y confundirlos rompe el contrato. El DTO de `submitSurvey` es
`{ invitationId, answers }`; el documento guardado tiene además
`schemaVersion`, `participantName` y los dos timestamps. El nombre de la
persona no lo envía el cliente: se copia de la invitación, que es la única fuente
autorizada.

---

## 3. Dónde añadir un repositorio

En `src/infrastructure/`, con un fichero por colección y una función por
operación, exportada con su alias en español. `firestoreKeywordsRepository.ts`
es la referencia a copiar:

```typescript
// src/infrastructure/firebase/miColeccionRepository.ts
export const MiColeccionRepository = {
  guardar(datos: Dato): Promise<void> { /* … */ },
};
```

Y su contrato se fija en `tests/unit/contracts/repositoryContracts.spec.ts`, que
comprueba la forma de la API, no su implementación.

Dos restricciones que no son de estilo:

- **El navegador no puede escribir en Firestore.** `firestore.rules` lo deniega
  todo. Un repositorio del cliente tiene que ir detrás de una callable, como
  hace el resto.
- **`infrastructure/` no contiene reglas de interfaz.** Nada de Vue, nada de
  SFC, nada de CSS. Está verificado en
  `dependencyRules.spec.ts` y romperlo es un test rojo, no una discusión.

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

Tres excepciones documentadas, y no son puerta giratoria: `app/` puede conocer
el SDK de Firebase por ser el composition root, `useSurveyWizard.ts` es el único
fichero de `application/` que importa Vue, e `infrastructure/` puede importar
tipos del dominio porque un adaptador implementa un contrato.

---

## 8. Privacidad: la línea que no se cruza

Este proyecto maneja palabras secretas, nombres y respuestas. Hay tres reglas
que se comprueban con tests y que conviene no discutir commit a commit:

1. **Nada de `console.*` en `src/`.** Se usa `logger` de
   `infrastructure/logging/`, que redacta secretos y campos sensibles
   (`tests/unit/contracts/logging.spec.ts`). Las Cloud Functions sí pueden usar
   `console.error`: su destino es Cloud Logging.
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
- Si el PR cambia documentación, que la documentación sea la parte difícil del
  PR. Una guía que describe lo que había antes es peor que ninguna.
- Actualiza `docs/MIGRATION.md` marcando el TODO como `[COMPLETADO]` y contando
  lo que salió mal por el camino. Ese párrafo es lo primero que se lee cuando
  algo se rompe dentro de seis meses.

CI ejecuta en cada push y PR a `main`: `npm ci`, build de Cloud Functions,
`typecheck`, `lint`, unitarias, integración, build y un job de e2e en paralelo.
El workflow **no despliega**.

---

## Documentos relacionados

| Documento | Para qué |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Capas, flujo de datos, decisiones y sus alternativas |
| [API.md](API.md) | DTOs, colecciones, códigos de error y allowlist |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Variables, despliegue, migraciones, rollback y assets |
| [RECOVERY.md](RECOVERY.md) | Qué pasa y qué se recupera cuando algo falla |
| [DEV_SETUP.md](DEV_SETUP.md) | Entorno de desarrollo y tareas comunes |
| [SECURITY.md](SECURITY.md) | Reglas, App Check y superficie de ataque |
| [USER_GUIDE.md](USER_GUIDE.md) | Lo que ve quien participa |
