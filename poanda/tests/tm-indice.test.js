/**
 * El índice de la memoria de traducción.
 *
 * Lo único que este índice tiene que garantizar es que **la coincidencia buena
 * está entre las candidatas**. Puede proponer de más —eso solo cuesta tiempo—,
 * pero si deja fuera la unidad que servía, la memoria empieza a mentir en
 * silencio, y eso es peor que ir lenta.
 */
import { describe, it, expect } from 'vitest';
import {
    CANDIDATAS,
    candidatas,
    clavesDelTexto,
    construirIndice,
} from '../src/js/core/tm-indice.js';

const unidad = (srcText) => ({ srcText, tgtText: 'x' });

describe('los trozos de palabra que se indexan', () => {
    it('parte por palabras y se queda con el principio', () => {
        expect(clavesDelTexto('Save the file')).toEqual(['save', 'the', 'file']);
    });

    it('las formas de una misma palabra caen en el mismo sitio', () => {
        // Es la razón de cortar: para un índice de palabras enteras, "correr" y
        // "corriendo" no tienen nada que ver.
        const [a] = clavesDelTexto('corriendo');
        const [b] = clavesDelTexto('correr');
        expect(a).toBe(b);
    });

    it('los signos y las mayúsculas no cuentan', () => {
        expect(clavesDelTexto('¡Hola, mundo!')).toEqual(clavesDelTexto('hola mundo'));
    });

    it('una palabra repetida se apunta una vez', () => {
        expect(clavesDelTexto('file to file')).toEqual(['file', 'to']);
    });

    it('un texto vacío no da nada', () => {
        expect(clavesDelTexto('')).toEqual([]);
        expect(clavesDelTexto('   ')).toEqual([]);
        expect(clavesDelTexto()).toEqual([]);
    });
});

describe('proponer candidatas', () => {
    const memoria = [
        unidad('The file could not be saved because the folder is read only.'),
        unidad('The document could not be saved because the folder is read only.'),
        unidad('Choose a language for the interface.'),
        unidad('Your subscription renews automatically.'),
        unidad('El archivo no se ha podido guardar.'),
    ];
    const indice = construirIndice(memoria);

    it('la idéntica siempre está', () => {
        const propuestas = candidatas(indice, memoria[0].srcText);
        expect(propuestas).toContain(0);
    });

    it('la casi idéntica también, y va delante de las que no pegan', () => {
        const propuestas = candidatas(indice, memoria[0].srcText);
        expect(propuestas.slice(0, 2).sort()).toEqual([0, 1]);
    });

    it('lo que no comparte nada no se propone', () => {
        const propuestas = candidatas(indice, 'Zzzz qqqq wwww');
        expect(propuestas).toEqual([]);
    });

    it('una memoria vacía no propone nada, y no revienta', () => {
        expect(candidatas(construirIndice([]), 'lo que sea')).toEqual([]);
        expect(candidatas(null, 'lo que sea')).toEqual([]);
        expect(candidatas(indice, '')).toEqual([]);
    });

    it('no propone más de las que se le piden', () => {
        const muchas = Array.from({ length: 500 }, (_, i) => unidad(`Save the file number ${i}`));
        const propuestas = candidatas(construirIndice(muchas), 'Save the file number 7');
        expect(propuestas.length).toBeLessThanOrEqual(CANDIDATAS);
    });
});

describe('las palabras que salen en todas partes', () => {
    it('la unidad se encuentra por lo que la distingue, no por "the"', () => {
        const memoria = Array.from({ length: 1000 }, (_, i) =>
            unidad(`The item number ${i} is here`),
        );

        expect(candidatas(construirIndice(memoria), 'The item number 42 is here')).toContain(42);
    });

    it('una memoria repetitiva sigue proponiendo candidatas', () => {
        // Este es el caso que rompió el primer intento. Al descartar las
        // palabras que salían en muchas unidades, en un manual donde TODAS las
        // frases se parecen no quedaba ninguna palabra que mirar y la memoria
        // dejaba de proponer nada: la optimización se convertía en un fallo.
        const memoria = Array.from({ length: 5000 }, (_, i) =>
            unidad(`Press the button to continue with step ${i}.`),
        );

        const propuestas = candidatas(construirIndice(memoria), 'Press the button to continue.');

        expect(propuestas.length).toBeGreaterThan(0);
    });

    it('gastar poco presupuesto no deja la lista vacía', () => {
        // Aunque solo dé para una palabra, esa palabra se mira.
        const memoria = Array.from({ length: 300 }, () => unidad('The same sentence everywhere'));

        const propuestas = candidatas(construirIndice(memoria), 'The same sentence everywhere', {
            presupuesto: 1,
        });

        expect(propuestas.length).toBeGreaterThan(0);
    });
});

