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
| `panda-core/` | Piezas compartidas entre herramientas: lectores y escritores de formatos de subtítulos, motor de control de calidad, etiquetas, colores, codificación. Módulos ES puros, sin interfaz. Ver `panda-core/README.md`. | **Activo desde septiembre de 2026** |
| `pandaterm/` | Editor de glosarios TBX. `index.html` + `css/styles.css` + `js/*.js` (scripts clásicos) + `README.md` + `CHANGELOG.md`. | **Refactorizado** (patrón de referencia) |
| `pandoria/` | Editor de memorias TMX. Misma estructura que pandaterm/. | **Refactorizado** (patrón de referencia) |
| `poanda/` | Editor de PO/JSON/HTML. `index.html` + `css/` + `js/` (**módulos ES**) + `README.md` + `CHANGELOG.md` + tests. | **Refactorizado** (referencia para el resto: es el primero con módulos ES y con Vitest + Playwright) |
| `poanda.html` | Página mínima que redirige a `poanda/`, para no romper los enlaces antiguos. | No tocar salvo que se retire la redirección |
| `subpandatm.html`, `subpandaqa.html`, `pandascript.html`, `diffpanda.html`, `pandatimer.html`, `charpanda.html`, `calpanda.html` | Un único archivo HTML con CSS y JS inline cada uno. | **Pendientes de refactorizar** al patrón de pandaterm/pandoria |
| `subpandass.html` | Igual que las anteriores, pero servida desde httrans.org en vez de GitHub Pages. | **Refactor en curso (sept. 2026)**: sigue siendo lo que se publica y lo que se toca; la carpeta `subpandass/` es el refactor a medias. |
| `subpandass/` | El refactor de subpandaASS: Vite, `src/`, pruebas. **Todavía no se publica** — ver `subpandass/README.md`. | En curso |
| `subpandaAUTO/` | Tiene carpeta propia, pero **no** sigue el patrón: es `index.html` + `wp-main.js` + `wp-worker.js` + imágenes, sin `css/`, sin `README.md` y sin `CHANGELOG.md`. | **Auditada (sept. 2026)**: es un archivo único al que se le sacaron dos scripts. Pendiente de refactorizar como el resto. |
| `charpanda/`, `pandatimer/` | Carpetas que **solo** contienen archivos de idiomas (`es.json`, `en.json`); la herramienta sigue estando en el HTML suelto de la raíz. | Documentado para que no se confundan con herramientas ya refactorizadas |
| `pandatrainer/` | Carpeta con `index.html` y `media/`, no listada antes en este documento. | **Sin auditar** |

### 2.1 La carpeta compartida (`panda-core/`)

Lo que no es de ninguna herramienta en concreto vive en `panda-core/`: leer y escribir ASS, SRT, WebVTT y TTML, el motor de control de calidad, el manejo de etiquetas y colores, la detección de codificación. Son funciones puras — ni `document`, ni `window`, ni `localStorage`, ni textos que vea nadie — y por eso se pueden compartir y probar sin navegador.

Cada herramienta que la usa declara el atajo `@core` en su `vite.config.js` y en su `vitest.config.js` apuntando a esa carpeta, y añade `server.fs.allow` para que el servidor de desarrollo pueda servir algo que está por encima de su raíz. Entre sí, los archivos de `panda-core/` se importan en relativo.

**La regla que hace que compartir salga a cuenta en vez de a caro: un cambio en `panda-core/` se prueba en todas las herramientas que la importan, no solo en la que lo motivó.** Y si una herramienta necesita que una pieza se comporte distinto, la pieza no se bifurca: se le añade un parámetro con el valor de siempre por defecto.

Cuando se cita "el patrón pandaterm/pandoria" en este documento, nos referimos a: carpeta propia, `index.html` + `css/` + `js/` + `README.md` + `CHANGELOG.md`, botón de versión que abre un modal de changelog, selector de idioma ES/EN.

## 3. Stack técnico

Sin framework de frontend (nada de React/Vue). La mayoría de herramientas se sirven tal cual, sin paso de compilación. **Poanda es la excepción desde septiembre de 2026**: usa Vite, y eso cambia cómo se trabaja con ella (ver §3.1). Se apoya en:

- HTML + CSS + JavaScript.
- Tailwind CSS: la portada lo carga por CDN (`cdn.tailwindcss.com`); Pandoria lo compila localmente (ver `docs/design-system.md`); PandaTerm usa CSS propio sin Tailwind. Esto es una inconsistencia heredada — ver §7.
- Phosphor Icons (`ph-duotone`) en la portada, vía CDN.
- Google Fonts.
- MailerLite para el boletín (ver §10).


### 3.1 Herramientas con paso de compilación (Poanda)

En `poanda/` lo que se edita está en `poanda/src/`; lo que publica httrans.org es `poanda/index.html` + `poanda/assets/`, que **genera `npm run build`**. Las tres reglas que se derivan de esto:

1. **Nunca editar `poanda/index.html` ni `poanda/assets/`**: son archivos generados y la siguiente compilación los reescribe. Llevan un aviso en la cabecera.
2. **Compilar antes de publicar.** Un cambio en `src/` no llega a httrans.org hasta que se ejecuta `npm run build` y se sube el resultado. Es el fallo fácil de cometer: subir solo el código fuente y que la web siga igual.
3. **El resultado compilado se sube al repositorio**, igual que Pandoria sube su CSS de Tailwind ya compilado. No hay compilación automática en GitHub: el sitio se publica directamente desde la rama `main`.

Vite compila primero a `poanda/.build/` (carpeta temporal, excluida del repositorio) y después un script mueve el resultado a su sitio. Se hace en dos pasos para que la herramienta de compilación nunca mande sobre la carpeta que contiene el código fuente.

Las rutas a imágenes comunes del sitio se escriben desde la raíz del dominio (`/poanda-logo-final.png`, `/images/favicon-poanda.png`), no en relativo: al compilar, el HTML cambia de sitio y las rutas relativas dejarían de apuntar donde deben.

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

- ~~**Changelog por duplicado**~~: **resuelto en septiembre de 2026.** Poanda, PandaTerm, Pandoria y subpandaTM leen ya un único `changelog/<id>.md` (§8). Al unificarlos apareció que las dos copias de Poanda tenían **historiales distintos** —en la carpeta estaban la 2.0.0, 2.1.0 y 2.2.0 y faltaban la 1.1.0 a la 1.4.0; en la raíz, al revés—, así que el archivo de ahora es la unión de las dos. Las ocho herramientas sin refactorizar siguen con su `.txt`.

- **Exportación TBX/TMX sin escapar**: `generateTBX` y `generateTMX` de Poanda insertan los términos en el XML sin escapar `&`, `<` ni `>`, y usan `LangSet` con mayúscula en vez de `langSet`. Son los dos mismos fallos que PandaTerm corrigió en su v1.2.0; en Poanda siguen ahí. Están documentados como tests pendientes en `poanda/tests/formats.test.js`.

- **Plurales en archivos PO**: Poanda no lee `msgid_plural` ni `msgstr[n]`, así que las traducciones de plural se pierden al guardar. Documentado como test pendiente en `poanda/tests/po.test.js`. (El resto de fallos del lector de PO se corrigieron en la v1.1.0.)

## 8. Versionado y Changelog

Cada herramienta refactorizada lleva un botón de versión arriba (p. ej. `v1.2.0`) que abre un modal con el historial de cambios, leído en vivo del archivo. Al hacer un cambio con impacto para quien usa la herramienta, se añade una entrada nueva arriba del todo de ese archivo y se sube la versión que muestra el botón.

### 8.1 Un solo archivo por herramienta

**El historial de cada herramienta vive en `changelog/<id>.md`, en la raíz del repositorio, y no hay una segunda copia en ninguna parte.** Ese mismo archivo lo leen la herramienta y el modal de changelogs de la portada.

La regla es esa y no otra porque la alternativa ya falló: con una copia en la carpeta de la herramienta y otra en `changelog/`, las dos se separaron sin que nada avisara (ver §7). Un historial que se contradice consigo mismo es peor que no tenerlo.

De ahí se derivan tres cosas:

1. **Nunca un `CHANGELOG.md` dentro de la carpeta de una herramienta.** Si aparece uno, sobra.
2. **La dirección se escribe en relativo** (`../changelog/<id>.md`), nunca absoluta. Una dirección absoluta mete el dominio dentro del código —deja de funcionar el día que cambie el alojamiento o el nombre de usuario de GitHub— y obliga a depender de CORS para leer un archivo del propio sitio.
3. **Una sola edición por versión.** Si hay que tocar dos archivos para publicar una versión, tarde o temprano se toca uno solo.

### 8.2 Cómo se escribe

Markdown de verdad, no texto plano con rayas. Los archivos antiguos usaban `====` y títulos sueltos; eso se va migrando. La forma es:

```markdown
# subpandaTM

## v2.0.0 — The Same Tools as Poanda

*Released 11 September 2026*

Un párrafo de presentación de la versión, opcional, para las grandes.

### Four Subtitle Formats

- Punto breve, una idea por punto.
- Otro punto. Si hace falta explicar el porqué, va en la misma frase.

### Quality Checks

- ...

## v1.1.7 — ...
```

- **Un solo `#`** al principio, con el nombre de la herramienta.
- **Un `##` por versión**, de la más nueva a la más vieja, con el número y un título corto.
- **La fecha en cursiva**, debajo del título de la versión.
- **`###` para cada apartado** dentro de una versión.
- **Puntos con `-`**, breves. Nada de párrafos largos: el changelog se hojea, no se lee de corrido.
- **`` `código` ``** para nombres de archivo, teclas y claves; **negrita** para el nombre de una novedad.
- Se escribe **en inglés**, como el resto de los changelogs del proyecto.

El modal no enseña el Markdown en crudo: lo interpreta `changelog-formato.js` antes de pintarlo.

### 8.3 La migración, mientras dure

Las doce herramientas no se migran a la vez. Mientras haya archivos de los dos tipos conviviendo:

- **La portada pide `changelog/<id>.md` y, si no existe, `changelog/<id>.txt`.** El respaldo desaparece solo cuando la última herramienta esté migrada; no hay que llevar una lista de cuáles van por dónde.
- **`changelog-formato.js` entiende los dos**: el Markdown nuevo y el texto plano con rayas de siempre. Lo segundo se retira cuando no quede ningún `.txt`.
- Al migrar una herramienta se hace todo de una vez: se reescribe su historial en Markdown como `changelog/<id>.md`, se apunta la herramienta a ese archivo en relativo, y **se borran el `.txt` viejo y el `CHANGELOG.md` de su carpeta si lo tenía**. Dejar los viejos "por si acaso" es exactamente cómo empezó el problema.

Orden acordado (septiembre de 2026): Poanda, PandaTerm, Pandoria y subpandaTM primero, que son las refactorizadas; el resto cuando les toque su propio refactor.

## 9. Rebranding en curso: PandaTools by HTTrans

El proyecto está en transición de marca: **httrans sigue siendo el dominio, el repositorio y la "casa" del proyecto**; **PandaTools** es el nombre público que se está promocionando ahora (muchas personas ya llamaban así, informalmente, a las herramientas). No es un reemplazo total todavía — es intencionadamente gradual. Por eso: no renombrar el repositorio, el dominio, las cuentas de redes sociales ni las rutas existentes sin que el usuario lo pida explícitamente. El texto de cara al público (título de página, meta tags, textos de la portada) sí puede y debe ir reflejando "PandaTools by HTTrans" según se vaya pidiendo.

## 10. Newsletter

El boletín se envía por MailerLite. El archivo público de boletines pasados vive en una landing page aparte de MailerLite (no en este repositorio): `https://httrans.subscribepage.io/`. La portada enlaza a esa URL desde el menú lateral ("Boletín"/"Newsletter"). No hay integración de código entre este repo y MailerLite: es un enlace externo.

## 11. Flujo de Git

Commits directos a `main`. No se exige rama ni pull request por cambio — es un proyecto de un único mantenedor y se prioriza la velocidad sobre la trazabilidad formal. Mensajes de commit claros y en español o inglés, indistintamente.

## 12. Cómo comunicar los cambios

Cualquier cambio técnico se explica en español sencillo, evitando jerga innecesaria — quien mantiene este proyecto es traductor, no programador de formación, así que la explicación debe tener sentido para alguien sin experiencia previa en desarrollo web.
