/**
 * Comprueba que el servidor de desarrollo sirve los archivos que Poanda comparte
 * con el resto del sitio (el logo, los iconos, el changelog).
 *
 * Por qué existe este test: cuando Vite no encuentra un archivo, no devuelve un
 * error, devuelve el index.html con un código 200. Una ruta rota parece que
 * funciona —la petición "va bien"— y lo único que se ve es que el logo no
 * aparece. Comprobar el código de respuesta no basta: hay que mirar que el
 * contenido sea del tipo que toca.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'vite';

let servidor;
let base;

beforeAll(async () => {
    servidor = await createServer({
        configFile: new URL('../vite.config.js', import.meta.url).pathname,
        server: { port: 0, strictPort: false },
        logLevel: 'silent',
    });
    await servidor.listen();
    const { port } = servidor.httpServer.address();
    base = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
    await servidor?.close();
});

describe('servidor de desarrollo', () => {
    it('sirve el logo de Poanda como imagen, no como página', async () => {
        const respuesta = await fetch(`${base}/poanda-logo-final.png`);
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get('content-type')).toContain('image/png');
    });

    it('sirve el favicon como imagen', async () => {
        const respuesta = await fetch(`${base}/images/favicon-poanda.png`);
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get('content-type')).toContain('image/png');
    });

    it('sirve el changelog como texto, no como página', async () => {
        // Es el archivo que alimenta la ventana del botón de versión. Cuando no
        // se encontraba, Vite devolvía el index.html con un 200 y en la ventana
        // aparecía el código de la página en lugar del historial de cambios.
        //
        // Vive en changelog/poanda.md, en la raíz del sitio, y es el mismo que
        // lee la portada: una sola copia por herramienta (AGENTS.md §8.1).
        // Antes había otra en poanda/CHANGELOG.md y las dos se separaron sin
        // que nadie se enterara.
        const respuesta = await fetch(`${base}/changelog/poanda.md`);
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get('content-type')).toContain('text/markdown');
        expect(await respuesta.text()).toContain('Poanda');
    });

    it('ninguna ruta compartida devuelve la página por error', async () => {
        // Comprobación general del fallo que ya ha aparecido dos veces: Vite
        // responde con el index.html y un 200 cuando no encuentra un archivo,
        // así que mirar el código de respuesta no basta. Hay que mirar el tipo.
        const rutas = ['/changelog/poanda.md', '/poanda-logo-final-v1.png', '/images/favicon-poanda.png'];
        for (const ruta of rutas) {
            const respuesta = await fetch(`${base}${ruta}`);
            expect(
                respuesta.headers.get('content-type'),
                `${ruta} ha devuelto una página en vez del archivo`,
            ).not.toContain('text/html');
        }
    });

    it('sirve la página de Poanda', async () => {
        const respuesta = await fetch(`${base}/`);
        expect(respuesta.status).toBe(200);
        expect(await respuesta.text()).toContain('id="versionToggle"');
    });

    it('no se sale de la carpeta del sitio', async () => {
        const respuesta = await fetch(`${base}/../../../etc/passwd.png`);
        expect(respuesta.headers.get('content-type')).not.toContain('image');
    });
});
