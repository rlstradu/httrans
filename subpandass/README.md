# subpandaASS

Editor de subtítulos ASS/SSA y SRT, con el vídeo y la onda de sonido al lado de
la tabla, detección de cambios de plano y bloc de sincronización. Parte de
PandaTools by HTTrans.

## Atención: esta carpeta todavía no es lo que se publica

Lo que sirve httrans.org sigue siendo `subpandass.html`, el archivo único de la
raíz. Esta carpeta es el refactor en curso: la misma herramienta partida en
piezas, con compilación y pruebas, y todavía a medio camino.

**Mientras dure eso, lo que se toca es `subpandass.html`.** Cuando el refactor
esté terminado se cambia de sitio: `subpandass.html` pasa a ser una redirección
a esta carpeta, como hizo `poanda.html`, y las direcciones de siempre siguen
funcionando.

## Cómo se trabaja aquí

Lo que se edita está en `src/`. Lo que se publica es el resultado de compilar,
que vive en esta misma carpeta (`index.html` y `assets/`) y **se sube a GitHub
igual que el código**: httrans.org sirve el repositorio tal cual, no compila
nada.

```
npm install
npm run dev      # servidor de desarrollo en el 5175
npm test         # las pruebas de la lógica, sin navegador (Vitest)
npm run test:e2e # las pruebas de navegador (Playwright)
npm run build    # compila y deja el resultado listo para publicar
```

La primera vez, para las pruebas de navegador: `npx playwright install chromium`.

## Cómo está montado

- `src/index.html` — la página.
- `src/css/styles.css` — los estilos.
- `src/js/main.js` — el cuerpo de la herramienta. Es el `<script>` que vivía
  dentro del archivo único, sacado tal cual. De aquí se van extrayendo los
  módulos uno a uno.
- `panda-core/`, en la raíz del repositorio — las piezas compartidas con las
  demás herramientas, que se importan con el atajo `@core`. **Al tocar algo de
  ahí hay que pasar las pruebas de todas las herramientas que la usan.**
- `tests/` — Vitest. `e2e/` — Playwright, contra el archivo ya compilado.

## El orden del refactor

1. **Separar** el archivo único en página, estilos y código, con una prueba de
   humo que demuestre que sigue en pie. *(Hecho.)*
2. **Extraer** los módulos del código, uno a uno, comparando la salida del
   código viejo con la del nuevo sobre una batería de entradas. Sin cambiar
   comportamiento.
3. **Arreglar** lo que aparezca por el camino, en cambios propios y pequeños,
   cada uno con su prueba de regresión.
4. **Unificar** el control de calidad con el de subpandaTM, para que las dos
   herramientas ofrezcan las mismas comprobaciones.
5. **Unificar** la interfaz, para que se perciban como la misma familia.

## Fallos heredados encontrados, pendientes de arreglar

Se anotan aquí y se corrigen **después** del refactor, cada uno en su cambio con
su prueba: mezclar arreglos con el refactor hace imposible revisar ninguna de las
dos cosas.

- **El logotipo se pide a `raw.githubusercontent.com`** en vez de al propio
  sitio, aunque `subpanda-ass-logo-v1.png` está en la raíz del repositorio.
  GitHub no es un servidor de imágenes para producción. (`src/index.html`.)
- **El panel de control de calidad ofrece 23 comprobaciones y solo evalúa 10.**
  Las trece de puntuación y formato tienen interruptor y texto traducido, pero
  no hay código detrás: se encienden y no pasa nada. Se resuelve en el paso 4.
- **Faltaba un espacio entre dos atributos** en el botón de cerrar la barra de
  buscar y reemplazar (`data-tooltip="Cerrar"data-i18n-tooltip=…`). El navegador
  lo perdonaba; el compilador no. Corregido al separar el archivo, porque sin
  ello no compilaba.
