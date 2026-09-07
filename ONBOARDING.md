# ONBOARDING — httrans / PandaTools

Guía práctica para empezar a trabajar en este proyecto, sea una persona nueva o un agente de IA en su primera sesión. Para las reglas y convenciones detalladas, ver `AGENTS.md`; para el sistema visual, `docs/design-system.md`.

## 1. Qué vas a encontrarte

Un repositorio con una portada (`index.html`) y una carpeta o archivo por herramienta. Tres herramientas (`pandaterm/`, `pandoria/`, `poanda/`) ya están refactorizadas a una estructura multi-archivo; el resto son, hoy, un único HTML con todo dentro (CSS y JS inline). Antes de tocar cualquier herramienta, comprueba en `AGENTS.md` §2 si ya está refactorizada o no — el enfoque de trabajo es distinto en cada caso.

`poanda/` es la más avanzada de las tres y la referencia para las siguientes: usa módulos ES y tiene tests automáticos (Vitest para la lógica, Playwright para los flujos en el navegador).

## 2. Cómo previsualizar algo en local

Como las herramientas siempre se usan online (nunca por doble clic, ver `AGENTS.md` §1), lo más fiable para previsualizar un cambio es levantar un servidor estático simple en la carpeta correspondiente:

```
python3 -m http.server 8000
```

o, si tienes Node:

```
npx serve .
```

y abrir `http://localhost:8000` (o el puerto que toque). Esto es imprescindible en cuanto una herramienta use `<script type="module">` o haga `fetch()` de otro archivo (como el modal de changelog, que carga `CHANGELOG.md` en vivo) — por `file://` esas cargas fallan.

**Poanda ya está en ese caso**: usa módulos ES, así que por doble clic no arranca. Desde `poanda/`, `npm run dev` levanta el servidor en `http://localhost:5173`.

Poanda además se compila con Vite (ver `AGENTS.md` §3.1). Lo que se edita está en `poanda/src/`; lo que se publica lo genera `npm run build`. Si tocas algo en `src/` y no compilas, la web no cambia.

## 3. Cómo funciona la traducción ES/EN

Dos patrones distintos conviven hoy (ver `AGENTS.md` §7 para el porqué):

- **Portada**: un objeto `translations` en JS con una clave `es` y una `en`; cada elemento del HTML que debe traducirse lleva `data-key="miClave"`; una función `updateText(lang)` recorre el DOM y sustituye el contenido. Para añadir un texto nuevo: añade la clave en los dos idiomas dentro de `translations` y ponle `data-key="esaClave"` al elemento HTML.
- **Herramientas individuales** (pandaterm/pandoria): mismo concepto, pero el atributo se llama `data-i18n` en vez de `data-key`, y vive en `js/translations.js` + `js/i18n.js`.

No mezcles los dos nombres de atributo dentro del mismo archivo.

## 4. Cómo añadir una herramienta nueva a la portada

1. Añade una entrada al array `tools` del `<script>` de `index.html` (id, icono, URL, `new: true` si quieres el badge).
2. Añade las claves `<id>Main` y `<id>Sub` en `translations.es` y `translations.en`.
3. Si el nombre lleva alguna parte coloreada, consulta primero `docs/design-system.md` §3 — añade el color ahí también si es nuevo.
4. Si la herramienta en sí es nueva (no solo el enlace), constrúyela siguiendo el patrón de `pandaterm/`/`pandoria/` (`AGENTS.md` §5) desde el principio, incluida la metodología de testeo (`AGENTS.md` §6) — no se añade "para después".

## 5. Changelog y versión

Cada herramienta refactorizada muestra un botón de versión (`vX.Y.Z`) que abre un modal alimentado en vivo desde su `CHANGELOG.md`. Al publicar un cambio con impacto para la persona que usa la herramienta: añade una entrada nueva arriba del `CHANGELOG.md` y sube el número que se muestra en el botón. La portada tiene su propio modal de changelogs (menú lateral → "Changelogs"), que enlaza al changelog de cada herramienta por separado.

## 6. Newsletter

El boletín se envía desde MailerLite (cuenta externa, no hay integración de código con este repo). El archivo público de boletines pasados está en `https://httrans.subscribepage.io/`, enlazado desde el primer elemento del menú lateral de la portada ("Boletín"/"Newsletter"). Si se necesita cambiar el texto de esa landing page (título SEO, descripción, textos), se edita directamente en el panel de MailerLite — este repositorio no controla ese contenido.

## 7. Rebranding en curso

El proyecto se llama de cara al público **PandaTools by HTTrans**: PandaTools es el nombre que se está promocionando, HTTrans sigue siendo el dominio/repositorio/"casa" del proyecto — no es un reemplazo total ni una prisa por renombrar infraestructura (dominio, repo, redes sociales). Antes de cambiar cualquier texto de marca por iniciativa propia, lee `AGENTS.md` §9.

## 8. Estado de cada herramienta (a fecha de este documento)

| Herramienta | Ubicación | Estructura | Estado |
|---|---|---|---|
| Portada | `index.html` (raíz) | Un archivo, HTML+CSS+JS inline | Activa, mantenida |
| Poanda | `poanda/` | Multi-archivo, módulos ES | **Refactorizada** (con tests) |
| Pandaterm | `pandaterm/` | Multi-archivo | **Refactorizada** |
| Pandoria | `pandoria/` | Multi-archivo | **Refactorizada** |
| SubpandaASS | `subpandass.html` (en httrans.org, no GitHub Pages) | Un archivo | Pendiente de refactor |
| SubPandaTM | `subpandatm.html` | Un archivo | Pendiente de refactor |
| SubpandaAUTO | `subpandaAUTO/` | Carpeta propia, pero un solo HTML con dos scripts fuera | Auditada: **pendiente de refactor** |
| PandaTrainer | `pandatrainer/` | Carpeta propia | **Sin auditar** |
| SubPandaQA | `subpandaqa.html` | Un archivo | Pendiente de refactor |
| Pandascript | `pandascript.html` | Un archivo | Pendiente de refactor |
| DiffPanda | `diffpanda.html` | Un archivo | Pendiente de refactor |
| PandaTimer | `pandatimer.html` | Un archivo | Pendiente de refactor |
| Charpanda | `charpanda.html` | Un archivo | Pendiente de refactor |
| Calpanda | `calpanda.html` | Un archivo | Pendiente de refactor |

Cuando se refactorice una herramienta de esta lista, actualiza esta tabla en el mismo cambio.

## 9. Cuando se mueve una herramienta a su propia carpeta

Al refactorizar `x.html` a `x/`, la dirección pública pasa de `httrans.org/x.html` a `httrans.org/x/`. Para no romper enlaces ya compartidos (boletines, cursos, marcadores), el archivo `x.html` se sustituye por una página mínima que redirige a `x/`. Ver `poanda.html` como ejemplo.
