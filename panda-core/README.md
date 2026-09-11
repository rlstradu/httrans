# panda-core

Las piezas que no son de ninguna herramienta en concreto: leer y escribir
formatos de subtítulos, el motor de control de calidad, el manejo de etiquetas y
colores, la detección de codificación. Parte de PandaTools by HTTrans.

Aquí no hay interfaz. Ni un `document`, ni un `window`, ni un `localStorage`, ni
un texto que vea nadie. Son funciones puras: entra un dato, sale otro. Esa es la
razón de que se puedan compartir y de que se puedan probar sin navegador.

## Quién lo usa

| Herramienta | Desde |
|---|---|
| `subpandatm/` | septiembre de 2026 |

## Cómo se importa

Cada herramienta declara el atajo `@core` en su `vite.config.js` y en su
`vitest.config.js`, apuntando a esta carpeta:

```js
resolve: { alias: { '@core': path.resolve(AQUI, '..', 'panda-core') } },
```

Y después, desde cualquier archivo de la herramienta o de sus tests:

```js
import { revisar, LIMITES_DE_FABRICA } from '@core/qa.js';
```

Entre ellos, los archivos de esta carpeta se importan en relativo (`./srt.js`),
porque no saben en qué herramienta están.

## La regla

**Un cambio aquí se prueba en todas las herramientas que importan la carpeta, no
solo en la que lo motivó.** Es el precio de compartir: arreglar el lector de ASS
una vez lo arregla en todas, y romperlo una vez las rompe todas. Antes de dar por
bueno un cambio en `panda-core/`, pasan en verde `npm test` y `npm run test:e2e`
de cada herramienta de la tabla de arriba.

Si una herramienta necesita que una pieza se comporte distinto, la pieza no se
bifurca: se le añade un parámetro con el valor de siempre por defecto, para que
las demás no se enteren.

## Qué hay

| Archivo | Qué hace |
|---|---|
| `ass.js` | Lee y escribe ASS/SSA. |
| `srt.js` | Lee y escribe SRT, y las utilidades de tiempo que usan los demás. |
| `vtt.js` | Lee y escribe WebVTT, con sus colores como clases y su posición. |
| `ttml.js` | Lee y escribe TTML/IMSC. |
| `qa.js` | El motor de control de calidad: el registro de reglas y los límites. |
| `etiquetas.js` | Qué formato (cursiva, negrita, color…) lleva un texto. |
| `color.js` | Convierte colores entre las formas en que los escribe cada sitio. |
| `codificacion.js` | Averigua en qué codificación viene un archivo. |
| `partir.js` | Parte un subtítulo en dos por donde toca. |
| `tramos.js` | Reconstruye un archivo sobre el que se abrió, sin reescribirlo entero. |
| `text.js` | Cuentas de texto: caracteres, líneas, palabras. |
| `xml.js` | Escapar y desescapar XML. |
| `idiomas.js` | Códigos de idioma y sus nombres. |
| `changelog-formato.js` | Convierte un changelog en texto plano a lo que pinta el modal. |

## Pruebas

Las pruebas de estas piezas viven, de momento, en la carpeta `tests/` de la
herramienta que las estrenó (`subpandatm/tests/`). Cuando haya una segunda
herramienta usándolas, se moverán aquí.
