/**
 * El asistente de IA: la parte que se ve.
 *
 * Lo de hablar con los servicios, proteger las etiquetas y montar los encargos
 * está en core/ia/, que no sabe nada de pantallas y por eso se puede probar sin
 * gastar una llamada. Aquí solo queda recoger lo que hay en el editor, pintar la
 * conversación y meter la traducción en su sitio.
 *
 * Dos usos distintos, y los dos importan:
 *
 * - **Traducir o mejorar el segmento en el que estás**, con su contexto: el
 *   glosario que aplique, lo que diga la memoria y los segmentos de alrededor.
 * - **Preguntar sin más**: una duda de terminología, documentarse sobre el tema
 *   del archivo, pedir alternativas. Esto funciona con un archivo abierto o sin
 *   él; antes hacía falta estar dentro de un segmento para poder preguntar
 *   nada, que es una limitación que no tenía razón de ser.
 */
import { showMessage } from './dialogs.js';
import { aiChatContainer, aiConfigPanel, aiSidebar, aiUserInput } from './dom.js';
import { getCurrentFocusedIndex, pushToUndoStack } from './editor.js';
import { state } from './state.js';
import { translations } from './translations.js';
import { hayServicioConectado, leerConfiguracion } from './core/ia/ajustes.js';
import { proveedorPorId } from './core/ia/proveedores.js';
import { preguntar, traducirUno } from './core/ia/traducir.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';

/** Lo hablado hasta ahora, para poder repreguntar ("¿y en Latinoamérica?"). */
let conversacion = [];

/** Cuántos turnos de conversación se mandan. Más es pagar por ruido. */
const MEMORIA_DE_LA_CHARLA = 6;

/**
 * La configuración de IA lista para usar, o null si falta algo.
 *
 * @returns {Object|null}
 */
function configuracionUsable() {
    if (!hayServicioConectado({ proveedorPorId })) return null;

    const proveedor = proveedorPorId(leerConfiguracion().proveedor);
    return leerConfiguracion({
        modelo: proveedor.modeloPorDefecto,
        baseUrl: proveedor.urlPorDefecto,
    });
}

/**
 * Recoge lo que rodea al segmento en el que se está: glosario, memoria y
 * vecinos. Es lo que convierte una traducción automática en una traducción con
 * el vocabulario del proyecto.
 *
 * @returns {{segmento: Object|null, contexto: Object, idiomas: Object}}
 */
function loQueHayAlrededor() {
    const foco = getCurrentFocusedIndex() || state.lastFocusedSegment;
    const contexto = { instrucciones: leerConfiguracion().instrucciones };

    const idiomas = {
        origen: state.sourceLang || '',
        destino: state.targetLang || '',
    };

    if (!foco) return { segmento: null, contexto, idiomas };

    const entrada = state.poEntries[foco.entryIndex];
    const trozo = entrada?.sentenceSegments?.[foco.segmentIndex];
    if (!trozo) return { segmento: null, contexto, idiomas };

    // Glosario: solo los términos que salen en este segmento.
    if (state.termsFoundInActiveSegment?.size > 0) {
        contexto.glosario = [...state.termsFoundInActiveSegment]
            .map((termino) => state.glossary.find((g) => g.srcTerm === termino))
            .filter(Boolean)
            .map((g) => ({
                termino: g.srcTerm,
                traduccion: g.tgtTerm,
                // Las notas dicen qué NO hacer, que es la mitad del valor de un
                // glosario; la definición desambigua cuando la palabra tiene
                // varios sentidos.
                nota: [g.notes, g.definition].filter(Boolean).join(' — '),
            }));
    }

    // Memoria: la mejor coincidencia, si la hay.
    if (state.tmBestMatchForActiveSegment) {
        const acierto = state.tmBestMatchForActiveSegment;
        contexto.memoria = [
            {
                original: acierto.srcText,
                traduccion: acierto.tgtText,
                parecido: acierto.score,
            },
        ];
    }

    contexto.vecinos = vecinosDe(foco.entryIndex, foco.segmentIndex);

    return {
        segmento: {
            original: trozo.original,
            traduccion:
                document.getElementById(`msgstr-${foco.entryIndex}-${foco.segmentIndex}`)?.value ||
                '',
            entryIndex: foco.entryIndex,
            segmentIndex: foco.segmentIndex,
        },
        contexto,
        idiomas,
    };
}

