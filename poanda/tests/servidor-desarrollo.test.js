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
