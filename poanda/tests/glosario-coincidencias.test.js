/**
 * Qué términos del glosario enseña el panel.
 *
 * La regla es que el panel enseña **lo que hay en el segmento que se tiene
 * delante**, no el glosario entero. Con veinte términos guardados, una tabla
 * con los veinte obliga a leerla entera para encontrar el que hace al caso, que
 * es el trabajo que el glosario venía a ahorrar.
 */
import { describe, it, expect } from 'vitest';
import {
    MAXIMO_TERMINOS,
    coincidenciasDelSegmento,
    terminosEnElTexto,
    terminosQueResponden,
} from '../src/js/core/glosario-coincidencias.js';

/** Un glosario de mentira, con lo mínimo que mira este módulo. */
const termino = (srcTerm, tgtTerm, extra = {}) => ({ srcTerm, tgtTerm, ...extra });

describe('encontrar términos en el original', () => {
    it('encuentra los que están y deja fuera los que no', () => {
        const glosario = [
            termino('file', 'archivo'),
            termino('settings', 'ajustes'),
            termino('folder', 'carpeta'),
        ];

        const encontrados = terminosEnElTexto(glosario, 'Open the file settings');

        expect(encontrados.map((e) => e.srcTerm)).toEqual(['file', 'settings']);
    });

    it('no le importan las mayúsculas', () => {
        const encontrados = terminosEnElTexto([termino('file', 'archivo')], 'Save the File now');
        expect(encontrados).toHaveLength(1);
    });

    it('busca palabras enteras, no trozos', () => {
        // Sin esto, "art" se marcaría dentro de "start" y el panel diría que
        // hay una decisión terminológica donde solo hay una coincidencia de
        // letras.
        expect(terminosEnElTexto([termino('art', 'arte')], 'Click start')).toEqual([]);
        expect(terminosEnElTexto([termino('art', 'arte')], 'Modern art')).toHaveLength(1);
    });

    it('gana la expresión larga sobre la palabra suelta', () => {
        // Alguien guardó "file name" porque se traduce distinto que "file". Si
        // saliera también "file", el panel daría dos respuestas para lo mismo.
        const glosario = [termino('file', 'archivo'), termino('file name', 'nombre de archivo')];

        const encontrados = terminosEnElTexto(glosario, 'The file name is wrong');

        expect(encontrados.map((e) => e.srcTerm)).toEqual(['file name']);
    });

    it('un término que sale dos veces se enseña una', () => {
        const encontrados = terminosEnElTexto([termino('file', 'archivo')], 'file to file');
        expect(encontrados).toHaveLength(1);
    });

    it('sin texto o sin glosario no devuelve nada, y no revienta', () => {
        expect(terminosEnElTexto([termino('file', 'archivo')], '')).toEqual([]);
        expect(terminosEnElTexto([], 'Open the file')).toEqual([]);
        expect(terminosEnElTexto()).toEqual([]);
    });

    it('un término con signos se busca tal cual, no como comodín', () => {
        // El término entra en una expresión regular: sin escaparlo, el punto de
        // "index.php" valdría por cualquier letra y el término se daría por
        // encontrado en sitios donde no está.
        const glosario = [termino('index.php', 'index.php')];

        expect(terminosEnElTexto(glosario, 'Edit index.php now')).toHaveLength(1);
        expect(terminosEnElTexto(glosario, 'Edit indexXphp now')).toEqual([]);
    });
});

describe('las coincidencias que se enseñan', () => {
    it('van de la expresión más larga a la más corta', () => {
        const glosario = [
            termino('file', 'archivo'),
            termino('recent project list', 'lista de proyectos recientes'),
            termino('project', 'proyecto'),
        ];

        const enseñadas = coincidenciasDelSegmento(glosario, 'Open the recent project list or a file');

        expect(enseñadas[0].srcTerm).toBe('recent project list');
    });

    it('no se enseñan más de las que caben', () => {
        const glosario = 'abcdefgh'.split('').map((letra) => termino(`term${letra}`, letra));
        const texto = glosario.map((e) => e.srcTerm).join(' ');

        expect(coincidenciasDelSegmento(glosario, texto)).toHaveLength(MAXIMO_TERMINOS);
    });
});

describe('buscar en el glosario', () => {
    const glosario = [
        termino('window', 'ventana'),
        termino('file', 'fichero', { notes: 'No traducir como fichero, usar archivo' }),
        termino('archive', 'archivar', { definition: 'Guardar algo para consultarlo luego' }),
    ];

    it('busca en el término y en la traducción', () => {
        expect(terminosQueResponden(glosario, 'ventana').map((e) => e.srcTerm)).toEqual(['window']);
    });

    it('busca también dentro de las notas y las definiciones', () => {
        // Para esto se escriben las notas: "fichero" no es la traducción de
        // "file", es lo que la nota dice que NO hay que poner.
        expect(terminosQueResponden(glosario, 'consultarlo').map((e) => e.srcTerm)).toEqual([
            'archive',
        ]);
    });

    it('sin nada escrito no devuelve nada', () => {
        expect(terminosQueResponden(glosario, '   ')).toEqual([]);
        expect(terminosQueResponden(glosario)).toEqual([]);
    });

    it('los ordena por el término, para poder recorrerlos', () => {
        expect(terminosQueResponden(glosario, 'a').map((e) => e.srcTerm)).toEqual([
            'archive',
            'file',
            'window',
        ]);
    });
});
