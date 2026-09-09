/**
 * Control de calidad: lo que se revisa antes de entregar.
 *
 * Poanda solo comprobaba las etiquetas, y solo del segmento en el que estabas.
 * Todo lo demás —que un número se haya cambiado sin querer, que un segmento se
 * haya quedado sin traducir, que la misma frase esté traducida de dos maneras
 * distintas en el mismo archivo— dependía de que la persona lo viera al releer.
 * Y esas cosas no se ven releyendo: se ven cuando las encuentra el cliente.
 *
 * Este módulo no toca la pantalla ni sabe de idiomas: recibe los segmentos y
 * devuelve una lista de avisos. Así se puede probar entero sin navegador, que
 * es justo lo que hace falta en algo cuyo trabajo es no equivocarse.
 *
 * Todos los avisos son avisos, no errores. Cada uno tiene su falso positivo
 * razonable —un número que en la traducción se escribe con letra, una frase
 * repetida que de verdad se traduce de dos maneras según el contexto—, así que
 * la herramienta señala y quien traduce decide. Un control de calidad que se
 * pone a bloquear entregas acaba desactivado.
 */

/** Las comprobaciones, en el orden en que se enseñan. */
export const COMPROBACIONES = [
    'sin_traducir',
    'etiquetas',
    'numeros',
    'glosario',
    'inconsistencia',
    'espacios_dobles',
    'espacios_extremos',
    'puntuacion_final',
];

/** Todas encendidas es el estado por defecto. */
export const POR_DEFECTO = Object.fromEntries(COMPROBACIONES.map((id) => [id, true]));

const encendida = (id, cuales) => cuales?.[id] !== false;

const texto = (valor) => String(valor ?? '');

/**
 * Los números de un texto.
 *
 * Se cogen los grupos de dígitos y se ignora todo lo demás, incluidos los
 * separadores: "1.500" y "1500" son el mismo número escrito en dos
 * convenciones, y avisar de eso sería avisar de que se ha traducido bien.
 */
export function numerosDe(cadena) {
    return (texto(cadena).match(/\d+/g) || []).filter(Boolean);
}

/** Qué hay al principio de un texto: nada, un espacio, o un salto de línea. */
export function bordeInicial(cadena) {
    const encontrado = texto(cadena).match(/^(\s+)/);
    if (!encontrado) return 'nada';
    return /\n/.test(encontrado[1]) ? 'salto' : 'espacio';
}

/** Lo mismo al final. */
export function bordeFinal(cadena) {
    const encontrado = texto(cadena).match(/(\s+)$/);
    if (!encontrado) return 'nada';
    return /\n/.test(encontrado[1]) ? 'salto' : 'espacio';
}

/**
 * El signo con el que acaba un texto, si acaba en signo.
 *
 * Solo se miran los de cierre de frase y los dos puntos. Ni las comillas ni los
 * paréntesis: cambian de forma al traducir con toda la razón del mundo.
 */
export function signoFinal(cadena) {
    const limpio = texto(cadena).trimEnd();
    const ultimo = limpio.slice(-1);
    return /[.:;!?…]/.test(ultimo) ? ultimo : '';
}

/**
 * ¿Aparece la traducción de un término en el segmento traducido?
 *
 * Se busca por el principio de la palabra y sin distinguir mayúsculas: si el
 * glosario dice "archivo" y en la traducción pone "archivos", eso es un acierto
 * y no un fallo. Es una comprobación deliberadamente generosa; lo contrario
 * llena la lista de avisos que no lo son, y una lista así no la mira nadie.
 */
function contieneElTermino(traduccion, termino) {
    const aguja = texto(termino).trim().toLowerCase();
    if (!aguja) return true;

    const raiz = aguja.length > 5 ? aguja.slice(0, Math.ceil(aguja.length * 0.75)) : aguja;
    return texto(traduccion).toLowerCase().includes(raiz);
}

/**
 * Revisa un segmento.
 *
 * @param {{id: string, original: string, traduccion: string}} segmento
 * @param {Object} [contexto]
 * @param {Object} [contexto.cuales] Qué comprobaciones están encendidas.
 * @param {Array<object>} [contexto.glosario]
 * @param {(original: string, traduccion: string) => {correcto: boolean}} [contexto.compararEtiquetas]
 * @param {(glosario: Array<object>, texto: string) => Array<object>} [contexto.terminosEnElTexto]
 * @returns {Array<{comprobacion: string, id: string, dato?: string}>}
 */
