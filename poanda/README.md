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

```
poanda/
├── index.html          Marcado de la interfaz
├── css/styles.css      Estilos propios
├── js/
│   ├── main.js         Punto de entrada: engancha todos los botones
│   ├── state.js        Estado compartido entre módulos
│   ├── dom.js          Referencias a los elementos de la página
│   ├── translations.js Textos de la interfaz en ES y EN
│   ├── i18n.js         Aplica los textos según el idioma
│   ├── theme.js        Modo claro/oscuro
│   ├── dialogs.js      Avisos, confirmaciones y peticiones de texto
│   ├── editor.js       Pintado y navegación de los segmentos
│   ├── files.js        Cargar y guardar archivos
│   ├── search.js       Buscar y reemplazar
│   ├── glossary.js     Panel de terminología
│   ├── tm.js           Panel de memoria de traducción
│   ├── ai.js           PandaBot
│   ├── shortcuts.js    Atajos de teclado
│   ├── backup.js       Copia de seguridad automática
│   ├── project.js      Proyectos .poanda
│   ├── stats.js        Estadísticas
│   ├── modals.js       Ventanas arrastrables y redimensionables
│   ├── changelog.js    Modal del historial de cambios
│   ├── icons.js        Iconos en SVG
│   └── core/           Lógica pura, sin interfaz (esta es la parte que se testea)
│       ├── po.js       Leer y reconstruir archivos PO
│       ├── mo.js       Compilar a MO
│       ├── json.js     Leer y reconstruir JSON
│       ├── html-doc.js Leer y reconstruir HTML
│       ├── tbx.js      Generar TBX
│       ├── tmx.js      Generar TMX
│       ├── text.js     Contar palabras, partir frases, similitud
│       └── iso-languages.js  Lista de códigos de idioma
```

La regla de organización: en `js/core/` va todo lo que se puede probar sin abrir un navegador (leer un archivo PO, calcular un porcentaje de similitud); en `js/` va todo lo que toca la pantalla.

## Desarrollo

Requiere Node.js. Desde esta carpeta:

```bash
npm install          # una sola vez
npm run dev          # servidor local en http://localhost:5173
npm test             # tests de la lógica pura (Vitest)
npm run test:e2e     # tests de los flujos completos (Playwright)
```

Poanda usa módulos ES, así que **hay que abrirla desde un servidor local**, no con doble clic en `index.html`: por `file://` el navegador bloquea la carga de los módulos y la herramienta no arranca. `npm run dev` levanta ese servidor.

Antes de dar por terminado cualquier cambio, `npm test` y `npm run test:e2e` tienen que pasar los dos. Si se corrige un fallo, se añade primero un test que falle por ese fallo y que pase después de arreglarlo.

## Licencia

Ver el archivo `LICENSE` en la raíz del repositorio.
