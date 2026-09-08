import {
    compararEtiquetas,
    extraerEtiquetas,
    partirPorEtiquetas,
    perfilDeFormato,
} from './core/etiquetas.js';
import { countWords } from './core/text.js';
import { escaparHtml } from './core/xml.js';
import { initEtiquetasEnTraduccion, marcadoDeCapa } from './etiquetas-campo.js';
import { showMessage } from './dialogs.js';
import { guardarNota } from './persistencia.js';
import {
    poSearchContainer,
    poSearchInput,
    searchInOriginalCheckbox,
    searchInTranslationCheckbox,
    statsContainer,
    translationsContainer,
    wordsTranslated,
} from './dom.js';
import { updateSaveButtonsState } from './files.js';
import { renderGlossary } from './glossary.js';
import { copyIconSVG, commentIconSVG } from './icons.js';
import { repartirComentarios } from './core/comentarios.js';
import { updateSearchCounter } from './search.js';
import { marcadoZonaSoltar } from './dropzone.js';
import { state } from './state.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import { addOrUpdateTMEntry, findBestTMMatch, tmSearch } from './tm.js';
import { translations } from './translations.js';

/**
 * Perfil de etiquetas del archivo que está abierto.
 *
 * Cada formato tiene sus códigos: un PO lleva %s y {nombre}, un JSON de i18next
 * lleva {{nombre}}, un HTML lleva etiquetas de verdad. Sin archivo abierto se
 * usa el de PO, que es lo que abre Poanda por defecto.
 */
function perfilActual() {
    return perfilDeFormato(state.currentFileType || 'po');
}

/**
 * Construye el marcado del texto original: etiquetas en color y, si toca,
 * términos del glosario y resultados de la búsqueda resaltados.
 *
 * Los tres resaltados escriben en el mismo elemento, así que tienen que salir de
 * un único sitio: antes cada uno reescribía el <pre> por su cuenta y el último
 * en pasar borraba lo de los otros. Aquí el texto se trocea una vez, las
 * etiquetas se envuelven en su color y los otros dos resaltados se aplican solo
 * dentro de los trozos de texto normal, que es donde tienen sentido: buscar
 * "href" no debería iluminar media etiqueta.
 *
 * De paso se escapa el HTML. Antes no se hacía, así que un msgid con <b> dentro
 * se veía en negrita en lugar de verse tal cual, que es justo lo contrario de lo
 * que necesita quien tiene que copiar esa etiqueta a la traducción.
 *
 * @param {string} texto Texto original del segmento.
 * @param {{glosario?: boolean, busqueda?: RegExp|null}} opciones
 * @returns {{html: string, terminos: Set<string>}}
 */
