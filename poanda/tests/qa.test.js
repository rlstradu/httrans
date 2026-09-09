/**
 * El control de calidad.
 *
 * Aquí lo que hay que vigilar son las dos maneras de fallar, y las dos son
 * malas de formas distintas:
 *
 * - **No avisar de algo que estaba mal.** Es el fallo obvio: la herramienta
 *   dice que todo está bien y el cliente encuentra un número cambiado.
 * - **Avisar de algo que estaba bien.** Es el fallo que mata el invento. Una
 *   lista con doscientos avisos de los que ciento noventa no lo son no la mira
 *   nadie, y a la tercera vez se desactiva la comprobación entera.
 *
 * Por eso casi todos los tests de aquí abajo tienen su pareja: uno que
 * comprueba que salta, y otro que comprueba que NO salta cuando no debe.
 */
import { describe, it, expect } from 'vitest';
import {
    COMPROBACIONES,
    bordeFinal,
    bordeInicial,
    buscarInconsistencias,
    numerosDe,
    revisarArchivo,
    revisarSegmento,
    signoFinal,
} from '../src/js/core/qa.js';

const seg = (id, original, traduccion) => ({ id, original, traduccion });
const cuales = (encendida) =>
    Object.fromEntries(COMPROBACIONES.map((c) => [c, c === encendida]));

/** Los identificadores de comprobación que ha soltado un segmento. */
const avisosDe = (segmento, contexto = {}) =>
    revisarSegmento(segmento, contexto).map((a) => a.comprobacion);

describe('segmentos sin traducir', () => {
    it('avisa del que está vacío', () => {
        expect(avisosDe(seg(1, 'Save changes', ''))).toContain('sin_traducir');
    });

    it('un segmento con solo espacios cuenta como vacío', () => {
        expect(avisosDe(seg(1, 'Save changes', '   '))).toContain('sin_traducir');
    });

    it('no dice nada más de un segmento vacío', () => {
        // Comparar contra un vacío diría que faltan los números, las etiquetas y
        // el punto final. Con "esto no está traducido" ya está todo dicho.
        expect(avisosDe(seg(1, 'Save 3 files.', ''))).toEqual(['sin_traducir']);
    });

    it('un original vacío no se revisa', () => {
        // No es un segmento: es una línea del archivo que no se traduce.
        expect(avisosDe(seg(1, '', ''))).toEqual([]);
    });
});

describe('números', () => {
    it('encuentra los grupos de dígitos', () => {
        expect(numerosDe('Se han copiado 3 de 1500 archivos')).toEqual(['3', '1500']);
        expect(numerosDe('sin números')).toEqual([]);
    });

    it('avisa del número que no llegó a la traducción', () => {
        const avisos = revisarSegmento(seg(1, 'Delete 5 files', 'Eliminar 6 archivos'), {
            cuales: cuales('numeros'),
        });
        expect(avisos).toHaveLength(1);
        expect(avisos[0].dato).toBe('5');
    });

    it('no avisa cuando el número está', () => {
        expect(avisosDe(seg(1, 'Delete 5 files', 'Eliminar 5 archivos'), { cuales: cuales('numeros') })).toEqual([]);
    });

    it('los separadores de miles no cuentan como cambio', () => {
        // "1,500" y "1.500" son el mismo número en dos convenciones; avisar de
        // eso sería avisar de que se ha traducido bien.
        expect(
            avisosDe(seg(1, 'Up to 1,500 items', 'Hasta 1.500 elementos'), {
                cuales: cuales('numeros'),
            }),
        ).toEqual([]);
    });

    it('un número que sobra en la traducción no se marca', () => {
        // Solo se mira que no se pierda lo del original. Añadir "el 1 de enero"
        // donde el original decía "January" es traducir, no equivocarse.
        expect(
            avisosDe(seg(1, 'In January', 'El 1 de enero'), { cuales: cuales('numeros') }),
        ).toEqual([]);
    });
});

