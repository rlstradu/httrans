import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_DEL_SITIO = path.resolve(AQUI, '..');

/**
 * Aviso que se inserta al principio del index.html compilado.
 *
 * El archivo publicado lo genera Vite: si alguien lo edita a mano, el siguiente
 * `npm run build` se lleva por delante el cambio. Lo que hay que editar está en
 * `src/`.
 */
const AVISO_ARCHIVO_GENERADO = `
<!--
  ============================================================================
  ARCHIVO GENERADO — NO EDITAR A MANO
  ============================================================================
  Este archivo lo crea "npm run build" a partir de poanda/src/.
  Cualquier cambio que escribas aquí se perderá en la siguiente compilación.
  Edita poanda/src/index.html y vuelve a compilar.
  ============================================================================
-->
`;

/** Tipos de archivo que el servidor de desarrollo sabe servir desde el sitio. */
const TIPOS = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Durante el desarrollo, sirve los archivos comunes del sitio.
 *
 * En producción Poanda vive en httrans.org/poanda/, y comparte con el resto de
 * la web el logo (`/poanda-logo-final.png`) y los iconos (`/images/...`). El
 * servidor de desarrollo de Vite solo conoce la carpeta `src/`, así que sin esto
 * esas rutas no existirían al trabajar en local.
 *
 * Y no fallarían de forma evidente: cuando Vite no encuentra algo, responde con
 * el index.html y un 200. O sea, la petición del logo devolvía una página web en
 * lugar de una imagen, y el navegador simplemente no pintaba nada. Por eso este
 * middleware se registra ANTES que los de Vite, y solo responde cuando el
 * archivo existe de verdad en la raíz del sitio y no lo tiene ya `src/`.
 */
function servirArchivosDelSitio() {
    return {
        name: 'servir-archivos-del-sitio',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.method !== 'GET' && req.method !== 'HEAD') return next();

                const ruta = decodeURIComponent((req.url || '').split('?')[0]);
                if (ruta.startsWith('/@') || ruta.includes('node_modules')) return next();

                const extension = path.extname(ruta).toLowerCase();
                if (!TIPOS[extension]) return next();

                // Si el archivo lo tiene src/, que lo sirva Vite.
                if (fs.existsSync(path.join(AQUI, 'src', ruta))) return next();

                // Se busca en el mismo orden en el que resolvería el navegador
                // en producción, donde la página vive en httrans.org/poanda/:
                // primero la carpeta de la herramienta,
                // después la raíz del sitio (ahí están el logo y los iconos).
                for (const base of [AQUI, RAIZ_DEL_SITIO]) {
                    const archivo = path.join(base, ruta);
                    // No salir de la carpeta aunque la petición lleve "..".
                    if (!archivo.startsWith(base + path.sep)) continue;
                    if (!fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) continue;

                    res.setHeader('Content-Type', TIPOS[extension]);
                    res.end(fs.readFileSync(archivo));
                    return;
                }

                return next();
            });
        },
    };
}

/** Añade el aviso de "archivo generado" al HTML compilado. */
function avisarArchivoGenerado() {
    return {
        name: 'avisar-archivo-generado',
        apply: 'build',
        transformIndexHtml(html) {
            return html.replace(/^(<!DOCTYPE[^>]*>)/i, `$1${AVISO_ARCHIVO_GENERADO}`);
        },
    };
}

export default defineConfig({
    // Lo que se edita vive en src/.
    root: 'src',

    // Rutas relativas en el HTML compilado: Poanda se sirve desde
    // httrans.org/poanda/, no desde la raíz del dominio.
    base: './',

    plugins: [servirArchivosDelSitio(), avisarArchivoGenerado()],

    resolve: {
        // `@core` es la carpeta compartida de la raíz del repositorio. Vive
        // fuera de `src/`, que es la raíz que ve Vite, así que hace falta el
        // atajo. Ver panda-core/README.md: un cambio ahí se prueba en todas
        // las herramientas que la importan.
        alias: { '@core': path.resolve(AQUI, '..', 'panda-core') },
    },

    build: {
        // Se compila a una carpeta propia y desechable. Después, el script
        // "postbuild" mueve el resultado a poanda/, que es lo que publica
        // httrans.org. Se hace en dos pasos a propósito: si Vite compilara
        // directamente sobre poanda/, esa carpeta sería padre del código fuente
        // y un descuido de configuración podría borrar src/ entero.
        outDir: '../.build',
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: false,
    },

    server: {
        port: 5173,
        strictPort: true,
        // Sin esto el servidor de desarrollo se niega a servir `panda-core/`,
        // que está por encima de la raíz que Vite tiene configurada.
        fs: { allow: [AQUI, RAIZ_DEL_SITIO] },
    },
});