/**
 * El segmento de antes y el de después, para que la traducción encaje con lo
 * que la rodea (el tuteo, si viene de una lista, si es la respuesta a algo).
 *
 * @param {number} entryIndex
 * @param {number} segmentIndex
 * @returns {Array<{original: string, traduccion: string}>}
 */
function vecinosDe(entryIndex, segmentIndex) {
    const planos = [];
    state.poEntries.forEach((entrada, i) => {
        if (entrada.isHeader) return;
        (entrada.sentenceSegments || []).forEach((trozo, j) => {
            planos.push({ i, j, original: trozo.original, traduccion: trozo.translation || '' });
        });
    });

    const donde = planos.findIndex((p) => p.i === entryIndex && p.j === segmentIndex);
    if (donde === -1) return [];

    return [planos[donde - 1], planos[donde + 1]]
        .filter(Boolean)
        .map((p) => ({ original: p.original, traduccion: p.traduccion }));
}

/**
 * Escribe un mensaje en la conversación.
 *
 * @param {'user'|'bot'} quien
 * @param {string} texto
 * @param {boolean} [conBotonDeInsertar]
 * @returns {string} El id del mensaje, para poder quitarlo luego.
 */
function appendAiMessage(quien, texto, conBotonDeInsertar = false) {
    if (quien === 'bot') state.lastAiResponseText = texto;

    const div = document.createElement('div');
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    div.id = id;
    div.className = `ai-message ai-message-${quien}`;

    if (quien === 'bot' && typeof marked !== 'undefined') {
        const pintor = new marked.Renderer();
        pintor.link = ({ href }) =>
            `<a href="${href}" target="_blank" title="${href}" class="ai-source-link">${
                t('ai_link_source') || 'Source'
            }</a>`;
        div.innerHTML = marked.parse(texto, { renderer: pintor });
    } else {
        div.textContent = texto;
    }

    if (conBotonDeInsertar && quien === 'bot') {
        const boton = document.createElement('span');
        boton.className = 'ai-insert-btn';
        boton.textContent = t('ai_insert_btn') || '📋 Insertar';
        boton.onclick = () => insertAiResponse(texto);
        div.appendChild(boton);
    }

    aiChatContainer.appendChild(div);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
    return id;
}

/**
 * Mete un texto en el segmento en el que se está.
 *
 * @param {string} texto
 */