describe('espacios', () => {
    it('reconoce qué hay en los bordes', () => {
        expect(bordeInicial('  hola')).toBe('espacio');
        expect(bordeInicial('\n hola')).toBe('salto');
        expect(bordeInicial('hola')).toBe('nada');
        expect(bordeFinal('hola ')).toBe('espacio');
        expect(bordeFinal('hola')).toBe('nada');
    });

    it('avisa del espacio de los extremos que se ha perdido', () => {
        // Un espacio al final rara vez es adorno: suele unir este segmento con
        // el siguiente, y perderlo junta dos palabras.
        expect(
            avisosDe(seg(1, 'Hello ', 'Hola'), { cuales: cuales('espacios_extremos') }),
        ).toEqual(['espacios_extremos']);
    });

    it('no avisa cuando los bordes coinciden', () => {
        expect(
            avisosDe(seg(1, ' Hello ', ' Hola '), { cuales: cuales('espacios_extremos') }),
        ).toEqual([]);
    });

    it('avisa de los espacios dobles de la traducción', () => {
        expect(
            avisosDe(seg(1, 'Save changes', 'Guardar  cambios'), {
                cuales: cuales('espacios_dobles'),
            }),
        ).toEqual(['espacios_dobles']);
    });

    it('no avisa si el original también los lleva', () => {
        // Hay formatos donde el espaciado es parte del texto y respetarlo es lo
        // correcto.
        expect(
            avisosDe(seg(1, 'Save  changes', 'Guardar  cambios'), {
                cuales: cuales('espacios_dobles'),
            }),
        ).toEqual([]);
    });
});

describe('puntuación final', () => {
    it('reconoce el signo con el que acaba', () => {
        expect(signoFinal('Hola.')).toBe('.');
        expect(signoFinal('¿Qué tal?  ')).toBe('?');
        expect(signoFinal('Hola')).toBe('');
    });

    it('avisa del punto que falta', () => {
        expect(
            avisosDe(seg(1, 'Save changes.', 'Guardar cambios'), {
                cuales: cuales('puntuacion_final'),
            }),
        ).toEqual(['puntuacion_final']);
    });

    it('no avisa de las comillas ni los paréntesis', () => {
        // Cambian de forma al traducir con toda la razón del mundo.
        expect(
            avisosDe(seg(1, 'Press "OK"', 'Pulsa «Aceptar»'), {
                cuales: cuales('puntuacion_final'),
            }),
        ).toEqual([]);
    });

    it('los signos de apertura del español no cuentan como cambio', () => {
        expect(
            avisosDe(seg(1, 'Are you sure?', '¿Estás seguro?'), {
                cuales: cuales('puntuacion_final'),
            }),
        ).toEqual([]);
    });
});

describe('etiquetas', () => {
    const comparar = (original, traduccion) => ({
        correcto: (original.match(/%s/g) || []).length === (traduccion.match(/%s/g) || []).length,
    });

    it('avisa de la etiqueta que falta', () => {
        expect(
            avisosDe(seg(1, 'Saved %s files', 'Archivos guardados'), {
                cuales: cuales('etiquetas'),
                compararEtiquetas: comparar,
            }),
        ).toEqual(['etiquetas']);
    });

    it('no avisa cuando están todas', () => {
        expect(
            avisosDe(seg(1, 'Saved %s files', 'Guardados %s archivos'), {
                cuales: cuales('etiquetas'),
                compararEtiquetas: comparar,
            }),
        ).toEqual([]);
    });
});

