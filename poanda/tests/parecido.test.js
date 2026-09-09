/**
 * El cálculo de parecido de la memoria de traducción, acotado.
 *
 * La memoria calculaba la distancia de Levenshtein completa contra CADA unidad
 * guardada, con una matriz entera, en el hilo principal. Medido con el banco de
 * pruebas: con 20.000 unidades, cambiar de segmento congelaba la pantalla 5,3
 * segundos. Una memoria profesional empieza donde Poanda se paraba.
 *
 * La idea del arreglo es que casi todas esas cuentas sobran. Para que dos frases
 * se parezcan al menos un 50 %, la distancia entre ellas no puede pasar de la
 * mitad de la más larga; y la distancia nunca es menor que la diferencia de
 * longitudes. Así que comparar dos números descarta la mayoría sin tocar la
 * matriz, y de las que quedan se puede abandonar el cálculo en cuanto se sabe
 * que ya no llegan.
 *
 * Lo que estos tests protegen es lo único que importa de una optimización: que
 * **no cambie ni un solo resultado**. Una memoria que va rápida pero propone
 * otras coincidencias es peor que una lenta.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateSimilarity,
    distanciaAcotada,
    levenshteinDistance,
    parecidoAlMenos,
} from '../src/js/core/text.js';

describe('distancia con un techo', () => {
    it('da la distancia exacta cuando cabe bajo el techo', () => {
        expect(distanciaAcotada('gato', 'pato', 10)).toBe(1);
        expect(distanciaAcotada('gato', 'gato', 10)).toBe(0);
        expect(distanciaAcotada('', 'gato', 10)).toBe(4);
    });

    it('se rinde en cuanto pasa del techo', () => {
        // No promete cuánto vale, solo que pasa: eso es lo que permite
        // abandonar el cálculo a media matriz.
        expect(distanciaAcotada('gato', 'elefante', 2)).toBeGreaterThan(2);
    });

    it('descarta por diferencia de longitud sin calcular nada', () => {
        // Dos textos cuya longitud ya difiere más que el techo no pueden estar
        // por debajo de él, se parezcan en lo que se parezcan.
        expect(distanciaAcotada('a', 'a'.repeat(500), 10)).toBeGreaterThan(10);
    });

    it('con techo cero solo pasan los idénticos', () => {
        expect(distanciaAcotada('gato', 'gato', 0)).toBe(0);
        expect(distanciaAcotada('gato', 'gata', 0)).toBeGreaterThan(0);
    });
});

describe('el parecido acotado dice lo mismo que el de siempre', () => {
    /** Textos como los que hay en un archivo de verdad, y unos cuantos raros. */
    const textos = [
        'Save the current file before closing the editor',
        'Save the current project before closing the editor',
        'Save the current file before closing',
        'Choose a language for the interface',
        'Colours',
        'Color',
        '',
        'a',
        'ab',
        'The quick brown fox jumps over the lazy dog, again and again and again.',
        'El archivo no se ha podido guardar porque la carpeta es de solo lectura.',
        '%s de %d archivos',
        '%s de %d carpetas',
    ];

    it('coincide exactamente cuando el parecido llega al mínimo', () => {
        for (const a of textos) {
            for (const b of textos) {
                const deSiempre = calculateSimilarity(a, b);
                for (const minimo of [0, 50, 70, 75, 95, 100]) {
                    const acotado = parecidoAlMenos(a, b, minimo);
                    if (deSiempre >= minimo) {
                        expect(acotado, `"${a}" vs "${b}" con mínimo ${minimo}`).toBeCloseTo(
                            deSiempre,
                            10,
                        );
                    } else {
                        expect(acotado, `"${a}" vs "${b}" con mínimo ${minimo}`).toBe(0);
                    }
                }
            }
        }
    });

    it('coincide también con textos al azar', () => {
        // Los casos escogidos a mano siempre olvidan alguno. Con semilla fija
        // para que un fallo se pueda repetir.
        let semilla = 12345;
        const azar = () => {
            semilla = (semilla * 1103515245 + 12345) % 2147483648;
            return semilla / 2147483648;
        };
        const letras = 'abcdefgáéñ .,%1';
        const cadena = (n) =>
            Array.from({ length: n }, () => letras[Math.floor(azar() * letras.length)]).join('');

        for (let i = 0; i < 400; i++) {
            const a = cadena(Math.floor(azar() * 40));
            const b = cadena(Math.floor(azar() * 40));
            const minimo = [0, 50, 70, 95][Math.floor(azar() * 4)];

            const deSiempre = calculateSimilarity(a, b);
            const acotado = parecidoAlMenos(a, b, minimo);

            if (deSiempre >= minimo) expect(acotado).toBeCloseTo(deSiempre, 10);
            else expect(acotado).toBe(0);
        }
    });

    it('sin mínimo se comporta como el cálculo de siempre', () => {
        for (const a of textos) {
            for (const b of textos) {
                expect(parecidoAlMenos(a, b, 0)).toBeCloseTo(calculateSimilarity(a, b), 10);
            }
        }
    });

    it('un texto vacío no se parece a nada', () => {
        expect(parecidoAlMenos('', 'algo', 50)).toBe(0);
        expect(parecidoAlMenos('algo', '', 50)).toBe(0);
    });

    it('idénticos son siempre 100, incluso exigiendo 100', () => {
        expect(parecidoAlMenos('Save the file', 'Save the file', 100)).toBe(100);
    });
});

describe('la distancia de siempre sigue siendo correcta', () => {
    // El cálculo se reescribió para gastar dos filas en vez de la matriz
    // entera; el resultado no puede cambiar.
    it('los casos de libro', () => {
        expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
        expect(levenshteinDistance('flaw', 'lawn')).toBe(2);
        expect(levenshteinDistance('', '')).toBe(0);
        expect(levenshteinDistance('abc', '')).toBe(3);
        expect(levenshteinDistance('', 'abc')).toBe(3);
        expect(levenshteinDistance('mismo', 'mismo')).toBe(0);
    });

    it('da igual el orden de los argumentos', () => {
        expect(levenshteinDistance('Ajustes', 'Ajuste')).toBe(
            levenshteinDistance('Ajuste', 'Ajustes'),
        );
    });
});
