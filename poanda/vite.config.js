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

/**
 * Durante el desarrollo, sirve las imágenes comunes del sitio.
 *
 * En producción, Poanda vive en httrans.org/poanda/ y las imágenes en
 * httrans.org/images/, así que el HTML las pide como `/images/...`. El servidor
 * de desarrollo solo conoce la carpeta `src/`, de modo que sin esto el logo y el
 * favicon saldrían rotos al trabajar en local. Esto las sirve desde la carpeta
 * `images/` del repositorio, igual que hará httrans.org.
 */
function servirImagenesDelSitio() {
    return {
        name: 'servir-imagenes-del-sitio',
        configureServer(server) {
            server.middlewares.use('/images', (req, res, next) => {
                const nombre = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '');
                const archivo = path.join(RAIZ_DEL_SITIO, 'images', nombre);
                // No salir de la carpeta images/ aunque la petición lleve "..".
                if (!archivo.startsWith(path.join(RAIZ_DEL_SITIO, 'images'))) return next();
                if (!fs.existsSync(archivo)) return next();
                res.end(fs.readFileSync(archivo));
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

    plugins: [servirImagenesDelSitio(), avisarArchivoGenerado()],

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
    },
});
