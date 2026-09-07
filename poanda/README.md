# Poanda

Editor de archivos de traducción que funciona entero en el navegador, sin instalar nada y sin enviar los archivos a ningún servidor. Forma parte de **PandaTools by HTTrans**.

Está pensado para quien traduce plugins, temas y aplicaciones: abre un archivo `.po`, `.json` o `.html`, lo traduce segmento a segmento y lo vuelve a exportar. Todo lo que se escribe se queda en el navegador de quien lo usa.

## Qué hace

- **Edición de archivos PO** segmento a segmento, con contexto (`msgctxt`), propagación automática de repeticiones, deshacer y estadísticas de avance por segmentos y por palabras.
- **También JSON y HTML**: archivos JSON de clave-valor y páginas HTML, con el mismo editor.
- **Compilación a MO**, el formato binario que consumen WordPress y gettext.
- **Glosario** con importación y exportación en TBX estándar. Los términos del glosario se resaltan automáticamente en el segmento activo.
- **Memoria de traducción** con importación y exportación en TMX estándar, coincidencias parciales con porcentaje de similitud y vista de diferencias.
- **Buscar y reemplazar** en todos los segmentos, con distinción de mayúsculas y expresiones regulares.
- **Atajos de teclado configurables**, que se pueden exportar e importar.
- **PandaBot**, un asistente opcional con la API de Google Gemini que tiene en cuenta el segmento anterior y el siguiente, el glosario activo y las coincidencias de la memoria.
- **Copia de seguridad automática** en el navegador, con opción de restaurar la sesión al volver a abrir la herramienta.
- **Proyectos `.poanda`**: guardar en un solo archivo el texto, la memoria y el glosario.
- Interfaz en **español e inglés** y **modo claro/oscuro**.

## Cómo se usa

Entrando en [httrans.org/poanda/](https://httrans.org/poanda/). No hay nada que descargar ni instalar.

## Estructura del código

Lo que se edita está en `src/`. Lo que publica httrans.org (`index.html` y `assets/`) lo genera `npm run build` y no se toca a mano.

```
poanda/
├── index.html          GENERADO — no editar
├── assets/             GENERADO — no editar
├── src/                <-- aquí se trabaja
│   ├── index.html      Marcado de la interfaz
│   ├── css/styles.css  Estilos propios
│   └── js/
│       ├── main.js         Punto de entrada: engancha todos los botones
│       ├── state.js        Estado compartido entre módulos
│       ├── dom.js          Referencias a los elementos de la página
│       ├── translations.js Textos de la interfaz en ES y EN
│       ├── i18n.js         Aplica los textos según el idioma
│       ├── theme.js        Modo claro/oscuro
│       ├── dialogs.js      Avisos, confirmaciones y peticiones de texto
│       ├── editor.js       Pintado y navegación de los segmentos
│       ├── files.js        Cargar y guardar archivos
│       ├── search.js       Buscar y reemplazar
│       ├── glossary.js     Panel de terminología
│       ├── tm.js           Panel de memoria de traducción
│       ├── ai.js           PandaBot
│       ├── shortcuts.js    Atajos de teclado
│       ├── backup.js       Copia de seguridad automática
│       ├── project.js      Proyectos .poanda
│       ├── stats.js        Estadísticas
│       ├── modals.js       Ventanas arrastrables y redimensionables
│       ├── changelog.js    Modal del historial de cambios
│       ├── icons.js        Iconos en SVG
│       └── core/           Lógica pura, sin interfaz (lo que se testea)
│           ├── po.js           Leer y reconstruir archivos PO
│           ├── mo.js           Compilar a MO
│           ├── json.js         Leer y reconstruir JSON
│           ├── html-doc.js     Leer y reconstruir HTML
│           ├── tbx.js          Generar TBX
│           ├── tmx.js          Generar TMX
│           ├── text.js         Contar palabras, partir frases, similitud
│           └── iso-languages.js  Lista de códigos de idioma
├── tests/              Tests de la lógica (Vitest)
├── e2e/                Tests de navegador (Playwright)
├── scripts/            Utilidades de compilación
├── vite.config.js      Configuración de la compilación
└── CHANGELOG.md        Historial de cambios que muestra el botón de versión
```

La regla de organización: en `src/js/core/` va todo lo que se puede probar sin abrir un navegador (leer un archivo PO, calcular un porcentaje de similitud); en `src/js/` va todo lo que toca la pantalla.

## Desarrollo

Requiere Node.js. Desde esta carpeta:

```bash
npm install          # una sola vez
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # genera lo que se publica: index.html + assets/
npm test             # tests de la lógica pura (Vitest)
npm run test:e2e     # tests de los flujos completos (Playwright, sobre lo compilado)
```

Poanda usa módulos ES, así que **no arranca con doble clic** en un archivo: por `file://` el navegador bloquea la carga de los módulos. `npm run dev` levanta el servidor que hace falta.

### Publicar un cambio

1. Editas lo que sea en `src/`.
2. `npm test` y `npm run test:e2e`, los dos en verde.
3. `npm run build`.
4. Subes a GitHub **tanto `src/` como el resultado compilado**.

El paso 3 es el que se olvida: si subes solo `src/`, httrans.org se queda como estaba, porque lo que sirve es el `index.html` generado.

Si se corrige un fallo, se añade primero un test que falle por ese fallo y que pase después de arreglarlo.

## Licencia

Ver el archivo `LICENSE` en la raíz del repositorio.