describe('glosario', () => {
    const glosario = [{ srcTerm: 'file', tgtTerm: 'archivo' }];
    const terminosEnElTexto = (g, texto) =>
        g.filter((e) => texto.toLowerCase().includes(e.srcTerm));
    const contexto = { cuales: cuales('glosario'), glosario, terminosEnElTexto };

    it('avisa cuando la traducción no usa el término decidido', () => {
        const avisos = revisarSegmento(seg(1, 'Open the file', 'Abre el fichero'), contexto);
        expect(avisos).toHaveLength(1);
        expect(avisos[0].dato).toContain('archivo');
    });

    it('no avisa cuando sí lo usa', () => {
        expect(avisosDe(seg(1, 'Open the file', 'Abre el archivo'), contexto)).toEqual([]);
    });

    it('el plural del término cuenta como usarlo', () => {
        // Si esto avisara, la lista se llenaría de falsos avisos y dejaría de
        // mirarse. Vale con que esté la raíz.
        expect(avisosDe(seg(1, 'Open the file', 'Abre los archivos'), contexto)).toEqual([]);
    });

    it('las mayúsculas no importan', () => {
        expect(avisosDe(seg(1, 'Open the file', 'Archivo abierto'), contexto)).toEqual([]);
    });

    it('sin glosario no dice nada', () => {
        expect(
            avisosDe(seg(1, 'Open the file', 'Abre el fichero'), {
                cuales: cuales('glosario'),
                glosario: [],
                terminosEnElTexto,
            }),
        ).toEqual([]);
    });
});

describe('la misma frase traducida de dos maneras', () => {
    it('las señala todas, no solo la segunda', () => {
        // Quien mira la lista tiene que poder ir a cualquiera de ellas para
        // compararlas.
        const avisos = buscarInconsistencias([
            seg(1, 'Save', 'Guardar'),
            seg(2, 'Save', 'Almacenar'),
            seg(3, 'Open', 'Abrir'),
        ]);

        expect(avisos.map((a) => a.id).sort()).toEqual([1, 2]);
        expect(avisos[0].dato).toContain('Guardar');
        expect(avisos[0].dato).toContain('Almacenar');
    });

    it('la misma frase traducida igual no es un aviso', () => {
        expect(
            buscarInconsistencias([seg(1, 'Save', 'Guardar'), seg(2, 'Save', 'Guardar')]),
        ).toEqual([]);
    });

    it('los segmentos sin traducir no cuentan como una traducción distinta', () => {
        // Si contaran, todo archivo a medias saldría lleno de inconsistencias.
        expect(
            buscarInconsistencias([seg(1, 'Save', 'Guardar'), seg(2, 'Save', '')]),
        ).toEqual([]);
    });

    it('los espacios de más no hacen dos traducciones de una', () => {
        expect(
            buscarInconsistencias([seg(1, 'Save', 'Guardar'), seg(2, 'Save', ' Guardar ')]),
        ).toEqual([]);
    });
});

describe('revisar el archivo entero', () => {
    const archivo = [
        seg(1, 'Save 3 files', 'Guardar 3 archivos'),
        seg(2, 'Delete', ''),
        seg(3, 'Save 3 files', 'Guardar tres archivos'),
    ];

    it('cuenta los avisos por comprobación', () => {
        const { total, porComprobacion } = revisarArchivo(archivo);

        expect(porComprobacion.sin_traducir).toBe(1);
        expect(porComprobacion.inconsistencia).toBe(2);
        expect(total).toBeGreaterThanOrEqual(3);
    });

    it('un archivo impecable no da ni un aviso', () => {
        const { total } = revisarArchivo([
            seg(1, 'Save changes.', 'Guardar cambios.'),
            seg(2, 'Delete', 'Eliminar'),
        ]);
        expect(total).toBe(0);
    });

    it('se pueden apagar comprobaciones', () => {
        const { porComprobacion } = revisarArchivo(archivo, {
            cuales: { ...Object.fromEntries(COMPROBACIONES.map((c) => [c, true])), inconsistencia: false },
        });
        expect(porComprobacion.inconsistencia).toBe(0);
        expect(porComprobacion.sin_traducir).toBe(1);
    });

    it('un archivo vacío no revienta', () => {
        expect(revisarArchivo([]).total).toBe(0);
        expect(revisarArchivo().total).toBe(0);
    });
});