function marcadoDelOriginal(texto, { glosario = true, busqueda = null } = {}) {
    const terminos = new Set();
    const perfil = perfilActual();

    const html = partirPorEtiquetas(texto, perfil)
        .map((trozo) => {
            if (trozo.esEtiqueta) {
                const valor = escaparHtml(trozo.texto).replace(/'/g, '&#39;');
                return (
                    `<span class="etiqueta" data-etiqueta="${valor}" role="button" tabindex="0"` +
                    ` title="${escaparHtml(translations[state.currentLanguage]['tag_insert_hint'] || '')}">` +
                    `${escaparHtml(trozo.texto)}</span>`
                );
            }

            let parte = escaparHtml(trozo.texto);

            if (glosario) {
                const resultado = applyGlossaryHighlightToText(parte);
                parte = resultado.html;
                resultado.foundTerms.forEach((t) => terminos.add(t));
            }

            if (busqueda) {
                busqueda.lastIndex = 0;
                parte = parte.replace(
                    busqueda,
                    (encontrado) => `<span class="search-highlight">${encontrado}</span>`,
                );
            }

            return parte;
        })
        .join('');

    return { html, terminos };
}

/**
 * Vuelve a pintar el texto original de un segmento en su estado de reposo.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 * @param {string} texto
 */
function repintarOriginal(entryIndex, segmentIndex, texto) {
    const pre = document.getElementById(`msgid-pre-${entryIndex}-${segmentIndex}`);
    if (pre) pre.innerHTML = marcadoDelOriginal(texto).html;
}

/**
 * Deja todos los textos originales en reposo: con su glosario, sin búsqueda.
 *
 * El amarillo del glosario está en todo el archivo, no solo en el segmento en
 * el que se escribe, así que tocar el glosario cambia lo que se ve de arriba
 * abajo. Se repintan los originales, no el editor entero: reconstruirlo perdía
 * el foco, la posición de la pantalla y lo escrito a medias.
 */
function repintarTodosLosOriginales() {
    state.poEntries.forEach((entry, entryIndex) => {
        if (entry.isHeader) return;
        entry.sentenceSegments.forEach((segmento, segmentIndex) => {
            repintarOriginal(entryIndex, segmentIndex, segmento.original);
        });
    });
}

function pushToUndoStack() {
    // Guardamos un máximo de 15 estados para no saturar la memoria del navegador
    state.undoStack.push(JSON.parse(JSON.stringify(state.poEntries)));
    if (state.undoStack.length > 15) {
        state.undoStack.shift();
    }
}

/**
 * Ajusta el alto del cuadro de traducción a lo que hay escrito.
 *
 * Dos cuidados que parecen manías y no lo son:
 *
 * - Se pone el alto a cero antes de medir. Con 'auto', el navegador le da al
 *   textarea el alto de su atributo `rows` (dos líneas por defecto), así que
 *   scrollHeight nunca baja de ahí y todos los segmentos salían de dos líneas.
 * - Nunca queda más bajo que el original. Si la traducción está vacía, el
 *   cuadro sigue teniendo el alto del texto de al lado: así hay dónde pinchar y
 *   las dos columnas de la fila miden lo mismo.
 *
 * Medir solo funciona con el elemento ya metido en la página: fuera de ella
 * scrollHeight vale 0. Por eso el primer ajuste se hace al final del dibujado.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement|null} originalElement Texto original con el que emparejar.
 */
function autoResizeTextarea(textarea, originalElement) {
    textarea.style.height = '0px';
    const altoPropio = textarea.scrollHeight;
    const altoOriginal = originalElement ? originalElement.scrollHeight : 0;
    textarea.style.height = `${Math.max(altoPropio, altoOriginal)}px`;
}

/**
 * Da a cada cuadro de traducción el alto que le toca, una vez dibujada la lista.
 *
 * Va aparte del dibujado porque medir requiere que los elementos ya estén en la
 * página. Se hace todo de una pasada para no ir alternando escritura y medida,
 * que es lo que obliga al navegador a recalcular la página una vez por segmento.
 */
function ajustarAltoDeLosCuadros() {
    translationsContainer.querySelectorAll('textarea.msgstr-textarea').forEach((textarea) => {
        const columna = textarea.closest('.segmento-cuerpo');
        autoResizeTextarea(textarea, columna ? columna.querySelector('.segmento-origen pre') : null);
    });
}

/**
 * Marca cuál es la fila en la que se está trabajando.
 *
 * La marca va en la fila y no en la entrada porque una entrada con formas de
 * plural ocupa varias filas: señalarlas todas encendía media pantalla y no
 * decía en cuál estabas.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 */
function marcarFilaActiva(entryIndex, segmentIndex) {
    document
        .querySelectorAll('.segmento-fila-activa')
        .forEach((fila) => fila.classList.remove('segmento-fila-activa'));

    const textarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const fila = textarea ? textarea.closest('.segmento-fila') : null;
    if (fila) fila.classList.add('segmento-fila-activa');
}

/** Apaga la marca de la fila de un segmento concreto. */
function desmarcarFila(entryIndex, segmentIndex) {
    const textarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const fila = textarea ? textarea.closest('.segmento-fila') : null;
    if (fila) fila.classList.remove('segmento-fila-activa');
}

/**
 * Revisa las etiquetas de un segmento y enciende o apaga su aviso.
 *
 * El aviso vive en la columna del visto, encima de él, y solo aparece cuando hay
 * algo que decir. Una traducción vacía nunca da aviso: llenar la pantalla de
 * marcas rojas nada más abrir el archivo consigue que no se mire ninguna.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 */
function revisarEtiquetas(entryIndex, segmentIndex) {
    const aviso = document.getElementById(`avisoEtiquetas-${entryIndex}-${segmentIndex}`);
    const textarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const segmento = state.poEntries[entryIndex]?.sentenceSegments?.[segmentIndex];
    if (!aviso || !textarea || !segmento) return;

    const resultado = compararEtiquetas(segmento.original, textarea.value, perfilActual());
    const hayProblema = !resultado.correcto;

    aviso.hidden = !hayProblema;
    aviso.title = hayProblema
        ? `${translations[state.currentLanguage]['tag_mismatch'] || 'Tags do not match'}: ${resultado.resumen}`
        : '';

    const fila = textarea.closest('.segmento-fila');
    if (fila) fila.classList.toggle('etiquetas-mal', hayProblema);
}

/**
 * Mete una etiqueta en la traducción, donde esté el cursor.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {string} etiqueta
 */
function insertarEtiqueta(textarea, etiqueta) {
    if (!textarea || textarea.readOnly) return;

    const inicio = textarea.selectionStart ?? textarea.value.length;
    const fin = textarea.selectionEnd ?? inicio;

    textarea.value = textarea.value.slice(0, inicio) + etiqueta + textarea.value.slice(fin);

    // El cursor queda detrás de lo insertado, listo para seguir escribiendo.
    const despues = inicio + etiqueta.length;
    textarea.setSelectionRange(despues, despues);
    textarea.focus();

    // Se avisa como si se hubiera tecleado: así se enteran el recuento, las
    // estadísticas, el guardado y la revisión de etiquetas.
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Mete un texto en la traducción del segmento en el que se está trabajando.
 *
 * Lo usa la tarjeta del glosario para poner la traducción de un término de un
 * clic. Si el cuadro está enfocado, entra donde tenga el cursor; si no, en el
 * último en el que se estuvo, que es al que se va a volver.
 *
 * @param {string} texto
 * @returns {boolean} Si había dónde ponerlo.
 */
function insertarEnLaTraduccionActiva(texto) {
    if (!texto) return false;

    const enfocado = document.activeElement;
    let textarea =
        enfocado && enfocado.classList?.contains('msgstr-textarea') ? enfocado : null;

    if (!textarea && state.lastFocusedSegment) {
        const { entryIndex, segmentIndex } = state.lastFocusedSegment;
        textarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    }
    if (!textarea || textarea.readOnly) return false;

    insertarEtiqueta(textarea, texto);
    return true;
}

/**
 * Inserta la primera etiqueta del original que todavía no esté en la traducción.
 *
 * Es el atajo de siempre en las herramientas TAO (el F8 de Trados y memoQ): se
 * traduce sin soltar el teclado y las etiquetas se van poniendo por orden.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 * @returns {boolean} Si había alguna que poner.
 */
function insertarSiguienteEtiquetaQueFalta(entryIndex, segmentIndex) {
    const textarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const segmento = state.poEntries[entryIndex]?.sentenceSegments?.[segmentIndex];
    if (!textarea || !segmento) return false;

    const perfil = perfilActual();
    const enOrigen = extraerEtiquetas(segmento.original, perfil).map((e) => e.texto);
    const yaPuestas = extraerEtiquetas(textarea.value, perfil).map((e) => e.texto);

    // Se busca la primera del original que no esté ya puesta, contando
    // repeticiones: dos %s en el original necesitan dos %s en la traducción.
    const pendientes = [...yaPuestas];
    const siguiente = enOrigen.find((etiqueta) => {
        const donde = pendientes.indexOf(etiqueta);
        if (donde >= 0) {
            pendientes.splice(donde, 1);
            return false;
        }
        return true;
    });

    if (!siguiente) return false;
    insertarEtiqueta(textarea, siguiente);
    return true;
}

/** Texto de ayuda del recuento del original, en el idioma activo. */
function tituloCuentaOriginal() {
    const t = translations[state.currentLanguage];
    return `${t['char_count_original']}${t['char_units']}`.trim();
}

/** Texto de ayuda del recuento de la traducción, en el idioma activo. */
function tituloCuentaTraduccion() {
    const t = translations[state.currentLanguage];
    return `${t['char_count_translation']}${t['char_units']}`.trim();
}

/**
 * Pone al día el recuento de caracteres de la traducción.
 *
 * Solo el número: la etiqueta va en el título emergente. Antes se escribía
 * "Original: 13 caracteres | Traducción: 0 caracteres" debajo del segmento, que
 * en una lista de mil ocupaba más que el propio texto. Ahora cada recuento vive
 * dentro de su columna, en la esquina, y se lee de un vistazo sin leerlo.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement|null} charCountSpan
 */
function updateCharCount(textarea, charCountSpan) {
    if (charCountSpan) {
        charCountSpan.textContent = String(textarea.value.length);
    }
}

/**
 * Cabecera de contexto de una entrada: la etiqueta con el contexto y las
 * referencias del archivo, y una raya que llega hasta el borde.
 *
 * Solo van aquí las cosas que **identifican** el segmento: el contexto del PO y
 * la referencia al código, que se leen de un vistazo para ubicarse. Las notas
 * del programador se han ido al icono de comentario, porque hay que leerlas
 * enteras y solo las traen unos pocos segmentos. Ver core/comentarios.js.
 *
 * Devuelve null cuando la entrada no trae nada que contar, para no dejar una
 * línea vacía entre segmento y segmento.
 *
 * @param {object} entry Entrada del archivo PO.
 * @returns {HTMLElement|null}
 */
function crearCabeceraContexto(entry) {
    const partes = [];
    if (entry.msgctxt) partes.push(entry.msgctxt);
    partes.push(...repartirComentarios(entry.comments).referencias);
    if (partes.length === 0) return null;

    const cabecera = document.createElement('div');
    cabecera.className = 'segmento-contexto';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'segmento-contexto-etiqueta';
    etiqueta.textContent = partes.join(' · ');
    etiqueta.title = translations[state.currentLanguage]['context_msgctxt'] || 'Context';
    cabecera.appendChild(etiqueta);

    const raya = document.createElement('span');
    raya.className = 'segmento-contexto-raya';
    cabecera.appendChild(raya);

    return cabecera;
}

/**
 * Deja el icono de comentario como corresponda: encendido si hay algo que leer
 * —una nota del archivo o una escrita aquí—, apagado si no, y con el texto
 * entero en el title para poder leer una nota corta sin abrir nada.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 * @param {string[]} notasDelArchivo
 * @param {HTMLElement} [boton] El botón, si ya se tiene a mano.
 */
function actualizarIconoDeComentario(entryIndex, segmentIndex, notasDelArchivo, boton) {
    const icono =
        boton || document.getElementById(`comentarioBtn-${entryIndex}-${segmentIndex}`);
    if (!icono) return;

    const propia =
        state.poEntries[entryIndex]?.sentenceSegments[segmentIndex]?.nota || '';
    const idioma = translations[state.currentLanguage] || {};
    const partes = [...notasDelArchivo];
    if (propia) partes.push(propia);

    icono.classList.toggle('con-nota', partes.length > 0);
    icono.title =
        partes.length > 0
            ? partes.join('\n')
            : idioma['comment_add'] || 'Add a comment';
}

/** Cierra la cajita de comentario que hubiera abierta, sin guardar nada. */
function cerrarCajaDeComentario() {
    document.querySelectorAll('.comentario-caja').forEach((caja) => caja.remove());
}

/**
 * Abre —o cierra— la cajita de comentario de un segmento.
 *
 * No es un cuadro de diálogo: es una cajita que se despliega debajo de la fila,
 * pegada al segmento del que habla. Un diálogo tapa el texto justo cuando hace
 * falta mirarlo, y obliga a cerrarlo para seguir traduciendo; así se escribe la
 * nota con el original delante y se sigue.
 *
 * La nota se guarda en el proyecto, no en el archivo: cuando devuelvas el
 * archivo traducido saldrá igual que si no hubieras escrito nada. Es donde la
 * pone también Locversia, y es lo que evita colarle notas internas al cliente.
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 * @param {string[]} notasDelArchivo
 */
function abrirComentario(entryIndex, segmentIndex, notasDelArchivo) {
    const segmento = state.poEntries[entryIndex]?.sentenceSegments[segmentIndex];
    if (!segmento) return;

    // Pulsar otra vez el icono del mismo segmento cierra: el icono enciende y
    // apaga la cajita, que es lo que espera cualquiera al ver un botón así.
    const yaAbierta = document.getElementById(`comentarioCaja-${entryIndex}-${segmentIndex}`);
    cerrarCajaDeComentario();
    if (yaAbierta) return;

    const fila = document
        .getElementById(`msgstr-${entryIndex}-${segmentIndex}`)
        ?.closest('.segmento-fila');
    if (!fila) return;

    const idioma = translations[state.currentLanguage] || {};

    const caja = document.createElement('div');
    caja.id = `comentarioCaja-${entryIndex}-${segmentIndex}`;
    caja.className = 'comentario-caja';

    // Lo que venía en el archivo se enseña, pero no se toca: no es nuestro.
    if (notasDelArchivo.length > 0) {
        const titulillo = document.createElement('p');
        titulillo.className = 'comentario-titulillo';
        titulillo.textContent = idioma['comment_from_file'] || 'From the file';
        caja.appendChild(titulillo);

        const delArchivo = document.createElement('div');
        delArchivo.className = 'comentario-archivo';
        delArchivo.textContent = notasDelArchivo.join('\n');
        caja.appendChild(delArchivo);
    }

    const campo = document.createElement('textarea');
    campo.id = `comentarioTexto-${entryIndex}-${segmentIndex}`;
    campo.className = 'comentario-campo';
    campo.rows = 2;
    campo.value = segmento.nota || '';
    campo.placeholder = idioma['comment_yours'] || '';
    caja.appendChild(campo);

    const botones = document.createElement('div');
    botones.className = 'comentario-botones';

    const guardarBtn = document.createElement('button');
    guardarBtn.type = 'button';
    guardarBtn.className = 'comentario-boton comentario-guardar';
    guardarBtn.textContent = idioma['save_button'] || 'Save';

    const cancelarBtn = document.createElement('button');
    cancelarBtn.type = 'button';
    cancelarBtn.className = 'comentario-boton comentario-cancelar';
    cancelarBtn.textContent = idioma['cancel_button'] || 'Cancel';

    // Eliminar solo aparece cuando hay algo que eliminar: un botón de borrar
    // encendido sobre una nota que no existe solo sirve para dar un susto.
    if (segmento.nota) {
        const eliminarBtn = document.createElement('button');
        eliminarBtn.type = 'button';
        eliminarBtn.className = 'comentario-boton comentario-eliminar';
        eliminarBtn.textContent = idioma['delete_button'] || 'Delete';
        eliminarBtn.addEventListener('click', () => aplicarComentario(''));
        botones.appendChild(eliminarBtn);
    }

    botones.appendChild(cancelarBtn);
    botones.appendChild(guardarBtn);
    caja.appendChild(botones);

    fila.insertAdjacentElement('afterend', caja);

    // La animación de abrir necesita dos pasos: primero la cajita entra en la
    // página cerrada, y en el fotograma siguiente se le pone la clase que la
    // abre. Puestas las dos cosas a la vez, el navegador no ve ningún cambio
    // que animar y la cajita aparecería de golpe.
    requestAnimationFrame(() => {
        caja.classList.add('abierta');
    });
    caja.addEventListener('transitionend', (evento) => {
        if (evento.propertyName === 'max-height') caja.classList.add('abierta-del-todo');
    });

    campo.focus();
    // El cursor al final: lo normal al volver a una nota es añadirle algo, no
    // reescribirla desde el principio.
    campo.setSelectionRange(campo.value.length, campo.value.length);

    async function aplicarComentario(texto) {
        segmento.nota = texto;
        cerrarCajaDeComentario();
        actualizarIconoDeComentario(entryIndex, segmentIndex, notasDelArchivo);
        await guardarNota(entryIndex, segmentIndex, texto);
    }

    guardarBtn.addEventListener('click', () => aplicarComentario(campo.value.trim()));
    cancelarBtn.addEventListener('click', cerrarCajaDeComentario);
    campo.addEventListener('keydown', (evento) => {
        // Enter a secas hace párrafo, que en una nota hace falta; se guarda con
        // Ctrl+Enter, como en el resto de cuadros de texto largos.
        if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
            evento.preventDefault();
            aplicarComentario(campo.value.trim());
        }
        if (evento.key === 'Escape') {
            evento.preventDefault();
            cerrarCajaDeComentario();
        }
    });
}

function setTranslationEditableState(entryIndex, segmentIndex, isEditable) {
    const msgstrTextarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    const validateButton = document.getElementById(`validateBtn-${entryIndex}-${segmentIndex}`);
    const translationUnit = document.getElementById(`translation-unit-${entryIndex}`); // Get the parent unit

    if (!msgstrTextarea || !validateButton || !translationUnit) {
        console.error(`Elements not found for index ${entryIndex}-${segmentIndex}`);
        return;
    }

    msgstrTextarea.readOnly = !isEditable;
    if (!isEditable) {
        msgstrTextarea.classList.add('segmento-texto-bloqueado');
        translationUnit.classList.remove('translation-unit-active'); // Remove active highlight on validate
        desmarcarFila(entryIndex, segmentIndex);

        // Update translation status and words when segment is validated
        const segment = state.poEntries[entryIndex].sentenceSegments[segmentIndex];
        // Lo escrito tarda unas décimas en llegar a los datos, para no hacer
        // cuentas con cada letra. Validar es de las cosas que se hacen justo
        // después de escribir, así que aquí se cierra ese hueco a mano: si no,
        // lo último tecleado no entraba en la memoria y nadie entendía por qué
        // ese segmento no aparecía luego como coincidencia.
        segment.translation = msgstrTextarea.value;
        segment.isTranslated = msgstrTextarea.value.trim() !== '';
        // Validar a mano es lo que convierte un borrador de la IA en una
        // traducción: a partir de ahí es tuya y deja de estar marcada.
        if (segment.borradorIA) {
            delete segment.borradorIA;
            document
                .getElementById(`translation-unit-${entryIndex}`)
                ?.querySelectorAll('.borrador-ia')
                .forEach((fila) => fila.classList.remove('borrador-ia'));
            document
                .getElementById(`translation-unit-${entryIndex}`)
                ?.querySelectorAll('.segmento-borrador')
                .forEach((marca) => marca.remove());
        }
        segment.wordCountTranslation = countWords(msgstrTextarea.value);
        updateStatsDisplay(); // Update stats
        addOrUpdateTMEntry(segment.original, segment.translation); // Add/Update TM
    } else {
        msgstrTextarea.classList.remove('segmento-texto-bloqueado');
        translationUnit.classList.add('translation-unit-active'); // Add active highlight on edit/focus
        marcarFilaActiva(entryIndex, segmentIndex);
    }

    // El visto se enciende al validar y se apaga al volver a editar; es el mismo
    // botón, así que también cambia lo que dice al pasar el ratón.
    validateButton.classList.toggle('validado', !isEditable);
    validateButton.setAttribute('aria-pressed', String(!isEditable));
    validateButton.title =
        translations[state.currentLanguage][isEditable ? 'validate' : 'edit'] || '';

    if (isEditable) {
        msgstrTextarea.focus();
        // Ensure cursor is at the end of the text
        msgstrTextarea.setSelectionRange(msgstrTextarea.value.length, msgstrTextarea.value.length);
    }
}

function performAutoPropagation(
    originalText,
    translationText,
    sourceEntryIndex,
    sourceSegmentIndex,
) {
    // Si la casilla no está marcada o el texto está vacío, no hacemos nada
    const checkbox = document.getElementById('autoPropagateCheckbox');
    if (!checkbox || !checkbox.checked || !translationText) return;

    let propagatedCount = 0;
    let snapshotTaken = false;

    state.poEntries.forEach((entry, eIdx) => {
        if (entry.isHeader) return;

        entry.sentenceSegments.forEach((segment, sIdx) => {
            // 1. No nos sobrescribimos a nosotros mismos
            if (eIdx === sourceEntryIndex && sIdx === sourceSegmentIndex) return;

            // 2. Verificamos si el original es idéntico
            if (segment.original === originalText) {
                // Guardar en el historial de Deshacer una sola vez antes de alterar segmentos
                if (!snapshotTaken) {
                    pushToUndoStack();
                    snapshotTaken = true;
                }

                // 3. Actualizamos los datos
                segment.translation = translationText;
                segment.wordCountTranslation = countWords(translationText);
                segment.isTranslated = true;
                propagatedCount++;

                // 4. Actualizamos lo visual (el textarea) si está renderizado en pantalla
                const textarea = document.getElementById(`msgstr-${eIdx}-${sIdx}`);
                if (textarea) {
                    textarea.value = translationText;
                    // Disparamos input para que se recalculen alturas y contadores de ese textarea
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));

                    // Efecto visual para saber que ha cambiado (flash amarillo rápido)
                    textarea.classList.add('bg-yellow-100');
                    setTimeout(() => textarea.classList.remove('bg-yellow-100'), 500);
                }
            }
        });
    });

    // Si quieres notificar cuántos se cambiaron, descomenta la siguiente línea:
    // if (propagatedCount > 0) console.log(`Propagated to ${propagatedCount} segments.`);
}