export function revisarSegmento(segmento, contexto = {}) {
    const { cuales, glosario = [], compararEtiquetas, terminosEnElTexto } = contexto;
    const original = texto(segmento?.original);
    const traduccion = texto(segmento?.traduccion);
    const id = segmento?.id;
    const avisos = [];
    const avisar = (comprobacion, dato) => avisos.push({ comprobacion, id, dato });

    // Un segmento sin original no es un segmento: es una línea del archivo que
    // no se traduce, y revisarla solo produce ruido.
    if (!original.trim()) return avisos;

    if (encendida('sin_traducir', cuales) && !traduccion.trim()) {
        avisar('sin_traducir');
        // El resto de comprobaciones compararían contra un vacío y dirían que
        // falta todo. Con "esto no está traducido" ya está dicho.
        return avisos;
    }

    if (encendida('etiquetas', cuales) && compararEtiquetas) {
        const resultado = compararEtiquetas(original, traduccion);
        if (resultado && !resultado.correcto) avisar('etiquetas');
    }

    if (encendida('numeros', cuales)) {
        // Se compara contra todos los dígitos del destino pegados: así "1.500"
        // encuentra el "1500" del original y al revés.
        const enDestino = numerosDe(traduccion).join('');
        for (const numero of numerosDe(original)) {
            if (!enDestino.includes(numero)) avisar('numeros', numero);
        }
    }

    if (encendida('glosario', cuales) && glosario.length && terminosEnElTexto) {
        for (const entrada of terminosEnElTexto(glosario, original)) {
            if (!entrada?.tgtTerm) continue;
            if (!contieneElTermino(traduccion, entrada.tgtTerm)) {
                avisar('glosario', `${entrada.srcTerm} → ${entrada.tgtTerm}`);
            }
        }
    }

    if (encendida('espacios_dobles', cuales) && / {2,}/.test(traduccion)) {
        // Salvo que el original también los lleve: hay formatos donde el
        // espaciado es parte del texto y respetarlo es lo correcto.
        if (!/ {2,}/.test(original)) avisar('espacios_dobles');
    }

    if (encendida('espacios_extremos', cuales)) {
        // Un espacio al principio o al final rara vez está de adorno: suele
        // unir el segmento con el de al lado, y perderlo junta dos palabras.
        if (bordeInicial(original) !== bordeInicial(traduccion)) avisar('espacios_extremos');
        else if (bordeFinal(original) !== bordeFinal(traduccion)) avisar('espacios_extremos');
    }

    if (encendida('puntuacion_final', cuales)) {
        const enOrigen = signoFinal(original);
        const enDestino = signoFinal(traduccion);
        if (enOrigen !== enDestino) {
            avisar('puntuacion_final', `${enOrigen || '—'} / ${enDestino || '—'}`);
        }
    }

    return avisos;
}

/**
 * Busca la misma frase traducida de dos maneras distintas.
 *
 * Esta no se puede hacer segmento a segmento: hace falta el archivo entero. Es
 * de los avisos más útiles que hay, porque señala justo lo que se le escapa a
 * quien traduce —dos días distintos, dos decisiones distintas para la misma
 * frase— y lo que a un cliente le salta a la vista al leer seguido.
 *
 * @param {Array<{id: string, original: string, traduccion: string}>} segmentos
 * @returns {Array<{comprobacion: string, id: string, dato: string}>}
 */
export function buscarInconsistencias(segmentos = []) {
    const porOriginal = new Map();
    for (const segmento of segmentos) {
        const original = texto(segmento?.original).trim();
        const traduccion = texto(segmento?.traduccion).trim();
        if (!original || !traduccion) continue;

        if (!porOriginal.has(original)) porOriginal.set(original, []);
        porOriginal.get(original).push({ id: segmento.id, traduccion });
    }

    const avisos = [];
    for (const repeticiones of porOriginal.values()) {
        const distintas = new Set(repeticiones.map((r) => r.traduccion));
        if (distintas.size < 2) continue;

        // Se avisa en todas las apariciones, no solo en la primera: quien mira
        // la lista tiene que poder ir a cualquiera de ellas para compararlas.
        for (const repeticion of repeticiones) {
            avisos.push({
                comprobacion: 'inconsistencia',
                id: repeticion.id,
                dato: [...distintas].join('  ·  '),
            });
        }
    }
    return avisos;
}

/**
 * Revisa el archivo entero.
 *
 * @param {Array<{id: string, original: string, traduccion: string}>} segmentos
 * @param {Object} [contexto] El mismo que revisarSegmento.
 * @returns {{avisos: Array<object>, porComprobacion: Object, total: number}}
 */
export function revisarArchivo(segmentos = [], contexto = {}) {
    const avisos = [];
    for (const segmento of segmentos) {
        avisos.push(...revisarSegmento(segmento, contexto));
    }
    if (encendida('inconsistencia', contexto.cuales)) {
        avisos.push(...buscarInconsistencias(segmentos));
    }

    const porComprobacion = {};
    for (const comprobacion of COMPROBACIONES) porComprobacion[comprobacion] = 0;
    for (const aviso of avisos) porComprobacion[aviso.comprobacion]++;

    return { avisos, porComprobacion, total: avisos.length };
}
