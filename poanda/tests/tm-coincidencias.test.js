/**
 * Qué coincidencias de la memoria se enseñan.
 *
 * La regla que se prueba aquí es que **una coincidencia mala no se enseña**.
 * Parece un detalle de presentación y no lo es: la memoria devuelve un parecido
 * para cada unidad que tiene guardada, así que sin un mínimo la lista se llena
 * de frases que no tienen nada que ver, y la buena —que siempre es la primera—
 * queda enterrada debajo.
 */
import { describe, it, expect } from 'vitest';
import {
    MAXIMO_RESULTADOS,
    MINIMO_PARA_ENSENAR,
    bandaDeCoincidencia,
    coincidenciasQueValen,
} from '../src/js/core/tm-coincidencias.js';

describe('la categoría de una coincidencia', () => {
    it('pone cada puntuación en su banda', () => {
        expect(bandaDeCoincidencia(100)).toBe('exacta');
        expect(bandaDeCoincidencia(99)).toBe('alta');
        expect(bandaDeCoincidencia(95)).toBe('alta');
        expect(bandaDeCoincidencia(94)).toBe('media');
        expect(bandaDeCoincidencia(75)).toBe('media');
        expect(bandaDeCoincidencia(74)).toBe('baja');
        expect(bandaDeCoincidencia(50)).toBe('baja');
    });

    it('no se rompe con lo que no es un número', () => {
        expect(bandaDeCoincidencia(undefined)).toBe('baja');
        expect(bandaDeCoincidencia('87')).toBe('media');
    });
});

describe('cuáles se enseñan', () => {
    const conPuntuacion = (...puntuaciones) => puntuaciones.map((score, i) => ({ score, id: i }));

    it('las que no llegan al mínimo se quedan fuera', () => {
        // El caso real: una memoria de trabajo devolvía coincidencias del 12 %,
        // con un diff entre dos frases sin nada en común.
        const valen = coincidenciasQueValen(conPuntuacion(100, 62, 12, 3));
        expect(valen.map((c) => c.score)).toEqual([100, 62]);
    });

    it('el mínimo entra, lo de justo debajo no', () => {
        const valen = coincidenciasQueValen(conPuntuacion(MINIMO_PARA_ENSENAR, MINIMO_PARA_ENSENAR - 1));
        expect(valen).toHaveLength(1);
        expect(valen[0].score).toBe(MINIMO_PARA_ENSENAR);
    });

    it('van de mejor a peor', () => {
        const valen = coincidenciasQueValen(conPuntuacion(70, 100, 85));
        expect(valen.map((c) => c.score)).toEqual([100, 85, 70]);
    });

    it('no se enseñan más de las que caben', () => {
        const muchas = conPuntuacion(99, 98, 97, 96, 95, 94, 93, 92);
        expect(coincidenciasQueValen(muchas)).toHaveLength(MAXIMO_RESULTADOS);
        // Y las que quedan son las mejores, no las primeras que llegaron.
        expect(coincidenciasQueValen(muchas)[0].score).toBe(99);
    });

    it('sin coincidencias no devuelve nada, y no revienta', () => {
        expect(coincidenciasQueValen([])).toEqual([]);
        expect(coincidenciasQueValen()).toEqual([]);
    });

    it('los límites se pueden ajustar desde fuera', () => {
        const valen = coincidenciasQueValen(conPuntuacion(90, 80, 70), { minimo: 75, maximo: 1 });
        expect(valen.map((c) => c.score)).toEqual([90]);
    });
});