describe('el índice encuentra lo que encontraría el cálculo completo', () => {
    it('sobre una memoria grande y variada, la mejor está entre las candidatas', () => {
        // La prueba que de verdad importa: se arma una memoria de 5.000
        // unidades, se mete una que se parece mucho a la consulta en un sitio
        // cualquiera, y el índice tiene que sacarla.
        let semilla = 99;
        const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
        const sujetos = ['The file', 'The report', 'Your account', 'This document', 'The invoice'];
        const verbos = ['could not be saved', 'has been updated', 'will expire soon'];
        const colas = ['because the folder is read only.', 'on the date shown above.', 'today.'];
        const elige = (a) => a[Math.floor(azar() * a.length)];

        const memoria = Array.from({ length: 5000 }, () =>
            unidad(`${elige(sujetos)} ${elige(verbos)} ${elige(colas)}`),
        );
        const buscada = 'The quarterly report could not be exported because the printer was busy.';
        memoria[3117] = unidad(
            'The quarterly report could not be exported because the printer was busy today.',
        );

        const propuestas = candidatas(construirIndice(memoria), buscada);

        expect(propuestas).toContain(3117);
    });
});

describe('el índice no se deja atrás lo que el cálculo completo encontraría', () => {
    /**
     * La prueba de fuego de toda esta optimización.
     *
     * Se arma una memoria grande y variada y, para un puñado de consultas, se
     * calcula a mano quiénes son las cinco mejores comparándolo TODO, como
     * hacía Poanda antes. Luego se le pregunta al índice. Si alguna de esas
     * cinco no está entre las candidatas, la memoria habría dejado de proponer
     * una coincidencia que antes proponía, y eso no es una optimización: es un
     * fallo silencioso.
     */
    it('las cinco mejores están siempre entre las candidatas', async () => {
        const { parecidoAlMenos } = await import('../src/js/core/text.js');
        const { MINIMO_PARA_ENSENAR, MAXIMO_RESULTADOS } = await import(
            '../src/js/core/tm-coincidencias.js'
        );

        let semilla = 4242;
        const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
        const elige = (a) => a[Math.floor(azar() * a.length)];
        const sujetos = [
            'The file', 'The quarterly report', 'Your account', 'This document',
            'The invoice', 'Each registered user', 'The backup server', 'The printed label',
        ];
        const verbos = [
            'could not be saved', 'has been updated', 'will expire', 'is being processed',
            'requires your attention', 'was permanently deleted', 'must be reviewed',
        ];
        const colas = [
            'because the destination folder is read only.',
            'on the date shown above.',
            'after thirty days without activity.',
            'by the administrator of this workspace.',
            'unless you choose another option in the settings panel.',
            'before the end of the current month.',
        ];

        const memoria = Array.from({ length: 8000 }, () =>
            unidad(`${elige(sujetos)} ${elige(verbos)} ${elige(colas)}`),
        );
        const indice = construirIndice(memoria);

        const consultas = [
            'The file could not be saved because the destination folder is read only.',
            'Your account will expire after thirty days without activity.',
            'The printed label must be reviewed by the administrator of this workspace.',
            'This document has been updated on the date shown above.',
            'The backup server is being processed before the end of the current month.',
        ];

        for (const consulta of consultas) {
            // Lo que habría hecho Poanda antes: comparar con todas.
            const todas = memoria
                .map((u, i) => ({ i, score: parecidoAlMenos(consulta, u.srcText, MINIMO_PARA_ENSENAR) }))
                .filter((x) => x.score >= MINIMO_PARA_ENSENAR)
                .sort((a, b) => b.score - a.score)
                .slice(0, MAXIMO_RESULTADOS);

            const propuestas = new Set(candidatas(indice, consulta));

            for (const { i, score } of todas) {
                expect(
                    propuestas.has(i),
                    `se queda fuera la unidad ${i} (${score.toFixed(0)} %) de "${consulta}"`,
                ).toBe(true);
            }
        }
    });
});
