/**
 * Las comprobaciones de calidad.
 *
 * Lo que se prueba de una regla de QA no es que salte: es que **no salte
 * cuando no debe**. Un aviso falso repetido en cada subtítulo hace que se deje
 * de mirar la lista entera, y entonces la comprobación buena que hay dos líneas
 * más abajo tampoco la ve nadie. Por eso casi todas las reglas tienen aquí su
 * caso que salta y su caso que no.
 */
import { describe, expect, it } from 'vitest';
import {
    LIMITES_DE_FABRICA,
    REGLAS,
    cuantosDeCada,
    lasDeFabrica,
    revisar,
    soloLasEncendidas,
} from '@core/qa.js';

/** Un subtítulo con lo justo, y lo que se le quiera cambiar. */
function sub(cambios = {}) {
    const startTimeMs = cambios.startTimeMs ?? 0;
    const endTimeMs = cambios.endTimeMs ?? 3000;
    return {
        index: 1,
        startTimeMs,
        endTimeMs,
        durationMs: endTimeMs - startTimeMs,
        original: 'Hello',
        translation: 'Hola',
        ...cambios,
        durationMs: (cambios.endTimeMs ?? endTimeMs) - (cambios.startTimeMs ?? startTimeMs),
    };
}

/** Lo que salga de una regla concreta. */
function conLaRegla(id, entradas, opciones = {}) {
    return revisar(entradas, opciones).filter((uno) => uno.regla === id);
}

