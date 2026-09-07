# AGENTS.md — httrans / PandaTools

Esta es la fuente de verdad de convenciones para trabajar en el repositorio de httrans (`rlstradu/httrans`), tanto para agentes de IA (Claude, Codex, Copilot, etc.) como para cualquier persona que contribuya. Si un documento del proyecto contradice a este, este documento gana, salvo que se haya actualizado después.

Documentos relacionados: `CLAUDE.md` (notas específicas para sesiones de Claude), `docs/design-system.md` (sistema visual), `ONBOARDING.md` (guía práctica de arranque).

## 1. Qué es este proyecto

httrans (actualmente en transición de marca a **PandaTools by HTTrans**, ver §9) es una colección de herramientas web gratuitas, sin instalación, para traductores, subtituladores y localizadores: editores de glosarios y memorias de traducción, conversores, contadores, editores de transcripciones, etc. Cada herramienta es una aplicación independiente; la portada (`index.html` en la raíz del repo) es un directorio/lanzador que enlaza a todas ellas.

**Todas las herramientas se usan siempre online**, entrando desde el menú de la portada (httrans.org) o desde su URL directa. Nadie las descarga para abrirlas localmente con doble clic — esto es relevante porque descarta cualquier restricción relacionada con el protocolo `file://` (ver §6).

## 2. Estructura del repositorio

| Ruta | Qué es | Estado |
|---|---|---|
| `index.html` (raíz) | Portada / lanzador. Un solo archivo HTML con CSS y JS inline. | Activo, mantenido |
| `pandaterm/` | Editor de glosarios TBX. `index.html` + `css/styles.css` + `js/*.js` (scripts clásicos) + `README.md` + `CHANGELOG.md`. | **Refactorizado** (patrón de referencia) |
| `pandoria/` | Editor de memorias TMX. Misma estructura que pandaterm/. | **Refactorizado** (patrón de referencia) |
| `poanda/` | Editor de PO/JSON/HTML. `index.html` + `css/` + `js/` (**módulos ES**) + `README.md` + `CHANGELOG.md` + tests. | **Refactorizado** (referencia para el resto: es el primero con módulos ES y con Vitest + Playwright) |
| `poanda.html` | Página mínima que redirige a `poanda/`, para no romper los enlaces antiguos. | No tocar salvo que se retire la redirección |
| `subpandatm.html`, `subpandaqa.html`, `pandascript.html`, `diffpanda.html`, `pandatimer.html`, `charpanda.html`, `calpanda.html` | Un único archivo HTML con CSS y JS inline cada uno. | **Pendientes de refactorizar** al patrón de pandaterm/pandoria |
| `subpandass.html` | Igual que las anteriores, pero servida desde httrans.org en vez de GitHub Pages. | **Pendiente de refactorizar** |
| `subpandaAUTO/` | Tiene carpeta propia, pero **no** sigue el patrón: es `index.html` + `wp-main.js` + `wp-worker.js` + imágenes, sin `css/`, sin `README.md` y sin `CHANGELOG.md`. | **Auditada (sept. 2026)**: es un archivo único al que se le sacaron dos scripts. Pendiente de refactorizar como el resto. |
| `charpanda/`, `pandatimer/` | Carpetas que **solo** contienen archivos de idiomas (`es.json`, `en.json`); la herramienta sigue estando en el HTML suelto de la raíz. | Documentado para que no se confundan con herramientas ya refactorizadas |
| `pandatrainer/` | Carpeta con `index.html` y `media/`, no listada antes en este documento. | **Sin auditar** |

Cuando se cita "el patrón pandaterm/pandoria" en este documento, nos referimos a: carpeta propia, `index.html` + `css/` + `js/` + `README.md` + `CHANGELOG.md`, botón de versión que abre un modal de changelog, selector de idioma ES/EN.

## 3. Stack técnico

Sin framework de frontend (nada de React/Vue) y, hoy por hoy, sin bundler ni paso de build obligatorio para desplegar — cada herramienta se sirve tal cual. Se apoya en:

- HTML + CSS + JavaScript.
- Tailwind CSS: la portada lo carga por CDN (`cdn.tailwindcss.com`); Pandoria lo compila localmente (ver `docs/design-system.md`); PandaTerm usa CSS propio sin Tailwind. Esto es una inconsistencia heredada — ver §7.
- Phosphor Icons (`ph-duotone`) en la portada, vía CDN.
- Google Fonts.
- MailerLite para el boletín (ver §10).

No hay backend propio. Los "datos" de cada herramienta viven en el navegador de quien la usa (localStorage/backup local), no en un servidor.

