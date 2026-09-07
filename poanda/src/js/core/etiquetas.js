/**
 * Etiquetas y códigos dentro de los segmentos.
 *
 * En casi cualquier archivo que se traduce hay trozos que no se traducen y
 * tienen que llegar intactos al otro lado: los huecos donde el programa mete
 * datos (%s, {nombre}) y las etiquetas de formato o de enlace (<b>, <a href>).
 * Si se pierde uno, el archivo se rompe. Si se cambian dos de orden, el archivo
 * se guarda sin protestar y el programa acaba enseñando el nombre donde iba la
 * fecha, que es peor porque no se nota hasta que ya está publicado.
 *
 * Este módulo solo reconoce y compara; no pinta nada ni toca la página. Lo usan
 * el editor (para colorearlas y para insertarlas) y el aviso por segmento.
 *
 * QUÉ ES UNA ETIQUETA Y QUÉ NO
 *
 * La tentación es reconocer todo lo que se parezca, y es un error: cada falso
 * positivo se convierte en un aviso rojo en un segmento que estaba bien, y a los
 * diez avisos falsos ya nadie mira los avisos. Así que se reconoce lo que de
 * verdad usan los formatos que abre Poanda, y ante la duda se deja pasar.
 */

/** Escapa lo que va a formar parte de una expresión regular. */
const PATRONES = {
    /**
     * Marcadores de printf, los de toda la vida de gettext: %s, %d, %.2f,
     * %1$s (numerado, para poder reordenarlos al traducir) y %(nombre)s (Python).
     * El "%%" va delante en la alternancia y se reconoce aparte: es un signo de
     * porcentaje literal, no un hueco, y si no se consumiera aquí se leería como
     * un "%" suelto seguido de otro.
     */
    printf: String.raw`%%|%\((?:[^)]+)\)[-+ 0#']*[\d.*]*[a-zA-Z]|%[-+ 0#']*\d+\$[-+ 0#']*[\d.*]*[a-zA-Z]|%[-+ 0#']*[\d.*]*[a-zA-Z]`,

    /** Llaves dobles: {{nombre}} de i18next, Mustache y Vue. */
    dobleLlave: String.raw`\{\{[^{}]+\}\}`,

    /** Llaves simples: {nombre}, {0}, de ICU y de .NET. */
    llave: String.raw`\{[^{}]+\}`,

    /** %{nombre}, de Ruby y de vue-i18n. */
    porcentajeLlave: String.raw`%\{[^{}]+\}`,

    /** Etiquetas numeradas <0>…</0> del componente Trans de react-i18next. */
    numerada: String.raw`<\/?\d+>`,

    /**
     * HTML en línea. Se exige que empiece por letra y que los atributos no
     * lleven ">" dentro, para no tragarse un "5 < 7" ni media frase.
     */
    html: String.raw`<[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*?)?\/?>|<\/[a-zA-Z][a-zA-Z0-9]*\s*>`,

    /**
     * Etiquetas de XML con espacio de nombres, como las que llevan dentro los
     * documentos de LibreOffice (<text:span text:style-name="Negrita">) o las
     * historias de InDesign. Es como la de HTML pero admitiendo los dos puntos
     * y el guion en el nombre.
     */
    xml: String.raw`<\/?[a-zA-Z][\w.-]*(?::[\w.-]+)?(?:\s[^<>]*?)?\/?>`,
};

/**
 * Un perfil dice qué familias de etiquetas se reconocen en un formato.
 *
 * El orden importa: las alternativas se prueban de izquierda a derecha, así que
 * lo más específico va primero. "{{x}}" antes que "{x}", y "%{x}" antes que
 * "%…", o se reconocería solo la mitad.
 */