/**
 * Marca en el texto original las palabras que están en el glosario.
 *
 * Se hace en UNA sola pasada, con todos los términos metidos en la misma
 * expresión de búsqueda. Antes se recorría el glosario término a término,
 * reemplazando cada vez sobre el resultado del anterior, y eso tiene un fallo
 * que no se ve venir: a partir del segundo término ya no se busca en el texto,
 * se busca en el marcado que se acababa de escribir. Un glosario con la misma
 * palabra dos veces (dos traducciones posibles) se encontraba a sí mismo dentro
 * del `data-termino="…"` de la marca anterior y dejaba el HTML hecho un lío.
 * Con una sola pasada eso no puede pasar: lo que ya se ha marcado no se vuelve
 * a mirar.
 *
 * El texto llega ya escapado, así que los términos se escapan igual antes de
 * buscarlos. De paso, un término con "&" o "<" dentro (AT&T) ahora sí se
 * encuentra: antes se buscaba "AT&T" en un texto donde ponía "AT&amp;T".
 *
 * @param {string} text Trozo de texto original, ya escapado como HTML.
 * @returns {{html: string, foundTerms: Set<string>}}
 */
function applyGlossaryHighlightToText(text) {
    const currentFoundTerms = new Set();

    // Sin saber de qué idioma se traduce no hay nada que resaltar.
    if (!state.sourceLang) return { html: text, foundTerms: currentFoundTerms };

    // De más largo a más corto: así "file name" gana a "file" y se marca la
    // expresión entera, que es la que está en el glosario.
    const terminos = state.glossary
        .map((entrada) => entrada.srcTerm)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (terminos.length === 0) return { html: text, foundTerms: currentFoundTerms };

    // Con qué texto escapado se corresponde cada término del glosario.
    const porTextoBuscado = new Map();
    const alternativas = [];
    for (const termino of terminos) {
        const buscado = escaparHtml(termino);
        if (porTextoBuscado.has(buscado.toLowerCase())) continue;
        porTextoBuscado.set(buscado.toLowerCase(), termino);
        alternativas.push(buscado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }

    const busca = new RegExp(`\\b(${alternativas.join('|')})\\b`, 'gi');
    const html = text.replace(busca, (encontrado) => {
        const termino = porTextoBuscado.get(encontrado.toLowerCase());
        if (!termino) return encontrado;
        currentFoundTerms.add(termino);
        // El término del glosario viaja en el propio resaltado: al pasar el
        // ratón por encima hay que poder ir de esta palabra del texto a su
        // ficha, y lo que se ve escrito puede no coincidir (mayúsculas, o una
        // forma distinta).
        return `<span class="glossary-highlight" data-termino="${escaparHtml(termino)}" tabindex="0">${encontrado}</span>`;
    });

    return { html, foundTerms: currentFoundTerms };
}

function updateGlossaryTableHighlights() {
    renderGlossary(); // Re-render glossary, which applies highlights based on termsFoundInActiveSegment
}

function renderTranslations(entries) {
    translationsContainer.innerHTML = '';
    state.termsFoundInActiveSegment.clear(); // Clear terms when re-rendering all translations
    state.lastFocusedSegment = null; // Reset AI context memory

    if (entries.length === 0) {
        translationsContainer.innerHTML = marcadoZonaSoltar();
        updateSaveButtonsState();
        poSearchContainer.classList.add('hidden'); // Hide search bar
        statsContainer.classList.remove('show'); // Hide stats if no translations
        updateUtilityButtonStates();
        updateSaveButtonsState(); // Sincronizar menú File
        return;
    }

    poSearchContainer.classList.remove('hidden'); // Show search bar

    // Numeración corrida de las filas, como en cualquier herramienta TAO: cuenta
    // filas visibles, no entradas del archivo, porque una entrada larga se parte
    // en varias frases y cada una es una fila.
    let numeroDeSegmento = 1;

    entries.forEach((entry, entryIndex) => {
        // Skip rendering header entry explicitly in the main editor area, but keep in poEntries
        if (entry.isHeader) {
            return;
        }

        const translationUnit = document.createElement('div');
        translationUnit.id = `translation-unit-${entryIndex}`; // Added ID for highlighting
        translationUnit.className = 'segmento-grupo';

        // El contexto y las referencias del archivo van arriba, en una etiqueta
        // pequeña con una raya que cruza el ancho: ocupa una línea en lugar de
        // los dos bloques con título que había antes, y así el segmento (que es
        // a lo que se viene) empieza mucho más arriba.
        const cabeceraContexto = crearCabeceraContexto(entry);
        if (cabeceraContexto) translationUnit.appendChild(cabeceraContexto);

        // Las notas del programador van al icono de comentario del pie de la
        // traducción. Son de la entrada entera, así que las formas de plural de
        // una misma cadena comparten nota.
        const { notas } = repartirComentarios(entry.comments);

        entry.sentenceSegments.forEach((segment, segmentIndex) => {
            // Una fila por segmento, toda de una pieza: número, original,
            // traducción y validación. El recuento de cada texto va dentro de su
            // propia columna, abajo a la derecha, y el visto de validar en una
            // columna estrecha al final de la fila.
            const segmentRow = document.createElement('div');
            segmentRow.className = 'segmento-fila';
            // Lo que ha traducido la IA y nadie ha revisado se marca: un archivo
            // donde no se distingue lo repasado de lo automático es un archivo
            // en el que no se puede confiar.
            if (segment.borradorIA) segmentRow.classList.add('borrador-ia');

            const numeroCol = document.createElement('div');
            numeroCol.className = 'segmento-numero';

            if (segment.borradorIA) {
                const marca = document.createElement('span');
                marca.className = 'segmento-borrador';
                marca.textContent = '✦';
                marca.title = translations[state.currentLanguage]['ai_borrador'] || 'AI draft';
                numeroCol.appendChild(marca);
            }
            numeroCol.textContent = numeroDeSegmento;
            numeroDeSegmento += 1;

            // Formas de plural: cada una es su propia fila, así que hay que
            // decir cuál es. Se usa la notación del propio archivo ([0], [1])
            // porque es la que aparece en el PO y no se presta a confusión.
            if (segment.formaPlural !== undefined) {
                const marcaPlural = document.createElement('span');
                marcaPlural.className = 'segmento-plural';
                marcaPlural.textContent = `[${segment.formaPlural}]`;
                marcaPlural.title = `${
                    translations[state.currentLanguage]['plural_form'] || 'Plural form'
                } ${segment.formaPlural}`;
                numeroCol.appendChild(marcaPlural);
            }

            segmentRow.appendChild(numeroCol);

            const cuerpo = document.createElement('div');
            cuerpo.className = 'segmento-cuerpo';

            const originalCol = document.createElement('div');
            originalCol.className = 'segmento-col segmento-origen';

            const msgidPre = document.createElement('pre');
            msgidPre.id = `msgid-pre-${entryIndex}-${segmentIndex}`; // Added ID for easier lookup
            msgidPre.className = 'segmento-texto';
            // Con las etiquetas ya en color: son lo primero que hay que ver del
            // original, porque son lo que hay que copiar tal cual.
            msgidPre.innerHTML = marcadoDelOriginal(segment.original).html;
            originalCol.appendChild(msgidPre);

            const pieOrigen = document.createElement('div');
            pieOrigen.className = 'segmento-pie';
            const cuentaOrigen = document.createElement('span');
            cuentaOrigen.id = `charCountOriginal-${entryIndex}-${segmentIndex}`;
            cuentaOrigen.className = 'segmento-cuenta';
            cuentaOrigen.textContent = String(segment.original.length);
            cuentaOrigen.title = tituloCuentaOriginal();
            pieOrigen.appendChild(cuentaOrigen);
            originalCol.appendChild(pieOrigen);

            cuerpo.appendChild(originalCol);

            const translationCol = document.createElement('div');
            translationCol.className = 'segmento-col segmento-destino';

            // La etiqueta amarilla del glosario (oculta por defecto)
            const glossaryBadge = document.createElement('span');
            glossaryBadge.id = `glossary-match-${entryIndex}-${segmentIndex}`;
            glossaryBadge.className = 'hidden segmento-glosario';
            translationCol.appendChild(glossaryBadge);

            // El cuadro de traducción va sobre una capa que dibuja los recuadros
            // amarillos de las etiquetas: un textarea no admite color por dentro,
            // así que el color lo pone la capa de abajo y las letras el textarea
            // de encima. Ver etiquetas-campo.js.
            const campo = document.createElement('div');
            campo.className = 'campo-con-capa';

            const capa = document.createElement('div');
            capa.className = 'capa-etiquetas segmento-texto';
            capa.setAttribute('aria-hidden', 'true');
            capa.innerHTML = marcadoDeCapa(segment.translation, perfilActual());
            campo.appendChild(capa);

            const msgstrTextarea = document.createElement('textarea');
            msgstrTextarea.id = `msgstr-${entryIndex}-${segmentIndex}`;
            msgstrTextarea.className = 'msgstr-textarea segmento-texto';
            msgstrTextarea.value = segment.translation;
            msgstrTextarea.dataset.entryIndex = entryIndex;
            msgstrTextarea.dataset.segmentIndex = segmentIndex;
            msgstrTextarea.dataset.originalLength = segment.original.length;
            // rows=1 para que el alto de partida sea una línea y no dos: el alto
            // de verdad lo pone ajustarAltoDeLosCuadros() según lo que haya escrito.
            msgstrTextarea.rows = 1;
            campo.appendChild(msgstrTextarea);

            translationCol.appendChild(campo);

            const pieDestino = document.createElement('div');
            pieDestino.className = 'segmento-pie';

            // Icono de comentario. Siempre está en su sitio, para que el pie no
            // baile de una fila a otra: apagado cuando no hay nada, encendido
            // cuando hay una nota del archivo o una escrita aquí.
            const comentarioButton = document.createElement('button');
            comentarioButton.id = `comentarioBtn-${entryIndex}-${segmentIndex}`;
            comentarioButton.className = 'segmento-icono segmento-comentario';
            comentarioButton.type = 'button';
            comentarioButton.dataset.entryIndex = entryIndex;
            comentarioButton.dataset.segmentIndex = segmentIndex;
            comentarioButton.innerHTML = commentIconSVG;
            actualizarIconoDeComentario(entryIndex, segmentIndex, notas, comentarioButton);
            comentarioButton.addEventListener('click', () =>
                abrirComentario(entryIndex, segmentIndex, notas),
            );
            pieDestino.appendChild(comentarioButton);

            const copyOriginalButton = document.createElement('button');
            copyOriginalButton.id = `copyOriginalBtn-${entryIndex}-${segmentIndex}`;
            copyOriginalButton.className = 'copy-original-button segmento-icono';
            copyOriginalButton.dataset.entryIndex = entryIndex;
            copyOriginalButton.dataset.segmentIndex = segmentIndex;
            copyOriginalButton.setAttribute(
                'title',
                translations[state.currentLanguage]['copy_original_btn'] || 'Copy Original',
            );
            copyOriginalButton.innerHTML = copyIconSVG;
            pieDestino.appendChild(copyOriginalButton);

            const charCountSpan = document.createElement('span');
            charCountSpan.id = `charCount-${entryIndex}-${segmentIndex}`;
            charCountSpan.className = 'segmento-cuenta';
            charCountSpan.title = tituloCuentaTraduccion();
            pieDestino.appendChild(charCountSpan);

            translationCol.appendChild(pieDestino);
            cuerpo.appendChild(translationCol);
            segmentRow.appendChild(cuerpo);

            // Columna de validación: un solo botón que enciende y apaga. Antes
            // eran dos ("Validar" y "Editar") que se turnaban el sitio.
            const estadoCol = document.createElement('div');
            estadoCol.className = 'segmento-estado';

            // Aviso de etiquetas: encima del visto, oculto mientras todo cuadre.
            const avisoEtiquetas = document.createElement('span');
            avisoEtiquetas.id = `avisoEtiquetas-${entryIndex}-${segmentIndex}`;
            avisoEtiquetas.className = 'segmento-aviso';
            avisoEtiquetas.textContent = '!';
            avisoEtiquetas.hidden = true;
            estadoCol.appendChild(avisoEtiquetas);

            const validateButton = document.createElement('button');
            validateButton.id = `validateBtn-${entryIndex}-${segmentIndex}`;
            validateButton.className = 'validate-button segmento-check';
            validateButton.dataset.entryIndex = entryIndex;
            validateButton.dataset.segmentIndex = segmentIndex;
            validateButton.setAttribute('aria-pressed', 'false');
            validateButton.title = translations[state.currentLanguage]['validate'];

            const checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkIcon.setAttribute('id', `checkIcon-${entryIndex}-${segmentIndex}`);
            checkIcon.setAttribute('class', 'check-icon');
            checkIcon.setAttribute('fill', 'none');
            checkIcon.setAttribute('viewBox', '0 0 24 24');
            checkIcon.setAttribute('stroke', 'currentColor');
            checkIcon.innerHTML =
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 12.5l5.5 5.5L20 7" />';
            validateButton.appendChild(checkIcon);

            estadoCol.appendChild(validateButton);
            segmentRow.appendChild(estadoCol);
            translationUnit.appendChild(segmentRow);

            // --- START: UPDATED EVENT LISTENER FOR COPY BUTTON ---
            copyOriginalButton.addEventListener('click', (event) => {
                // Use currentTarget to ensure we get the button, even if SVG is clicked
                const btn = event.currentTarget;
                const currentEntryIndex = parseInt(btn.dataset.entryIndex);
                const currentSegmentIndex = parseInt(btn.dataset.segmentIndex);
                const originalText =
                    state.poEntries[currentEntryIndex]?.sentenceSegments[currentSegmentIndex]
                        ?.original;
                const targetTextarea = document.getElementById(
                    `msgstr-${currentEntryIndex}-${currentSegmentIndex}`,
                );

                if (originalText !== undefined && targetTextarea && !targetTextarea.readOnly) {
                    pushToUndoStack();
                    // Paste original text into the translation textarea
                    targetTextarea.value = originalText;

                    // Trigger input event to update counts, stats, etc.
                    const inputEvent = new Event('input', { bubbles: true });
                    targetTextarea.dispatchEvent(inputEvent);

                    // Optional: Briefly focus the textarea
                    targetTextarea.focus();
                    // Optional: Move cursor to the end
                    targetTextarea.setSelectionRange(
                        targetTextarea.value.length,
                        targetTextarea.value.length,
                    );
                } else if (targetTextarea && targetTextarea.readOnly) {
                    // Optional: Inform user if textarea is read-only
                    showMessage(
                        translations[state.currentLanguage]['edit_first_message'] ||
                            'Click Edit first',
                    ); // Need a new translation string
                }
            });
            // --- END: UPDATED EVENT LISTENER ---

            // Variable para el temporizador (Debounce)
            let inputDebounceTimer;

            msgstrTextarea.addEventListener('input', (event) => {
                // --- A. ACCIONES VISUALES INMEDIATAS (Lo que el ojo ve) ---
                // Usamos la variable 'msgidPre' que ya existe en el ámbito,
                // en lugar de buscarla en el DOM con querySelector (más lento).
                autoResizeTextarea(event.target, msgidPre);

                const charCountSpan = document.getElementById(
                    `charCount-${entryIndex}-${segmentIndex}`,
                );
                updateCharCount(event.target, charCountSpan);
                // El aviso de etiquetas se actualiza al momento: enterarse tarde
                // de que falta un %s es enterarse cuando ya has seguido a otra
                // frase y hay que volver.
                revisarEtiquetas(entryIndex, segmentIndex);

                // --- B. LÓGICA PESADA (Retardada 300ms) ---
                // Si el usuario sigue escribiendo, cancelamos el cálculo anterior
                clearTimeout(inputDebounceTimer);

                inputDebounceTimer = setTimeout(() => {
                    const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                    const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                    const segment =
                        state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex];

                    // 1. Guardar estado ANTERIOR
                    const oldWordCount = segment.wordCountTranslation;
                    const wasTranslated = segment.isTranslated;

                    // 2. Actualizar modelo con NUEVOS datos
                    const newText = event.target.value;
                    segment.translation = newText;
                    segment.wordCountTranslation = countWords(newText);
                    segment.isTranslated = newText.trim() !== '';

                    // 3. Cálculo Diferencial (Optimizado)
                    if (wasTranslated !== segment.isTranslated) {
                        updateStatsDisplay();
                    } else {
                        const diffWords = segment.wordCountTranslation - oldWordCount;
                        if (diffWords !== 0) {
                            const currentTotal = parseInt(wordsTranslated.textContent) || 0;
                            wordsTranslated.textContent = currentTotal + diffWords;
                        }
                        updateSaveButtonsState();
                    }
                }, 300); // Espera 300ms después de la última pulsación
            });

            msgstrTextarea.addEventListener('focus', (event) => {
                document.querySelectorAll('.translation-unit-active').forEach((unit) => {
                    unit.classList.remove('translation-unit-active');
                });
                state.lastFocusedSegment = { entryIndex, segmentIndex }; // Remember this segment for AI
                translationUnit.classList.add('translation-unit-active');
                marcarFilaActiva(entryIndex, segmentIndex);

                state.termsFoundInActiveSegment.clear();
                const originalSegmentPre = document.getElementById(
                    `msgid-pre-${entryIndex}-${segmentIndex}`,
                );
                if (
                    originalSegmentPre &&
                    state.sourceLang &&
                    state.glossary.length > 0
                ) {
                    // Se repinta entero: las etiquetas van en el mismo elemento
                    // y se perderían si aquí solo se pusiera el glosario.
                    const marcado = marcadoDelOriginal(segment.original, { glosario: true });
                    originalSegmentPre.innerHTML = marcado.html;
                    marcado.terminos.forEach((term) => state.termsFoundInActiveSegment.add(term));
                }

                // --- NUEVO: Mostrar etiqueta de glosario ---
                const glossaryMatchContainer = document.getElementById(
                    `glossary-match-${entryIndex}-${segmentIndex}`,
                );
                if (glossaryMatchContainer) {
                    glossaryMatchContainer.innerHTML = '';
                    glossaryMatchContainer.title = '';
                    glossaryMatchContainer.classList.add('hidden');

                    if (state.termsFoundInActiveSegment.size > 0) {
                        let hintText = '';
                        let fullHintText = '';

                        state.termsFoundInActiveSegment.forEach((foundTerm) => {
                            const glossaryEntry = state.glossary.find(
                                (g) => g.srcTerm === foundTerm,
                            );
                            if (glossaryEntry) {
                                const part = `${glossaryEntry.srcTerm} -> ${glossaryEntry.tgtTerm}`;
                                hintText += part + ' | ';
                                fullHintText += part + ' | ';
                            }
                        });

                        if (hintText) {
                            glossaryMatchContainer.innerHTML = `
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                        <span>${hintText.slice(0, -3)}</span>
                                    `;
                            glossaryMatchContainer.title = `Glosario: ${fullHintText.slice(0, -3)}`;
                            glossaryMatchContainer.classList.remove('hidden');
                        }
                    }
                }
                // --- FIN NUEVO BLOQUE ---

                updateGlossaryTableHighlights();
                autoResizeTextarea(event.target, originalCol.querySelector('pre'));
                event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const currentSegmentOriginal =
                    state.poEntries[entryIndex].sentenceSegments[segmentIndex].original;
                state.tmBestMatchForActiveSegment = findBestTMMatch(currentSegmentOriginal);
                tmSearch();
            });

            msgstrTextarea.addEventListener('blur', (event) => {
                // 1. Disparar Autopropagación al salir del campo
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                const segmentData =
                    state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex];

                // Llamamos a la función que creamos en el Paso 2
                performAutoPropagation(
                    segmentData.original,
                    event.target.value,
                    currentEntryIndex,
                    currentSegmentIndex,
                );
                // --- NUEVO: Ocultar etiqueta ---
                const glossaryMatchContainer = document.getElementById(
                    `glossary-match-${entryIndex}-${segmentIndex}`,
                );
                if (glossaryMatchContainer) {
                    glossaryMatchContainer.classList.add('hidden');
                    glossaryMatchContainer.innerHTML = '';
                }
                // --- FIN NUEVO BLOQUE ---

                const originalSegmentPre = document.getElementById(
                    `msgid-pre-${entryIndex}-${segmentIndex}`,
                );
                if (originalSegmentPre) {
                    // El glosario se queda: está en todo el archivo, se esté o
                    // no escribiendo en este segmento. Lo que se apaga al salir
                    // es la lista de términos de ESTE segmento, que es lo que
                    // ordena el panel y lo que ve el asistente.
                    originalSegmentPre.innerHTML = marcadoDelOriginal(segment.original).html;
                }
                state.termsFoundInActiveSegment.clear();
                // Repintar la lista del glosario la reconstruye entera. Si el
                // foco se está yendo justo a un botón de esa lista —el de
                // borrar un término, sin ir más lejos—, el botón desaparece
                // entre el mousedown y el mouseup y el navegador no llega a
                // emitir el clic: se pulsa y no pasa nada. Con los paneles
                // siempre a la vista eso es un clic perdido de cada dos.
                //
                // El repintado no urge: lo único que hace es apagar el
                // resaltado del segmento que se acaba de dejar, y se vuelve a
                // hacer en cuanto se entra en otro.
                if (!event.relatedTarget?.closest('#panelesDerecha')) {
                    updateGlossaryTableHighlights();
                }
                state.tmBestMatchForActiveSegment = null;
                tmSearch();
            });

            msgstrTextarea.addEventListener('click', (event) => {
                const currentEntryIndex = parseInt(event.target.dataset.entryIndex);
                const currentSegmentIndex = parseInt(event.target.dataset.segmentIndex);
                if (event.target.readOnly) {
                    setTranslationEditableState(currentEntryIndex, currentSegmentIndex, true);
                }
            });

            validateButton.addEventListener('click', (event) => {
                // currentTarget y no target: dentro del botón está el SVG del
                // visto, y pulsando encima el evento nace ahí.
                const boton = event.currentTarget;
                const currentEntryIndex = parseInt(boton.dataset.entryIndex);
                const currentSegmentIndex = parseInt(boton.dataset.segmentIndex);

                // El mismo botón valida y desvalida: si ya estaba validado,
                // vuelve a dejar el segmento editable.
                if (boton.classList.contains('validado')) {
                    setTranslationEditableState(currentEntryIndex, currentSegmentIndex, true);
                    return;
                }

                // Disparar Autopropagación al validar
                const txtArea = document.getElementById(
                    `msgstr-${currentEntryIndex}-${currentSegmentIndex}`,
                );
                const segOriginal =
                    state.poEntries[currentEntryIndex].sentenceSegments[currentSegmentIndex]
                        .original;
                performAutoPropagation(
                    segOriginal,
                    txtArea.value,
                    currentEntryIndex,
                    currentSegmentIndex,
                );
                setTranslationEditableState(currentEntryIndex, currentSegmentIndex, false);
                goToNextTranslation(currentEntryIndex, currentSegmentIndex);
            });

            updateCharCount(msgstrTextarea, charCountSpan);
            revisarEtiquetas(entryIndex, segmentIndex);
        });

        if (entry.fuzzy) {
            const fuzzyIndicator = document.createElement('span');
            fuzzyIndicator.className = 'segmento-fuzzy';
            fuzzyIndicator.textContent = translations[state.currentLanguage]['fuzzy'];
            translationUnit.appendChild(fuzzyIndicator);
        }

        translationsContainer.appendChild(translationUnit);
    });

    // Los cuadros de traducción se ajustan al alto de su texto ahora, cuando ya
    // están en la página: medidos antes, mientras se construían aparte, el
    // navegador devuelve cero y todos salían de una línea.
    ajustarAltoDeLosCuadros();
    updateSaveButtonsState();
    statsContainer.classList.add('show');
    updateStatsDisplay();
    updateUtilityButtonStates();
    updateSaveButtonsState(); // Sincronizar menú File

    const firstEditableSegment = getFirstEditableSegment();
    if (firstEditableSegment) {
        navigateToTranslation(firstEditableSegment.entryIndex, firstEditableSegment.segmentIndex);
    }
}