describe('la tabla de reglas', () => {
    it('ninguna regla se llama igual que otra', () => {
        const ids = REGLAS.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('todas dicen si son error o aviso, y saben comprobar', () => {
        for (const regla of REGLAS) {
            expect(['error', 'aviso'], regla.id).toContain(regla.gravedad);
            expect(typeof regla.comprueba, regla.id).toBe('function');
        }
    });

    it('la que dice usar un límite usa uno que existe', () => {
        for (const regla of REGLAS.filter((r) => r.limite)) {
            expect(LIMITES_DE_FABRICA, regla.id).toHaveProperty(regla.limite);
        }
    });

    it('de fábrica vienen encendidas las que se revisan en cualquier encargo', () => {
        // Encenderlas las diecinueve de salida llena la lista de avisos el
        // primer día, y entonces no se mira ninguno.
        const encendidas = Object.entries(lasDeFabrica())
            .filter(([, si]) => si)
            .map(([id]) => id)
            .sort();
        expect(encendidas).toEqual(
            ['cps', 'duracion_minima', 'etiquetas', 'largo_de_linea', 'solapamiento'].sort(),
        );
    });

    it('la de sin traducir viene apagada, que al abrir un archivo saltaría en todos', () => {
        // Recién abierto no hay ni una línea traducida: encendida, la lista
        // sale con un aviso en cada subtítulo y ninguno dice nada que no se
        // vea. Es una regla para el final, no para el principio.
        expect(lasDeFabrica().sin_traducir).toBe(false);
    });
});

describe('el CPS', () => {
    it('salta cuando se lee demasiado rápido', () => {
        const salen = conLaRegla('cps', [sub({ translation: 'A'.repeat(70), endTimeMs: 3000 })]);
        expect(salen).toHaveLength(1);
        expect(salen[0].gravedad).toBe('error');
    });

    it('no cuenta las etiquetas ni los saltos de línea', () => {
        // Son los caracteres que se leen, no los que hay guardados. Contarlos
        // hacía que un subtítulo de dos líneas en cursiva pareciera pasado de
        // CPS sin estarlo.
        const conFormato = sub({ translation: '<i>Hola</i><br>mundo', endTimeMs: 1000 });
        expect(conLaRegla('cps', [conFormato])).toHaveLength(0);
    });

    it('y tampoco las marcas de un ASS', () => {
        const enAss = sub({ translation: '{\\an8}{\\i1}Hola{\\i0}', endTimeMs: 1000 });
        expect(conLaRegla('cps', [enAss])).toHaveLength(0);
    });
});

describe('el largo de línea', () => {
    it('mira la línea más larga, no el subtítulo entero', () => {
        // Dos líneas de treinta caben; sesenta caracteres seguidos, no.
        const dosLineas = sub({ translation: `${'A'.repeat(30)}<br>${'B'.repeat(30)}` });
        expect(conLaRegla('largo_de_linea', [dosLineas])).toHaveLength(0);

        const unaLarga = sub({ translation: 'A'.repeat(60) });
        expect(conLaRegla('largo_de_linea', [unaLarga])).toHaveLength(1);
    });
});

describe('el número de líneas', () => {
    it('salta con más de dos', () => {
        const tres = sub({ translation: 'Una<br>dos<br>tres' });
        expect(conLaRegla('lineas', [tres])).toHaveLength(1);
    });

    it('y no con dos', () => {
        expect(conLaRegla('lineas', [sub({ translation: 'Una<br>dos' })])).toHaveLength(0);
    });
});

describe('el formato que se pierde', () => {
    it('avisa si el original iba en cursiva y la traducción no', () => {
        const salen = conLaRegla('etiquetas', [sub({ original: '<i>Hello</i>', translation: 'Hola' })]);
        expect(salen).toHaveLength(1);
        expect(salen[0].datos.etiquetas.faltan).toEqual(['italic']);
    });

    it('y no avisa si está escrita con la forma del otro formato', () => {
        // Un `{\i1}` de un ASS y un `<i>` del editor son la misma cursiva.
        expect(conLaRegla('etiquetas', [sub({ original: '{\\i1}Hello{\\i0}', translation: '<i>Hola</i>' })]))
            .toHaveLength(0);
    });
});

describe('los tiempos', () => {
    it('dos subtítulos encima es un error, no un aviso', () => {
        const salen = conLaRegla('solapamiento', [
            sub({ startTimeMs: 0, endTimeMs: 3000 }),
            sub({ index: 2, startTimeMs: 2000, endTimeMs: 5000 }),
        ]);
        expect(salen).toHaveLength(1);
        expect(salen[0].gravedad).toBe('error');
        expect(salen[0].datos.cuanto).toBe(1000);
    });

    it('pegados no es solaparse', () => {
        const salen = conLaRegla('solapamiento', [
            sub({ startTimeMs: 0, endTimeMs: 3000 }),
            sub({ index: 2, startTimeMs: 3000, endTimeMs: 5000 }),
        ]);
        expect(salen).toHaveLength(0);
    });

    it('el hueco salta cuando pasa del límite', () => {
        const salen = conLaRegla('hueco', [
            sub({ startTimeMs: 0, endTimeMs: 1000 }),
            sub({ index: 2, startTimeMs: 5000, endTimeMs: 7000 }),
        ]);
        expect(salen).toHaveLength(1);
        expect(salen[0].datos.cuanto).toBe(4000);
    });

    it('dos subtítulos demasiado pegados se leen como uno solo', () => {
        // Dos fotogramas de aire entre uno y otro es lo que se pide en casi
        // cualquier encargo: sin ellos el ojo no nota que ha cambiado.
        const salen = conLaRegla('hueco_minimo', [
            sub({ startTimeMs: 0, endTimeMs: 3000 }),
            sub({ index: 2, startTimeMs: 3040, endTimeMs: 6000 }),
        ]);
        expect(salen).toHaveLength(1);
        expect(salen[0].gravedad).toBe('error');
        expect(salen[0].datos.cuanto).toBe(40);
    });

    it('y con aire de sobra no dice nada', () => {
        expect(conLaRegla('hueco_minimo', [
            sub({ startTimeMs: 0, endTimeMs: 3000 }),
            sub({ index: 2, startTimeMs: 3200, endTimeMs: 6000 }),
        ])).toHaveLength(0);
    });

    it('si se solapan, eso no es estar pegados', () => {
        // Es otra cosa y ya lo cuenta `solapamiento`: decirlo dos veces con dos
        // nombres distintos es lo que hace que se deje de leer la lista.
        const solapados = [
            sub({ startTimeMs: 0, endTimeMs: 3000 }),
            sub({ index: 2, startTimeMs: 2000, endTimeMs: 6000 }),
        ];
        expect(conLaRegla('hueco_minimo', solapados)).toHaveLength(0);
        expect(conLaRegla('solapamiento', solapados)).toHaveLength(1);
    });

    it('un subtítulo demasiado corto no da tiempo a leerlo', () => {
        expect(conLaRegla('duracion_minima', [sub({ startTimeMs: 0, endTimeMs: 400 })])).toHaveLength(1);
        expect(conLaRegla('duracion_minima', [sub({ startTimeMs: 0, endTimeMs: 2000 })])).toHaveLength(0);
    });

    it('y uno demasiado largo se queda clavado en pantalla', () => {
        expect(conLaRegla('duracion_maxima', [sub({ startTimeMs: 0, endTimeMs: 9000 })])).toHaveLength(1);
    });

    it('el último subtítulo no se compara con el de después, que no existe', () => {
        expect(conLaRegla('solapamiento', [sub()])).toHaveLength(0);
        expect(conLaRegla('hueco', [sub()])).toHaveLength(0);
    });
});

describe('la velocidad de lectura', () => {
    it('salta con muchas palabras en poco tiempo', () => {
        const deprisa = sub({ translation: 'una dos tres cuatro cinco seis siete ocho', endTimeMs: 1000 });
        expect(conLaRegla('velocidad', [deprisa])).toHaveLength(1);
    });

    it('y un subtítulo vacío no tiene velocidad', () => {
        expect(conLaRegla('velocidad', [sub({ translation: '' })])).toHaveLength(0);
    });
});

describe('lo que falta por traducir', () => {
    it('salta si el original tenía texto y la traducción está vacía', () => {
        expect(conLaRegla('sin_traducir', [sub({ original: 'Hello', translation: '' })])).toHaveLength(1);
    });

    it('y no si el subtítulo está vacío en los dos lados', () => {
        // Los hay: un hueco que el maquetador dejó a propósito.
        expect(conLaRegla('sin_traducir', [sub({ original: '', translation: '' })])).toHaveLength(0);
    });

    it('un subtítulo con solo etiquetas cuenta como vacío', () => {
        expect(conLaRegla('sin_traducir', [sub({ original: 'Hello', translation: '<i></i>' })])).toHaveLength(1);
    });
});

describe('el texto repetido', () => {
    it('salta cuando dos seguidos dicen lo mismo', () => {
        const salen = conLaRegla('repetido', [
            sub({ translation: 'Hola' }),
            sub({ index: 2, translation: 'Hola' }),
        ]);
        expect(salen).toHaveLength(1);
        expect(salen[0].numero).toBe(2);
    });

    it('y no cuando los dos están vacíos', () => {
        // Dos sin traducir no son una repetición, y decirlo esconde el aviso
        // que sí importa, que es que faltan por traducir.
        expect(conLaRegla('repetido', [sub({ translation: '' }), sub({ index: 2, translation: '' })]))
            .toHaveLength(0);
    });
});

describe('los espacios', () => {
    it('salta con un espacio al principio o al final de una línea', () => {
        expect(conLaRegla('espacios', [sub({ translation: 'Hola ' })])).toHaveLength(1);
        expect(conLaRegla('espacios', [sub({ translation: 'Hola<br> mundo' })])).toHaveLength(1);
    });

    it('y no con un texto normal', () => {
        expect(conLaRegla('espacios', [sub({ translation: 'Hola<br>mundo' })])).toHaveLength(0);
    });

    it('los espacios dobles son su propia comprobación', () => {
        expect(conLaRegla('espacios_dobles', [sub({ translation: 'Hola  mundo' })])).toHaveLength(1);
        expect(conLaRegla('espacios_dobles', [sub({ translation: 'Hola mundo' })])).toHaveLength(0);
    });
});

describe('los puntos suspensivos', () => {
    it('salta cuando se mezclan las dos formas en el mismo subtítulo', () => {
        expect(conLaRegla('puntos_suspensivos', [sub({ translation: 'Espera... y luego…' })]))
            .toHaveLength(1);
    });

    it('y no cuando se usa una sola', () => {
        expect(conLaRegla('puntos_suspensivos', [sub({ translation: 'Espera…' })])).toHaveLength(0);
        expect(conLaRegla('puntos_suspensivos', [sub({ translation: 'Espera...' })])).toHaveLength(0);
    });
});

describe('las mayúsculas', () => {
    it('salta con un subtítulo gritado', () => {
        expect(conLaRegla('mayusculas', [sub({ translation: 'PARA EL COCHE' })])).toHaveLength(1);
    });

    it('y cuenta las letras con tilde y la eñe, que también son letras', () => {
        // Mirando solo de la A a la Z, "ÑOÑO" y "ÁGUILA" se cuentan mal.
        expect(conLaRegla('mayusculas', [sub({ translation: 'ÑOÑO ÁGUILA' })])).toHaveLength(1);
    });

    it('una frase normal no salta aunque empiece por mayúscula', () => {
        expect(conLaRegla('mayusculas', [sub({ translation: 'Para el coche' })])).toHaveLength(0);
    });

    it('ni unas siglas sueltas', () => {
        expect(conLaRegla('mayusculas', [sub({ translation: 'Trabaja en la ONU desde hace años' })]))
            .toHaveLength(0);
    });
});

describe('los signos sin cerrar', () => {
    it('salta con un paréntesis abierto y sin cerrar', () => {
        const salen = conLaRegla('parentesis', [sub({ translation: '(Se oye un portazo' })]);
        expect(salen).toHaveLength(1);
        expect(salen[0].gravedad).toBe('error');
    });

    it('y con una interrogación de cierre sin la de apertura', () => {
        expect(conLaRegla('parentesis', [sub({ translation: '¿Dónde vas' })])).toHaveLength(1);
    });

    it('una frase en otro idioma sin signo de apertura no es un error', () => {
        // El inglés no los lleva, y avisarlo sería avisar en cada pregunta de
        // un original inglés.
        expect(conLaRegla('parentesis', [sub({ translation: 'Where are you going?' })])).toHaveLength(0);
    });

    it('y lo bien puesto no salta', () => {
        expect(conLaRegla('parentesis', [sub({ translation: '¿Dónde vas? (nadie contesta)' })]))
            .toHaveLength(0);
    });
});

describe('los números', () => {
    it('avisa de una cifra del original que no está en la traducción', () => {
        const salen = conLaRegla('numeros', [
            sub({ original: 'It costs 250 euros', translation: 'Cuesta 520 euros' }),
        ]);
        expect(salen).toHaveLength(1);
        expect(salen[0].datos.faltan).toEqual(['250']);
    });

    it('y no cuando están todas', () => {
        expect(conLaRegla('numeros', [sub({ original: '250 and 3', translation: '250 y 3' })]))
            .toHaveLength(0);
    });

    it('un original sin números no dice nada', () => {
        expect(conLaRegla('numeros', [sub({ original: 'Hello', translation: 'Hola' })])).toHaveLength(0);
    });
});

describe('los espacios de los bordes', () => {
    it('avisa si el original acaba en espacio y la traducción no', () => {
        // Es el subtítulo que continúa en el siguiente: sin ese espacio, al
        // juntarse las dos frases se pegan.
        expect(conLaRegla('espacios_en_los_bordes', [sub({ original: 'He said ', translation: 'Dijo' })]))
            .toHaveLength(1);
    });

    it('y calla si coinciden', () => {
        expect(conLaRegla('espacios_en_los_bordes', [sub({ original: 'He said ', translation: 'Dijo ' })]))
            .toHaveLength(0);
    });
});

describe('el glosario', () => {
    const glosario = [{ srcTerm: 'shield', tgtTerm: 'escudo' }];

    it('avisa si el término del glosario no aparece en la traducción', () => {
        const salen = conLaRegla('glosario', [sub({ original: 'Raise the shield', translation: 'Levanta la defensa' })], { glosario });
        expect(salen).toHaveLength(1);
        expect(salen[0].datos.faltan).toEqual(['escudo']);
    });

    it('y calla si está', () => {
        expect(conLaRegla('glosario', [sub({ original: 'Raise the shield', translation: 'Levanta el escudo' })], { glosario }))
            .toHaveLength(0);
    });

    it('sin glosario no dice nada', () => {
        expect(conLaRegla('glosario', [sub({ original: 'Raise the shield', translation: 'Levanta la defensa' })]))
            .toHaveLength(0);
    });
});

describe('lo que compara con el original', () => {
    it('calla mientras no haya traducción', () => {
        // Un subtítulo sin traducir no es un subtítulo mal traducido: ya lo
        // cuenta `sin_traducir`, y repetirlo con otras cuatro reglas llena la
        // lista de avisos que dicen todos lo mismo.
        const sinTraducir = [sub({ original: '<i>It costs 250</i> ', translation: '' })];
        for (const id of ['etiquetas', 'numeros', 'espacios_en_los_bordes', 'glosario']) {
            expect(conLaRegla(id, sinTraducir, { glosario: [{ srcTerm: 'costs', tgtTerm: 'cuesta' }] }), id)
                .toHaveLength(0);
        }
        // Y la que sí tiene que hablar, habla.
        expect(conLaRegla('sin_traducir', sinTraducir)).toHaveLength(1);
    });
});

describe('el motor', () => {
    it('respeta los límites que se le pasen', () => {
        const entradas = [sub({ translation: 'A'.repeat(50), endTimeMs: 3000 })];
        expect(conLaRegla('largo_de_linea', entradas, { limites: { porLinea: 42 } })).toHaveLength(1);
        expect(conLaRegla('largo_de_linea', entradas, { limites: { porLinea: 60 } })).toHaveLength(0);
    });

    it('se revisa todo, también lo que está apagado', () => {
        // Apagar una regla es decir "no me la enseñes", no "no la mires": el
        // número que va al lado de un filtro apagado tiene que decir cuántos
        // verías si lo encendieras, y nadie enciende un filtro que dice cero.
        const malo = [sub({ translation: 'HOLA  QUE TAL', endTimeMs: 3000 })];
        const todo = revisar(malo).map((u) => u.regla);
        expect(todo).toContain('mayusculas');
        expect(todo).toContain('espacios_dobles');
    });

    it('y apagar una regla la quita de lo que se enseña', () => {
        const malo = [sub({ translation: 'HOLA  QUE TAL', endTimeMs: 3000 })];
        const seVe = soloLasEncendidas(revisar(malo), { mayusculas: false, espacios_dobles: true });
        expect(seVe.map((u) => u.regla)).not.toContain('mayusculas');
        expect(seVe.map((u) => u.regla)).toContain('espacios_dobles');
    });

    it('el contador cuenta también lo apagado', () => {
        const malo = [sub({ translation: 'HOLA QUE TAL', endTimeMs: 3000 })];
        expect(cuantosDeCada(revisar(malo)).mayusculas).toBe(1);
    });

    it('un subtítulo puede salir por varias reglas a la vez', () => {
        const malo = [sub({ translation: 'A'.repeat(90), endTimeMs: 1000 })];
        const reglas = soloLasEncendidas(revisar(malo)).map((u) => u.regla);
        expect(reglas).toContain('cps');
        expect(reglas).toContain('largo_de_linea');
    });

    it('los resultados salen en el orden de los subtítulos', () => {
        const entradas = [
            sub({ index: 1, translation: 'Hola' }),
            sub({ index: 2, original: 'Hello', translation: '', startTimeMs: 4000, endTimeMs: 7000 }),
            sub({ index: 3, original: 'Bye', translation: '', startTimeMs: 8000, endTimeMs: 11000 }),
        ];
        const salen = revisar(entradas);
        expect(salen.map((u) => u.numero)).toEqual([...salen.map((u) => u.numero)].sort((a, b) => a - b));
    });

    it('cada resultado dice de qué subtítulo es', () => {
        const salen = revisar([sub({ index: 7, original: 'Hello', translation: '' })]);
        expect(salen[0]).toMatchObject({ indice: 0, numero: 7, regla: 'sin_traducir', gravedad: 'aviso' });
    });

    it('sin subtítulos no se queja de nada', () => {
        expect(revisar([])).toEqual([]);
        expect(revisar(null)).toEqual([]);
    });

    it('cuenta cuántos hay de cada regla', () => {
        const salen = [{ regla: 'cps' }, { regla: 'cps' }, { regla: 'lineas' }];
        expect(cuantosDeCada(salen)).toEqual({ cps: 2, lineas: 1 });
    });
});