const PERFILES = {
    po: {
        id: 'po',
        familias: ['printf', 'dobleLlave', 'llave', 'html'],
    },
    json: {
        id: 'json',
        familias: ['dobleLlave', 'porcentajeLlave', 'llave', 'numerada', 'html'],
    },
    html: {
        id: 'html',
        familias: ['dobleLlave', 'llave', 'html'],
    },

    /**
     * Word, Excel y PowerPoint. El formato de dentro de un párrafo llega al
     * segmento convertido en etiquetas con nombre y número (<b1>…</b1>), que
     * son etiquetas corrientes para lo que a este módulo respecta.
     */
    docx: { id: 'docx', familias: ['llave', 'html'] },

    /** Los documentos de LibreOffice traen el formato con espacio de nombres. */
    odf: { id: 'odf', familias: ['llave', 'xml'] },

    /** Un libro electrónico es HTML por dentro. */
    epub: { id: 'epub', familias: ['dobleLlave', 'llave', 'html'] },

    /** DITA e InDesign: XML con elementos dentro de la frase. */
    dita: { id: 'dita', familias: ['xml'] },
    idml: { id: 'idml', familias: ['xml'] },

    /**
     * La familia XLIFF. Además de sus propias etiquetas (<g id="1">, <x/>),
     * arrastra las del archivo del que salió: un XLIFF hecho a partir de un PO
     * lleva dentro los %s del PO.
     */
    xliff: { id: 'xliff', familias: ['printf', 'dobleLlave', 'llave', 'html'] },

    /** Qt numera sus huecos con %1, %2. */
    qtts: { id: 'qtts', familias: ['printf', 'llave', 'html'] },

    /** .NET y los instaladores numeran los suyos con {0}. */
    resx: { id: 'resx', familias: ['llave', 'html'] },

    /** Flutter usa los huecos de ICU: {nombre}, {count, plural, …}. */
    arb: { id: 'arb', familias: ['dobleLlave', 'llave', 'html'] },

    /** Un .mo es un PO compilado: las mismas etiquetas que el PO. */
    mo: { id: 'mo', familias: ['printf', 'dobleLlave', 'llave', 'html'] },
};

/**
 * Formatos que comparten perfil con otro. Se escriben aparte para no repetir la
 * lista de familias en cada uno y que no se queden descuadradas.
 */
const MISMO_PERFIL_QUE = {
    xlsx: 'docx',
    pptx: 'docx',
    odt: 'odf',
    ods: 'odf',
    odp: 'odf',
    ditamap: 'dita',
    sdlxliff: 'xliff',
    mxliff: 'xliff',
    mqxliff: 'xliff',
    mqxlz: 'xliff',
    locversia: 'xliff',
    wxl: 'resx',
    properties: 'resx',
};

/** Perfil de reserva: lo común a todos, para un formato que no conocemos. */
const PERFIL_GENERAL = {
    id: 'general',
    familias: ['dobleLlave', 'llave', 'html'],
};

/** Cachea la expresión regular de cada perfil: se usa en cada tecleo. */
const expresiones = new Map();

/**
 * @param {{id: string, familias: string[]}} perfil
 * @returns {RegExp} Expresión con la bandera global, lista para recorrer.
 */
function expresionDe(perfil) {
    if (!expresiones.has(perfil.id)) {
        const alternativas = perfil.familias.map((f) => PATRONES[f]).join('|');
        expresiones.set(perfil.id, new RegExp(`(?:${alternativas})`, 'g'));
    }
    // Se devuelve siempre con el índice a cero: una expresión global recuerda
    // dónde se quedó, y compartirla sin reiniciarla salta coincidencias.
    const expresion = expresiones.get(perfil.id);
    expresion.lastIndex = 0;
    return expresion;
}

/**
 * Perfil de etiquetas de un formato de archivo.
 *
 * @param {string} formato 'po', 'json', 'html'…
 * @returns {{id: string, familias: string[]}}
 */
export function perfilDeFormato(formato) {
    const id = String(formato || '').toLowerCase();
    return PERFILES[id] || PERFILES[MISMO_PERFIL_QUE[id]] || PERFIL_GENERAL;
}