function filterPOEntries() {
    const query = poSearchInput.value.trim();
    const searchInOriginal = searchInOriginalCheckbox.checked;
    const searchInTranslation = searchInTranslationCheckbox.checked;

    // Se limpia lo resaltado antes. Antes se hacía sustituyendo el contenido del
    // elemento por su texto plano, lo que de paso se llevaba por delante el color
    // de las etiquetas; ahora se vuelve a dibujar el original entero, que es
    // barato y deja cada cosa en su sitio.
    state.searchResults = [];
    state.currentSearchIndex = -1;
    repintarTodosLosOriginales();

    if (!query) {
        state.poEntries.forEach((entry, index) => {
            const unit = document.getElementById(`translation-unit-${index}`);
            if (unit) unit.style.display = 'block';
        });
        updateSearchCounter();
        return;
    }

    const queryRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    state.poEntries.forEach((entry, index) => {
        if (entry.isHeader) return;

        const unit = document.getElementById(`translation-unit-${index}`);
        if (!unit) return;

        let matchFound = false;
        const fullMsgstr = entry.sentenceSegments.map((s) => s.translation).join(' ');

        // Highlight in original
        if (searchInOriginal) {
            entry.sentenceSegments.forEach((segmento, sIdx) => {
                queryRegex.lastIndex = 0;
                if (!queryRegex.test(segmento.original)) return;

                matchFound = true;
                const pre = document.getElementById(`msgid-pre-${index}-${sIdx}`);
                if (pre) {
                    pre.innerHTML = marcadoDelOriginal(segmento.original, {
                        busqueda: queryRegex,
                    }).html;
                }
            });
        }

        // Check for match in translation (without highlighting the textarea)
        if (searchInTranslation && fullMsgstr.match(queryRegex)) {
            matchFound = true;
        }

        unit.style.display = matchFound ? 'block' : 'none';
    });

    // Populate searchResults array with all new highlights
    state.searchResults = document.querySelectorAll('.search-highlight');
    updateSearchCounter();
}