## 4. Convención de la portada (`index.html`)

Un único array `tools` en el `<script>` de la portada define cada herramienta (id, icono, URL, si lleva el badge "nuevo"). El listado visual (`tool-grid`) se genera con JS a partir de ese array — para añadir una herramienta nueva a la portada, se añade una entrada ahí y las claves de traducción correspondientes (`<id>Main`, `<id>Sub`), no se toca el HTML del grid a mano.

Los nombres de cada herramienta llevan una parte coloreada (ver la tabla completa de colores en `docs/design-system.md` §3) usando `<span style="color: rgb(...)">` directamente en el string de traducción — no clases CSS, para que cada nombre pueda tener su combinación única sin ensuciar la hoja de estilos con una clase por herramienta.

## 5. Convención de cada herramienta individual

Referencia: `pandaterm/` y `pandoria/`.

- `index.html`: marcado y carga de `css/styles.css` + los `js/*.js` en orden de dependencia.
- `css/styles.css`: estilos propios de la herramienta.
- `js/*.js`: hoy son **scripts clásicos** (`<script src="...">`, sin `type="module"`), cargados en orden y compartiendo el mismo scope global — así es como una función declarada en `state.js` es visible desde `main.js`. Esto se decidió en su día para poder abrir el HTML con doble clic sin servidor, pero esa necesidad no existe en la práctica (§1), así que **de cara a futuras herramientas y refactors, se migra a módulos ES** (ver §6) en vez de mantener este patrón.
- `js/main.js`: siempre el último `<script>` cargado; es el punto de entrada que engancha los listeners al `DOMContentLoaded`.
- `js/translations.js` + `js/i18n.js`: strings de la interfaz por idioma y la función que los aplica al DOM vía `data-i18n="clave"` en el HTML (equivalente al patrón `data-key` de la portada, pero con nombre distinto — unificar el nombre del atributo es una limpieza pendiente, no urgente).
- `js/theme.js`: modo claro/oscuro, con un botón "Cambiar tema" (`toggleTheme()`).
- `js/dialogs.js`: diálogos propios de la app. **No se usan `alert()`/`confirm()`/`prompt()` nativos del navegador** — se reutiliza este sistema de diálogos propio para cualquier confirmación o aviso nuevo.
- `js/backup.js`: guardado/restauración automática en el navegador (localStorage), con aviso al reabrir la herramienta.
- `js/changelog.js` + `CHANGELOG.md`: ver §8.
- `README.md`: qué hace la herramienta y para quién.

Los manejadores de eventos existentes usan atributos `onclick="funcion()"` inline en el HTML, lo cual solo funciona porque las funciones son globales (scripts clásicos). **Al migrar una herramienta a módulos ES, todos los `onclick` inline hay que sustituirlos por `addEventListener` en el JS**, porque las funciones de un módulo ES ya no cuelgan de `window`. Es un paso obligatorio del refactor, no opcional — si se migra a módulos ES sin hacer esto, los botones dejan de funcionar en silencio.

## 6. Metodología de testeo

Basada en la misma metodología ya adoptada en Subversia (otro proyecto del mismo autor), adaptada a que aquí no hace falta bundler:

- Cada herramienta refactorizada incorpora un `package.json` propio con `vitest` y `@playwright/test` como dependencias de desarrollo.
- La lógica pura (parsers, validaciones, transformaciones de datos — p. ej. `tbx.js`, `tmx.js`) se escribe como **módulos ES** con `export`, cargados en el HTML con `<script type="module" src="js/main.js">` que importa el resto. Esto permite testear esa lógica directamente con Vitest, sin trucos de doble carga navegador/Node.
- `npm run dev`: servidor estático local para probar la herramienta (basta `npx serve .` o similar; no hace falta Vite si no hay nada que compilar).
- `npm test`: Vitest sobre la lógica pura.
- `npm run test:e2e`: Playwright, contra el servidor local, cubriendo los flujos reales de la herramienta (importar/exportar, cambiar idioma, cambiar tema, etc.).
- **Corrección de errores → test de regresión obligatorio.** Ningún bugfix se da por cerrado sin un test que falle antes del fix y pase después.
- JSDoc en toda función exportada.
- Antes de dar por terminado un cambio: `npm run build` (si lo hay) + `npm test` + `npm run test:e2e`, los tres en verde.

Esto es el estándar para herramientas refactorizadas o nuevas. Las herramientas aún sin refactorizar (§2) no tienen esta infraestructura todavía — al refactorizarlas, se añade como parte del mismo trabajo, no después.