/**
 * Clasifica una etiqueta suelta.
 *
 * - hueco: donde el programa mete un dato (%s, {nombre}).
 * - apertura / cierre: van en pareja (<b> … </b>).
 * - suelta: no lleva pareja (<br/>).
 *
 * @param {string} texto
 * @returns {{tipo: string, nombre: string|null}}
 */
function clasificar(texto) {
    const cierre = texto.match(/^<\/\s*([a-zA-Z0-9][a-zA-Z0-9]*)\s*>$/);
    if (cierre) return { tipo: 'cierre', nombre: cierre[1].toLowerCase() };

    if (texto.startsWith('<')) {
        const apertura = texto.match(/^<([a-zA-Z0-9][a-zA-Z0-9]*)/);
        const nombre = apertura ? apertura[1].toLowerCase() : null;
        // Una etiqueta que se cierra sobre sí misma (<br/>) no tiene pareja.
        return { tipo: /\/\s*>$/.test(texto) ? 'suelta' : 'apertura', nombre };
    }

    return { tipo: 'hueco', nombre: texto };
}

/**
 * Busca las etiquetas de un texto.
 *
 * @param {string} texto
 * @param {{id: string, familias: string[]}} perfil
 * @returns {Array<{texto: string, inicio: number, fin: number, tipo: string, nombre: string|null}>}
 */
export function extraerEtiquetas(texto, perfil = PERFIL_GENERAL) {
    const cadena = String(texto ?? '');
    if (!cadena) return [];

    const encontradas = [];
    const expresion = expresionDe(perfil);
    let coincidencia;

    while ((coincidencia = expresion.exec(cadena)) !== null) {
        // "%%" se reconoce para consumirlo, pero no es una etiqueta: es un signo
        // de porcentaje literal y no hay nada que conservar ni que comparar.
        if (coincidencia[0] === '%%') continue;

        encontradas.push({
            texto: coincidencia[0],
            inicio: coincidencia.index,
            fin: coincidencia.index + coincidencia[0].length,
            ...clasificar(coincidencia[0]),
        });
    }

    return encontradas;
}

/**
 * Trocea el texto en partes de texto normal y partes de etiqueta.
 *
 * Es lo que necesita el editor para pintarlas: recorre los trozos y envuelve en
 * color solo los que son etiqueta. Los trozos, unidos, dan el texto original
 * exactamente igual que estaba.
 *
 * @param {string} texto
 * @param {{id: string, familias: string[]}} perfil
 * @returns {Array<{esEtiqueta: boolean, texto: string}>}
 */
export function partirPorEtiquetas(texto, perfil = PERFIL_GENERAL) {
    const cadena = String(texto ?? '');
    if (!cadena) return [];

    const trozos = [];
    let posicion = 0;

    for (const etiqueta of extraerEtiquetas(cadena, perfil)) {
        if (etiqueta.inicio > posicion) {
            trozos.push({ esEtiqueta: false, texto: cadena.slice(posicion, etiqueta.inicio) });
        }
        trozos.push({ esEtiqueta: true, texto: etiqueta.texto });
        posicion = etiqueta.fin;
    }

    if (posicion < cadena.length) {
        trozos.push({ esEtiqueta: false, texto: cadena.slice(posicion) });
    }

    return trozos;
}

/**
 * Resta dos listas contando las repeticiones.
 *
 * Contar solo si aparece o no sería un error: dos "%s" en el original y uno en
 * la traducción es un archivo roto, aunque "%s" esté en las dos.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {string[]} Lo que está en `a` y no en `b`, con sus repeticiones.
 */
function restar(a, b) {
    const cuenta = new Map();
    for (const x of b) cuenta.set(x, (cuenta.get(x) || 0) + 1);

    const sobrantes = [];
    for (const x of a) {
        const quedan = cuenta.get(x) || 0;
        if (quedan > 0) cuenta.set(x, quedan - 1);
        else sobrantes.push(x);
    }
    return sobrantes;
}