function getCurrentFocusedIndex() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('msgstr-textarea')) {
        return {
            entryIndex: parseInt(activeElement.dataset.entryIndex),
            segmentIndex: parseInt(activeElement.dataset.segmentIndex),
        };
    }
    return null;
}

function getFirstEditableSegment() {
    for (let i = 0; i < state.poEntries.length; i++) {
        const entry = state.poEntries[i];
        if (!entry.isHeader && entry.sentenceSegments && entry.sentenceSegments.length > 0) {
            return { entryIndex: i, segmentIndex: 0 };
        }
    }
    return null;
}

function navigateToTranslation(entryIndex, segmentIndex) {
    const targetTextarea = document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`);
    if (targetTextarea) {
        const currentlyFocusedTextarea = document.activeElement;
        if (
            currentlyFocusedTextarea &&
            currentlyFocusedTextarea.classList.contains('msgstr-textarea') &&
            currentlyFocusedTextarea !== targetTextarea
        ) {
            currentlyFocusedTextarea.blur();
        }
        setTranslationEditableState(entryIndex, segmentIndex, true);
        targetTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function goToNextTranslation(currentEntryIndex, currentSegmentIndex) {
    if (state.poEntries.length === 0) return;

    let nextEntryIndex = currentEntryIndex;
    let nextSegmentIndex = currentSegmentIndex + 1;

    while (true) {
        if (nextEntryIndex >= state.poEntries.length) {
            showMessage(translations[state.currentLanguage]['reached_last']);
            return;
        }

        const currentEntry = state.poEntries[nextEntryIndex];
        if (
            currentEntry.isHeader ||
            !currentEntry.sentenceSegments ||
            currentEntry.sentenceSegments.length === 0
        ) {
            nextEntryIndex++;
            nextSegmentIndex = 0;
            continue;
        }

        if (nextSegmentIndex < currentEntry.sentenceSegments.length) {
            navigateToTranslation(nextEntryIndex, nextSegmentIndex);
            return;
        } else {
            nextEntryIndex++;
            nextSegmentIndex = 0;
        }
    }
}

function goToPreviousTranslation(currentEntryIndex, currentSegmentIndex) {
    if (state.poEntries.length === 0) return;

    let prevEntryIndex = currentEntryIndex;
    let prevSegmentIndex = currentSegmentIndex - 1;

    while (true) {
        if (prevEntryIndex < 0) {
            showMessage(translations[state.currentLanguage]['reached_first']);
            return;
        }

        const currentEntry = state.poEntries[prevEntryIndex];
        if (
            currentEntry.isHeader ||
            !currentEntry.sentenceSegments ||
            currentEntry.sentenceSegments.length === 0
        ) {
            prevEntryIndex--;
            prevSegmentIndex =
                prevEntryIndex >= 0 && state.poEntries[prevEntryIndex].sentenceSegments
                    ? state.poEntries[prevEntryIndex].sentenceSegments.length - 1
                    : 0;
            continue;
        }

        if (prevSegmentIndex >= 0) {
            navigateToTranslation(prevEntryIndex, prevSegmentIndex);
            return;
        } else {
            prevEntryIndex--;
            prevSegmentIndex =
                prevEntryIndex >= 0 && state.poEntries[prevEntryIndex].sentenceSegments
                    ? state.poEntries[prevEntryIndex].sentenceSegments.length - 1
                    : 0;
        }
    }
}

/**
 * Engancha las etiquetas del original para poder insertarlas con un clic.
 *
 * Se usa delegación en el contenedor y no un listener por etiqueta: los
 * segmentos se vuelven a dibujar cada vez que se busca, se cambia de idioma o se
 * abre otro archivo, y unos listeners puestos uno a uno se perderían en cada
 * redibujado (o peor, se acumularían).
 */
function initEtiquetas() {
    if (!translationsContainer) return;

    // El color y la indivisibilidad dentro del cuadro de traducción. Se le pasa
    // la función y no el perfil porque el formato cambia con el archivo abierto.
    initEtiquetasEnTraduccion(translationsContainer, perfilActual);

    const insertarDesde = (marca) => {
        const fila = marca.closest('.segmento-fila');
        const textarea = fila ? fila.querySelector('textarea.msgstr-textarea') : null;
        if (textarea) insertarEtiqueta(textarea, marca.dataset.etiqueta);
    };

    // Se escucha 'mousedown' y no 'click', y se corta el comportamiento normal
    // del ratón. Dos motivos, y el segundo no es evidente:
    //
    // 1. Así el cuadro de traducción no pierde el foco al pulsar, y la etiqueta
    //    entra donde estaba el cursor en vez de al final.
    // 2. Al perder el foco, el original se vuelve a dibujar (para quitarle el
    //    resaltado del glosario). Eso destruye la etiqueta que se estaba
    //    pulsando entre el botón abajo y el botón arriba, y entonces el
    //    navegador no llega a generar el 'click': el primer intento se perdía
    //    entero y había que pulsar dos veces.
    translationsContainer.addEventListener('mousedown', (evento) => {
        const marca = evento.target.closest('.etiqueta');
        if (!marca) return;
        evento.preventDefault();
        insertarDesde(marca);
    });

    // Y con el teclado, para quien no usa el ratón al traducir.
    translationsContainer.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        const marca = evento.target.closest('.etiqueta');
        if (!marca) return;
        evento.preventDefault();
        insertarDesde(marca);
    });
}

export {
    filterPOEntries,
    getCurrentFocusedIndex,
    goToNextTranslation,
    goToPreviousTranslation,
    initEtiquetas,
    insertarEnLaTraduccionActiva,
    insertarSiguienteEtiquetaQueFalta,
    navigateToTranslation,
    pushToUndoStack,
    renderTranslations,
    repintarTodosLosOriginales,
    setTranslationEditableState,
};
