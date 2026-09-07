# Sistema de diseño — httrans / PandaTools

Este documento describe el sistema visual **de referencia** (el de la portada, `index.html`), que es el objetivo a converger para cualquier herramienta nueva o refactorizada. La §7 documenta dónde las herramientas existentes se desvían de él hoy.

## 1. Marca

Transición en curso: **PandaTools by HTTrans**. El logo principal es `pandatools-logo-final.png`; debajo, una línea con el mismo peso visual que el título original (negrita, mayúsculas, mismo gris `#373737`, tamaño reducido a `1.05rem`) dice "by HTTrans (HTML Translation Toolkit)" / "por HTTrans (HTML Translation Toolkit)". Favicon: `favicon-httrans.png`. Ver `AGENTS.md` §9 antes de tocar cualquier cosa relacionada con la marca.

## 2. Color

Fondo: degradado animado entre rosa/lavanda/menta (`#fde7ea`, `#e8eaf6`, `#e0f2f1`, `#fce4ec`), 15s de ciclo.

Color de acento (marca): `#E23B5D` (rosa/rojo) — se usa en hover de tarjetas, badges "nuevo", botones primarios, enlaces destacados.

Texto: `#373737` (títulos/oscuro), `#4a5568` (cuerpo), `#718096` (secundario/gris).

Superficies: contenedores en "glassmorphism" — fondo blanco semitransparente (`rgba(255,255,255,0.6–0.85)`) + `backdrop-filter: blur(...)`.

## 3. Color por nombre de herramienta

Cada nombre de herramienta en la portada lleva una parte en su color de marca (el resto queda en el color por defecto de `.tool-text-main`, `#2c3e50`). Tabla completa, para no reinventar valores si se añade o retoca una herramienta:

| Herramienta | Parte coloreada | Color |
|---|---|---|
| Poanda | "Po" | `rgb(244 135 144)` |
| Pandaterm | "term" | `rgb(125 206 199)` |
| Pandoria | "oria" | `rgb(255 94 24)` |
| SubPandaTM | "TM" | `rgb(9 91 162)` |
| SubPandaQA | "QA" | `rgb(9 91 162)` (mismo azul que TM) |
| SubpandaAUTO | "AUTO" | `rgb(255 184 31)` |
| Pandascript | "script" | `rgb(255 72 83)` |
| DiffPanda | "Diff" | `rgb(236 165 229)` |
| PandaTimer | "Timer" | `rgb(248 84 126)` |
| Charpanda | "C" / "h" / "a" / "r" (cada letra) | `rgb(255 134 93)` / `rgb(255 211 74)` / `rgb(253 125 141)` / `rgb(157 179 234)` |
| Calpanda | "Cal" | `rgb(255 211 74)` (mismo amarillo que la H de Charpanda) |
| SubpandaASS | "ASS" | `#065BA2` (nótese: es prácticamente el mismo azul que `rgb(9 91 162)` de TM/QA pero con un valor ligeramente distinto — pendiente de unificar a uno de los dos formatos) |

Estos colores se insertan como `<span style="color: ...">` directamente en el string de traducción de cada `<id>Main`, no como clases CSS — así cada nombre puede tener su propia combinación sin añadir una clase por herramienta a la hoja de estilos.

## 4. Tipografía

Portada: **Montserrat** (Google Fonts), pesos 400/500/600/700/900.

## 5. Iconos

Phosphor Icons, variante `duotone` (`ph-duotone ph-<nombre>`), cargados vía CDN (`unpkg.com/@phosphor-icons/web`). Se usan en el menú lateral y en los triggers de los modales.

## 6. Componentes

**Tarjeta de herramienta** (`.tool-item`): logo (`.tool-logo`, `230×140px`, `object-fit: contain`), nombre (`.tool-text-main`, mayúsculas, color por defecto `#2c3e50` con las partes coloreadas de §3) y subtítulo (`.tool-text-sub`, gris `#718096`). Al pasar el ratón: se eleva 8px, sombra, borde `#E23B5D`, el logo escala 1.05×. Grid responsive (`auto-fit, minmax(280px, 1fr)`), una columna en móvil.

**Badge "nuevo"** (`.new-item[data-badge]`): cinta rotada 45° en la esquina superior derecha de la tarjeta, fondo `#E23B5D`.

**Menú lateral** (`.side-item`): píldora con icono + texto, fondo blanco semitransparente con blur, se convierte en panel deslizante desde la derecha en móvil (`<768px`) con botón hamburguesa. El primer elemento del menú es siempre el de Newsletter/Boletín (ver `AGENTS.md` §10) — es una decisión de producto, no solo de orden alfabético.

**Modales** (`.modal-overlay` / `.modal-content`): overlay oscuro con blur, contenido centrado con `border-radius: 1.5rem`, botón de cierre circular arriba a la derecha que rota 90° al hover.

**Botón de versión** (patrón pandaterm/pandoria, no de la portada): botón pequeño arriba, `v<major.minor.patch>`, abre un modal con el `CHANGELOG.md` de esa herramienta.

## 7. Modo oscuro

Patrón (pandaterm/pandoria): una clase `dark-mode` en `<body>` activa las reglas `body.dark-mode ...` de `css/styles.css`; el estado se guarda en `localStorage` y se restaura al cargar. **Inconsistencia conocida**: pandaterm usa la clave `theme` en localStorage, pandoria usa `pandoriaTheme` — no son intercambiables, cada herramienta tiene su propio estado de tema. Al añadir modo oscuro a una herramienta nueva, replicar el patrón `body.dark-mode` (por consistencia de código) pero con una clave de localStorage propia y descriptiva (p. ej. `<id>Theme`).

## 8. Responsive

Un único breakpoint principal: `@media (max-width: 768px)`. Por debajo de 768px: menú lateral pasa a panel deslizante, grid de herramientas a una columna, logo y tipografía se reducen.

## 9. Inconsistencias heredadas y objetivo de convergencia

Ninguna herramienta individual usa hoy exactamente el sistema de la portada:

- **PandaTerm**: Montserrat + CSS propio (sin Tailwind).
- **Pandoria**: Inter (no Montserrat) + Tailwind compilado localmente.
- **Poanda**: Montserrat + Tailwind por CDN. **Es la única que ya cumple el objetivo de convergencia**, así que sirve de referencia visual para los próximos refactors.
- **Resto de herramientas** (sin refactorizar): sin auditar, probablemente cada una con su propio criterio suelto.

**Objetivo, para cualquier refactor o herramienta nueva a partir de ahora**: Montserrat + Tailwind (por CDN o build local, ver `AGENTS.md` §3) + Phosphor Icons + esta paleta de color, para que toda herramienta se sienta parte de la misma familia visual que la portada. No es necesario retocar PandaTerm o Pandoria solo por esto — se converge cuando les toque su próximo refactor grande, no antes.

## 10. Checklist antes de añadir un componente o color nuevo

- ¿Ya existe un color parecido en la paleta de marca o en la tabla de §3? Reutilízalo antes de definir uno nuevo.
- ¿El componente nuevo tiene ya un equivalente en la portada (tarjeta, modal, badge, side-item)? Reutiliza esa clase/patrón en vez de crear uno paralelo.
- Si es un color por herramienta nuevo (§3), añádelo a la tabla de este documento en el mismo cambio — que la tabla se quede desactualizada es peor que no tenerla.
- Si introduces modo oscuro en una herramienta, sigue el patrón de §7 (clase `body.dark-mode` + localStorage con clave propia).