/**
 * Busca aperturas sin cerrar y cierres sueltos dentro de un mismo texto.
 *
 * @param {Array} etiquetas
 * @returns {{sinCerrar: string[], cierresSueltos: string[]}}
 */
function revisarParejas(etiquetas) {
    const abiertas = [];
    const cierresSueltos = [];

    for (const etiqueta of etiquetas) {
        if (etiqueta.tipo === 'apertura') abiertas.push(etiqueta);
        else if (etiqueta.tipo === 'cierre') {
            const ultima = abiertas.length ? abiertas[abiertas.length - 1] : null;
            if (ultima && ultima.nombre === etiqueta.nombre) abiertas.pop();
            else cierresSueltos.push(etiqueta.texto);
        }
    }

    return { sinCerrar: abiertas.map((e) => e.texto), cierresSueltos };
}

/**
 * Compara las etiquetas del original con las de la traducción.
 *
 * Devuelve qué falta, qué sobra, si cambió el orden y qué parejas están mal.
 * Una traducción vacía nunca da error: aún no se ha escrito, y llenar el archivo
 * de avisos rojos nada más abrirlo consigue que no se mire ninguno.
 *
 * @param {string} original
 * @param {string} traduccion
 * @param {{id: string, familias: string[]}} perfil
 * @returns {{correcto: boolean, vacia: boolean, faltan: string[], sobran: string[],
 *            ordenCambiado: boolean, sinCerrar: string[], cierresSueltos: string[],
 *            resumen: string}}
 */
export function compararEtiquetas(original, traduccion, perfil = PERFIL_GENERAL) {
    const enOrigen = extraerEtiquetas(original, perfil);
    const enDestino = extraerEtiquetas(traduccion, perfil);

    const vacia = String(traduccion ?? '').trim() === '';

    const textosOrigen = enOrigen.map((e) => e.texto);
    const textosDestino = enDestino.map((e) => e.texto);

    const faltan = vacia ? [] : restar(textosOrigen, textosDestino);
    const sobran = vacia ? [] : restar(textosDestino, textosOrigen);

    // El orden solo se mira cuando están todas: si falta alguna, lo que hay que
    // decir es que falta, no que está desordenada.
    const ordenCambiado =
        !vacia &&
        faltan.length === 0 &&
        sobran.length === 0 &&
        textosOrigen.join(' ') !== textosDestino.join(' ');

    const parejas = vacia
        ? { sinCerrar: [], cierresSueltos: [] }
        : revisarParejas(enDestino);

    const correcto =
        faltan.length === 0 &&
        sobran.length === 0 &&
        !ordenCambiado &&
        parejas.sinCerrar.length === 0 &&
        parejas.cierresSueltos.length === 0;

    return {
        correcto,
        vacia,
        faltan,
        sobran,
        ordenCambiado,
        sinCerrar: parejas.sinCerrar,
        cierresSueltos: parejas.cierresSueltos,
        resumen: resumir({ faltan, sobran, ordenCambiado, ...parejas }),
    };
}

/**
 * Frase corta que explica el problema, para el aviso del segmento.
 *
 * Se escribe en inglés porque es la clave que luego traduce la interfaz; aquí
 * solo se juntan las etiquetas concretas, que son las que hay que ver.
 */
function resumir({ faltan, sobran, ordenCambiado, sinCerrar, cierresSueltos }) {
    const partes = [];
    if (faltan.length) partes.push(`missing: ${[...new Set(faltan)].join(' ')}`);
    if (sobran.length) partes.push(`extra: ${[...new Set(sobran)].join(' ')}`);
    if (ordenCambiado) partes.push('order changed');
    if (sinCerrar.length) partes.push(`unclosed: ${[...new Set(sinCerrar)].join(' ')}`);
    if (cierresSueltos.length) partes.push(`orphan: ${[...new Set(cierresSueltos)].join(' ')}`);
    return partes.join(' · ');
}
