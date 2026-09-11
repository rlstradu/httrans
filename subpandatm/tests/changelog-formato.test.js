/**
 * Cómo se presenta el changelog en la ventana de la herramienta.
 *
 * El archivo es texto plano pensado para leerse en un editor. Lo que se marca a
 * mano dentro es poco —código y negrita— y si no se reconoce sale con los
 * signos a la vista en medio de la frase.
 */
import { describe, expect, it } from 'vitest';
import { formatearChangelog } from '../src/js/core/changelog-formato.js';

const UNA_VERSION = (cuerpo) => `=========================================
subpandaTM v2.0.0 - Una versión
=========================================

Release Date: September 11, 2026

${cuerpo}
`;

describe('lo que se marca dentro del texto', () => {
    it('la negrita sale en negrita y no con los asteriscos puestos', () => {
        const html = formatearChangelog(UNA_VERSION('Aquí manda una **regla importante** y punto.'));
        expect(html).toContain('<strong>regla importante</strong>');
        expect(html).not.toContain('**');
    });

    it('y el código sigue saliendo como código', () => {
        const html = formatearChangelog(UNA_VERSION('Se escribe con un `if` y ya está.'));
        expect(html).toContain('<code>if</code>');
    });

    it('un asterisco suelto no se convierte en nada', () => {
        const html = formatearChangelog(UNA_VERSION('Dos por tres son seis, 2 * 3 = 6.'));
        expect(html).not.toContain('<strong>');
    });

    it('el título y la fecha de la versión se reconocen', () => {
        const html = formatearChangelog(UNA_VERSION('Lo que trae.'));
        expect(html).toContain('subpandaTM v2.0.0 - Una versión');
        expect(html).toContain('September 11, 2026');
    });
});