**Referencia práctica**: `poanda/` es la primera herramienta que aplica todo esto. Su `package.json`, su `playwright.config.js` y sus carpetas `tests/` y `e2e/` sirven de plantilla para las siguientes.

**Un refactor no cambia comportamiento.** Si al refactorizar aparece un fallo del código antiguo, se documenta y se corrige *después*, en un cambio propio y pequeño con su test de regresión. Mezclar las dos cosas hace imposible revisar ninguna de las dos. Una forma barata de demostrar que un refactor no ha cambiado nada: extraer las funciones de la versión antigua a un archivo aparte y comparar su salida con la de los módulos nuevos sobre una batería de entradas.

## 7. Inconsistencias heredadas conocidas

Documentadas aquí para que no se traten como bugs nuevos ni se dupliquen por accidente:

- **Tipografía y CSS**: la portada y PandaTerm usan Montserrat; Pandoria usa Inter. La portada usa Tailwind por CDN; Pandoria lo compila localmente; PandaTerm no usa Tailwind, solo CSS propio. El objetivo a medio plazo es converger en Montserrat + Tailwind (el sistema de la portada) para toda herramienta nueva o refactorizada — ver `docs/design-system.md` §7.
- **Nombre del atributo de i18n**: la portada usa `data-key`, las herramientas individuales usan `data-i18n`. Mismo concepto, nombre distinto.

- **Changelog por duplicado**: `poanda/CHANGELOG.md` (que alimenta el modal de la propia herramienta) y `changelog/poanda.txt` (que alimenta el modal de la portada) tienen el mismo contenido y hay que actualizar los dos. Unificarlo exige tocar el modal de changelogs de la portada; está pendiente.

- **Exportación TBX/TMX sin escapar**: `generateTBX` y `generateTMX` de Poanda insertan los términos en el XML sin escapar `&`, `<` ni `>`, y usan `LangSet` con mayúscula en vez de `langSet`. Son los dos mismos fallos que PandaTerm corrigió en su v1.2.0; en Poanda siguen ahí. Están documentados como tests pendientes en `poanda/tests/formats.test.js`.

- **Plurales en archivos PO**: Poanda no lee `msgid_plural` ni `msgstr[n]`, así que las traducciones de plural se pierden al guardar. Documentado como test pendiente en `poanda/tests/po.test.js`. (El resto de fallos del lector de PO se corrigieron en la v1.1.0.)

## 8. Versionado y Changelog

Cada herramienta refactorizada lleva: un botón de versión arriba (p. ej. `v1.2.0`) que abre un modal con el historial de cambios, alimentado en vivo desde `CHANGELOG.md` (o desde `changelog/<id>.txt`, según la herramienta — la portada usa esta segunda ruta para su propio modal de changelogs). Al hacer un cambio con impacto para quien usa la herramienta, se añade una entrada nueva arriba del todo de su `CHANGELOG.md` y se sube la versión mostrada en el botón.

## 9. Rebranding en curso: PandaTools by HTTrans

El proyecto está en transición de marca: **httrans sigue siendo el dominio, el repositorio y la "casa" del proyecto**; **PandaTools** es el nombre público que se está promocionando ahora (muchas personas ya llamaban así, informalmente, a las herramientas). No es un reemplazo total todavía — es intencionadamente gradual. Por eso: no renombrar el repositorio, el dominio, las cuentas de redes sociales ni las rutas existentes sin que el usuario lo pida explícitamente. El texto de cara al público (título de página, meta tags, textos de la portada) sí puede y debe ir reflejando "PandaTools by HTTrans" según se vaya pidiendo.

## 10. Newsletter

El boletín se envía por MailerLite. El archivo público de boletines pasados vive en una landing page aparte de MailerLite (no en este repositorio): `https://httrans.subscribepage.io/`. La portada enlaza a esa URL desde el menú lateral ("Boletín"/"Newsletter"). No hay integración de código entre este repo y MailerLite: es un enlace externo.

## 11. Flujo de Git

Commits directos a `main`. No se exige rama ni pull request por cambio — es un proyecto de un único mantenedor y se prioriza la velocidad sobre la trazabilidad formal. Mensajes de commit claros y en español o inglés, indistintamente.

## 12. Cómo comunicar los cambios

Cualquier cambio técnico se explica en español sencillo, evitando jerga innecesaria — quien mantiene este proyecto es traductor, no programador de formación, así que la explicación debe tener sentido para alguien sin experiencia previa en desarrollo web.