function insertAiResponse(texto) {
    const foco = getCurrentFocusedIndex() || state.lastFocusedSegment;
    if (!foco) {
        showMessage(t('ai_no_segment'));
        return;
    }

    const campo = document.getElementById(`msgstr-${foco.entryIndex}-${foco.segmentIndex}`);
    if (!campo || campo.readOnly) {
        showMessage(t('ai_no_segment'));
        return;
    }

    pushToUndoStack();
    campo.value = String(texto || '')
        .replace(/```/g, '')
        .trim();
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
    showMessage(t('ai_inserted'));
}

/**
 * Deja el panel del asistente listo para lo que toque.
 *
 * Sin servicio elegido ni clave, el asistente no puede hacer nada: lo primero
 * que hay que ver al abrirlo es dónde se configura, no un saludo que invita a
 * escribir en un cuadro que va a contestar con un error. Así que si falta algo,
 * se abre directamente el panel de ajustes y el saludo dice qué hacer.
 *
 * @returns {boolean} true si falta configurar algo (y se ha abierto el panel).
 */
function prepararPanelDeIA() {
    const config = configuracionUsable();

    if (aiChatContainer && aiChatContainer.children.length === 0) {
        const clave = config ? 'ai_initial_message' : 'ai_initial_sin_configurar';
        const saludo = document.getElementById(appendAiMessage('bot', t(clave)));
        // El saludo se escribe una vez, al arrancar, y se queda ahí. Al cambiar
        // de idioma, todo lo demás se repinta y él no: la interfaz entera en
        // español con PandaBot saludando en inglés. Se anota de qué texto salió
        // para poder rehacerlo (ver retraducirSaludoDeIA).
        if (saludo) saludo.dataset.i18nSaludo = clave;
    }

    if (!config) aiConfigPanel?.classList.remove('hidden');

    return !config;
}

/**
 * Vuelve a escribir el saludo del asistente en el idioma que esté puesto.
 *
 * Solo el saludo: lo que se haya hablado con el modelo se queda como está.
 * Retraducir una conversación sería inventarse lo que dijo el otro.
 */
function retraducirSaludoDeIA() {
    const saludo = aiChatContainer?.querySelector('[data-i18n-saludo]');
    if (!saludo) return;

    const clave = saludo.dataset.i18nSaludo;
    // Si ya se ha hablado con el modelo, el saludo no es lo último que se ve y
    // cambiarlo por debajo sería raro; se cambia igual porque sigue siendo un
    // texto de la interfaz, no algo que haya dicho nadie.
    saludo.textContent = t(clave);
    state.lastAiResponseText = t(clave);
}

/**
 * Avisa de que falta configurar la IA y abre el panel de ajustes.
 */
function pedirConfiguracion() {
    appendAiMessage('bot', t('ai_falta_configurar'));
    aiConfigPanel?.classList.remove('hidden');
}

/**
 * Manda lo que se haya escrito en el cuadro.
 */
async function handleAiSend() {
    const texto = aiUserInput.value.trim();
    if (!texto) return;

    aiUserInput.value = '';
    appendAiMessage('user', texto);
    await responder(texto);
}

/**
 * Contesta una consulta con el contexto que haya.
 *
 * @param {string} pregunta
 */
async function responder(pregunta) {
    const config = configuracionUsable();
    if (!config) return pedirConfiguracion();

    const { segmento, contexto } = loQueHayAlrededor();
    const pensando = appendAiMessage('bot', t('ai_thinking'));

    try {
        const respuesta = await preguntar({
            pregunta,
            config,
            conversacion: conversacion.slice(-MEMORIA_DE_LA_CHARLA),
            segmento,
            contexto,
        });

        document.getElementById(pensando)?.remove();
        appendAiMessage('bot', respuesta, Boolean(segmento));

        conversacion.push({ papel: 'persona', texto: pregunta });
        conversacion.push({ papel: 'ia', texto: respuesta });
    } catch (error) {
        document.getElementById(pensando)?.remove();
        appendAiMessage('bot', `❌ ${error.message}`);
        if (error.codigo === 'clave') aiConfigPanel?.classList.remove('hidden');
    }
}

/**
 * Traduce el segmento en el que se está y ofrece el resultado.
 *
 * Va por su propio camino y no por el de la conversación porque aquí sí se
 * protegen las etiquetas y se comprueba la respuesta: una sugerencia que se
 * carga un %s no se ofrece.
 */
async function sugerirTraduccion() {
    const config = configuracionUsable();
    if (!config) return pedirConfiguracion();

    const { segmento, contexto, idiomas } = loQueHayAlrededor();
    if (!segmento) {
        appendAiMessage('bot', t('ai_no_segment'));
        return;
    }

    abrirPanel();
    appendAiMessage('user', `⚡ ${t('ai_prompt_translate')}`);
    const pensando = appendAiMessage('bot', t('ai_thinking'));

    try {
        const resultado = await traducirUno({
            original: segmento.original,
            config,
            formato: state.currentFileType,
            idiomaOrigen: idiomas.origen,
            idiomaDestino: idiomas.destino,
            contexto,
        });

        document.getElementById(pensando)?.remove();

        if (!resultado.vale) {
            // Ofrecer una traducción que se ha cargado una etiqueta sería
            // ofrecer un archivo roto con buena letra.
            appendAiMessage('bot', `⚠️ ${t('ai_sugerencia_descartada')} (${resultado.motivo})`);
            return;
        }

        appendAiMessage('bot', resultado.traduccion, true);
    } catch (error) {
        document.getElementById(pensando)?.remove();
        appendAiMessage('bot', `❌ ${error.message}`);
        if (error.codigo === 'clave') aiConfigPanel?.classList.remove('hidden');
    }
}

/** Abre el panel si estaba cerrado. */
function abrirPanel() {
    if (!aiSidebar.classList.contains('show-sidebar')) aiSidebar.classList.add('show-sidebar');
}

/**
 * Los botones de acción rápida del panel.
 *
 * @param {string} accion
 */
function triggerQuickAI(accion) {
    if (accion === 'translate') return sugerirTraduccion();

    const pregunta = t(`ai_prompt_${accion}`);
    if (!pregunta) return;

    abrirPanel();
    appendAiMessage('user', `⚡ ${pregunta}`);
    return responder(pregunta);
}

/** Empieza una conversación nueva, sin lo hablado antes. */
function olvidarConversacion() {
    conversacion = [];
}

export {
    appendAiMessage,
    handleAiSend,
    insertAiResponse,
    olvidarConversacion,
    prepararPanelDeIA,
    retraducirSaludoDeIA,
    sugerirTraduccion,
    triggerQuickAI,
};
