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
  Este archivo lo crea "npm run build" a partir de subpandass/src/.
  Cualquier cambio que escribas aquí se perderá en la siguiente compilación.
  Edita subpandass/src/index.html y vuelve a compilar.
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
 * En producción subpandaTM vive en httrans.org/subpandass/ y comparte con el
 * resto de la web el logotipo y los iconos. El servidor de desarrollo de Vite
 * solo conoce la carpeta `src/`, así que sin esto esas rutas no existirían al
 * trabajar en local, y encima no fallarían de forma evidente: cuando Vite no
 * encuentra algo responde con el index.html y un 200, o sea que la petición del
 * logotipo devolvería una página web y el navegador no pintaría nada.
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

                if (fs.existsSync(path.join(AQUI, 'src', ruta))) return next();

                for (const base of [AQUI, RAIZ_DEL_SITIO]) {
                    const archivo = path.join(base, ruta);
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
    root: 'src',
    base: './',
    plugins: [servirArchivosDelSitio(), avisarArchivoGenerado()],
    resolve: {
        // `@core` es la carpeta compartida de la raíz del repositorio: el
        // lector de ASS, el de SRT, el motor de control de calidad y demás
        // piezas que no son de ninguna herramienta en concreto. Vive fuera de
        // `src/`, que es la raíz que ve Vite, así que hace falta el atajo.
        alias: { '@core': path.resolve(AQUI, '..', 'panda-core') },
    },
    build: {
        // Se compila a una carpeta temporal y después el script de publicación
        // mueve el resultado a subpandass/. Si Vite compilara directamente
        // sobre subpandass/, esa carpeta sería padre del código fuente.
        outDir: '../.build',
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: false,
    },
    server: {
        port: 5175,
        strictPort: true,
        // Sin esto el servidor de desarrollo se niega a servir `panda-core/`,
        // que está por encima de la raíz que Vite tiene configurada.
        fs: { allow: [AQUI, RAIZ_DEL_SITIO] },
    },
});
