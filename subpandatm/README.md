# subpandaTM

Editor de subtítulos con memoria de traducción TMX y glosario TBX, con el vídeo
y la onda de sonido al lado del texto. Parte de PandaTools by HTTrans.

Abre SRT, WebVTT, TTML/IMSC (.ttml, .dfxp, .xml) y ASS/SSA, y devuelve cada
archivo en su formato, con lo que no se traduce intacto. Puede traducir con una
IA de pago o con una que se descarga y funciona dentro del navegador, sin que el
texto salga del ordenador.

Se publica en <https://httrans.org/subpandatm/>.

## Cómo se trabaja aquí

Lo que se edita está en `src/`. Lo que se publica es el resultado de compilar,
que vive en esta misma carpeta (`index.html` y `assets/`) y **se sube a GitHub
igual que el código**: httrans.org sirve el repositorio tal cual, no compila
nada.

```
npm install
npm run dev      # servidor de desarrollo en el 5174
npm test         # las pruebas de la lógica, sin navegador (Vitest)
npm run test:e2e # las pruebas de navegador (Playwright)
npm run build    # compila y deja el resultado listo para publicar
```

La primera vez, para las pruebas de navegador: `npx playwright install chromium`.

`subpandatm.html`, en la raíz del sitio, es una redirección a esta carpeta: la
dirección de siempre sigue funcionando.

## Cómo está montado

- `src/index.html` — la página.
- `src/css/styles.css` — los estilos, con los colores en variables al principio.
- `src/js/app.js` — el cuerpo de la herramienta. Es lo que queda del archivo
  único de antes, y se va troceando por temas.
- `src/js/core/` — la lógica que no toca la pantalla y se puede probar sin
  navegador. Los formatos de subtítulos (`formatos.js` es la tabla que los
  gobierna, y `srt.js`, `vtt.js`, `ttml.js` y `ass.js` son cada uno el suyo),
  el color (`color.js`), el formato del texto (`etiquetas.js`, `partir.js`,
  `tramos.js`), las comprobaciones de calidad (`qa.js`), la codificación del
  archivo, el TBX y el TMX, el parecido entre textos, el índice de la memoria y
  las coincidencias del glosario.
- `src/js/core/ia/` — la traducción con IA: los proveedores de pago, la que se
  descarga al navegador (`local.js`), los encargos que se le mandan
  (`prompt.js`) y la pretraducción por tandas.
- `src/js/ia.js`, `ia-ajustes-ui.js`, `ia-textos.js`, `pretraducir-ui.js` — la
  parte de la IA que sí toca la pantalla.
- `src/js/alineacion.js`, `idiomas-proyecto.js`, `recientes.js`,
  `changelog.js` — la alineación de un traducido con su original, el par de
  idiomas, los archivos recientes y la ventana de novedades.
- `src/js/state.js` — lo que comparten varias partes: los subtítulos, el
  glosario, la memoria y el par de idiomas del proyecto.
- `src/js/glossary.js`, `tm.js`, `paneles.js`, `termino-tarjeta.js`,
  `termino-modal.js` — la columna de consulta. Es el mismo código que Poanda,
  traído tal cual: un arreglo en una de las dos herramientas vale para la otra.
- `src/js/db.js`, `recursos.js` — lo que se guarda en el navegador.
- `tests/` — Vitest. `e2e/` — Playwright, contra el archivo ya compilado.

## Lo que hay que saber antes de tocar

- **El par de idiomas es del proyecto.** No lo pregunta el glosario por su lado
  ni la memoria por el suyo: se elige al abrir el archivo y lo usan los dos.
- **La memoria y el glosario son de cada proyecto.** Para llevarse trabajo de un
  encargo a otro están la exportación y la importación de TMX y TBX.
- **Nada de `confirm()` ni `prompt()` del navegador**: la herramienta tiene sus
  propios cuadros.
- **Se reconstruye sobre el archivo que se abrió, no se escribe uno nuevo.** Es
  la regla que gobierna los formatos y está explicada en `core/formatos.js`. De
  ella sale la promesa de la herramienta: abrir un archivo y guardarlo sin
  traducir nada devuelve el mismo archivo, byte por byte.
- **Lo que cada formato puede hacer lo dice el formato**, en su campo `puede` de
  esa misma tabla, y la fila de botones de cada subtítulo se pinta con lo que
  diga. Lo que un formato no admite no se ofrece.
- **Las comprobaciones de calidad son otra tabla**, en `core/qa.js`, con la
  misma idea: cada una es una función, y la pestaña de QA se pinta recorriendo
  la tabla. Una regla no escribe su mensaje: devuelve qué ha saltado y con qué
  números, y el texto lo pone la interfaz en el idioma que toque.
- **Las librerías van en `package.json`**, no en etiquetas `<script>` a un CDN.
  Hay dos excepciones: Tailwind, que sigue viniendo de su CDN, y WebLLM, que se
  carga solo cuando alguien pide una IA local (`core/ia/local.js`).
- **Las claves de las IA de pago no salen del navegador de quien las pone.** Por
  defecto solo duran la sesión y se van al cerrar la pestaña; solo se quedan si
  se marca "recordar" a propósito. Nunca viajan dentro de un proyecto exportado
  ni de una copia de seguridad, que es lo que evita mandar la propia factura por
  correo sin darse cuenta. El porqué está en `core/ia/ajustes.js`.
