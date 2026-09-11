/**
 * El asistente de IA: la parte que se ve.
 *
 * Es el mismo asistente que Poanda, con el mismo núcleo: lo de hablar con los
 * servicios, proteger las etiquetas y montar los encargos está en core/ia/, que
 * no sabe nada de pantallas y por eso se puede probar sin gastar una llamada.
 * Aquí solo queda recoger lo que hay en el editor, pintar la conversación y
 * meter la traducción en su sitio.
 *
 * Dos usos distintos, y los dos importan:
 *
 * - **Traducir o mejorar el subtítulo en el que estás**, con su contexto: el
 *   glosario que aplique, lo que diga la memoria, los subtítulos de alrededor
 *   y —esto es lo propio de subtitular— lo que cabe en el tiempo que está en
 *   pantalla.
 * - **Preguntar sin más**: una duda de terminología, documentarse sobre el tema
 *   del vídeo, pedir alternativas más cortas. Funciona con un archivo abierto o
 *   sin él.
 *
 * Lo que sustituye: el panel de "Contexto IA" que había antes, que no hablaba
 * con ninguna IA. Copiaba un prompt al portapapeles para pegarlo a mano en otra
 * pestaña y esperaba que le devolvieras un JSON pegado. Funcionaba, pero el
 * trabajo lo hacía la persona.
 */
import { showMessage } from './dialogs.js';
import {
    getCurrentFocusedIndex,
    insertarEnElSegmento,
    renderTranslations,
} from './editor-puente.js';
import { mensajeDeError } from './ia-textos.js';
import { state } from './state.js';
import { translations } from './translations.js';
import { hayServicioConectado, leerConfiguracion, seRespetanLosLimites } from './core/ia/ajustes.js';
import { proveedorPorId } from './core/ia/proveedores.js';
import { loQueCabe, preguntar, traducirUno } from './core/ia/traducir.js';
import { limpiarParaSubtitulo } from '@core/srt.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';
const $ = (id) => document.getElementById(id);

/** Lo hablado hasta ahora, para poder repreguntar ("¿y más corto?"). */
let conversacion = [];

/** Cuántos turnos de conversación se mandan. Más es pagar por ruido. */
const MEMORIA_DE_LA_CHARLA = 6;

/**
 * Los límites de calidad del proyecto, que los pone app.js.
 *
 * Vienen de fuera porque viven en app.js, junto al control de calidad, y este
 * módulo no puede importar de app.js sin cerrar un círculo de importaciones.
 * @type {{cpsLimit: number, charsPerLineLimit: number}}
 */
let limitesDelProyecto = { cpsLimit: 17, charsPerLineLimit: 42 };

/** @param {{cpsLimit: number, charsPerLineLimit: number}} limites */
export function ponerLimitesDeCalidad(limites) {
    if (limites) limitesDelProyecto = limites;
}

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
 * Recoge lo que rodea al subtítulo en el que se está: glosario, memoria,
 * vecinos y lo que cabe. Es lo que convierte una traducción automática en un
 * subtítulo con el vocabulario del proyecto y la longitud que admite.
 *
 * @returns {{segmento: Object|null, contexto: Object, idiomas: Object, limite: Object|null}}
 */
function loQueHayAlrededor() {
    const foco = getCurrentFocusedIndex() || state.lastFocusedSegment;
    const contexto = { instrucciones: leerConfiguracion().instrucciones };

    const idiomas = { origen: state.sourceLang || '', destino: state.targetLang || '' };

    if (!foco) return { segmento: null, contexto, idiomas, limite: null };

    const entrada = state.srtEntries[foco.entryIndex];
    if (!entrada) return { segmento: null, contexto, idiomas, limite: null };

    // Glosario: solo los términos que salen en este subtítulo.
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
            { original: acierto.srcText, traduccion: acierto.tgtText, parecido: acierto.score },
        ];
    }

    contexto.vecinos = vecinosDe(foco.entryIndex);

    const editor = $(`translation-${foco.entryIndex}`);

    return {
        segmento: {
            original: entrada.original,
            traduccion: editor ? limpiarParaSubtitulo(editor.innerHTML) : entrada.translation || '',
            entryIndex: foco.entryIndex,
        },
        contexto,
        idiomas,
        limite: seRespetanLosLimites()
            ? loQueCabe(entrada.durationMs, limitesDelProyecto)
            : null,
    };
}

/**
 * El subtítulo de antes y el de después.
 *
 * En subtitulado esto pesa más que en cualquier otro formato: una frase se
 * reparte entre dos y tres subtítulos continuamente, y sin ver los de al lado
 * el modelo traduce media oración como si fuera una entera.
 *
 * @param {number} entryIndex
 * @returns {Array<{original: string, traduccion: string}>}
 */
function vecinosDe(entryIndex) {
    return [state.srtEntries[entryIndex - 1], state.srtEntries[entryIndex + 1]]
        .filter(Boolean)
        .map((e) => ({ original: e.original, traduccion: e.translation || '' }));
}

/**
 * Escribe un mensaje en la conversación.
 *
 * @param {'user'|'bot'} quien
 * @param {string} texto
 * @param {boolean} [conBotonDeInsertar]
 * @returns {string} El id del mensaje, para poder quitarlo luego.
 */
export function appendAiMessage(quien, texto, conBotonDeInsertar = false) {
    const contenedor = $('aiChatContainer');
    if (!contenedor) return '';

    const div = document.createElement('div');
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    div.id = id;
    div.className = `ai-message ai-message-${quien}`;

    const cuerpo = quien === 'bot' ? conElPanda(div) : div;

    // Sin intérprete de markdown: lo que devuelve el modelo es texto de un
    // subtítulo, y meterlo como HTML sería dejar que el archivo que se traduce
    // escriba en la página.
    cuerpo.textContent = texto;

    if (conBotonDeInsertar && quien === 'bot') {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'ai-insert-btn';
        boton.textContent = t('ai_insert_btn');
        boton.addEventListener('click', () => insertAiResponse(texto));
        cuerpo.appendChild(boton);
    }

    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
    return id;
}

/**
 * Convierte un mensaje en un bocadillo con el panda al lado.
 *
 * Todo lo que dice el PandaBot sale de su boca, no solo el saludo: una
 * conversación en la que el primer mensaje tiene cara y los demás son recuadros
 * sueltos parece que la empieza uno y la sigue otro.
 *
 * @param {HTMLElement} mensaje La caja del mensaje, que se vacía.
 * @returns {HTMLElement} Donde va el texto.
 */
function conElPanda(mensaje) {
    mensaje.classList.add('panda-aviso');
    mensaje.innerHTML = '';

    const panda = document.createElement('img');
    panda.className = 'panda-aviso-panda ai-bienvenida-panda';
    panda.src = '../images/panda-prof.png';
    panda.alt = '';
    panda.setAttribute('aria-hidden', 'true');
    mensaje.appendChild(panda);

    const bocadillo = document.createElement('div');
    bocadillo.className = 'panda-aviso-bocadillo';
    mensaje.appendChild(bocadillo);
    return bocadillo;
}

/**
 * Mete un texto en el subtítulo en el que se está.
 *
 * @param {string} texto
 */
export function insertAiResponse(texto) {
    const limpio = String(texto || '')
        .replace(/```/g, '')
        .trim();

    if (!insertarEnElSegmento(limpio, { sustituir: true })) {
        showMessage(t('ai_no_segment'));
        return;
    }
    showMessage(t('ai_inserted'));
}

/**
 * Escribe el saludo y la pregunta de entrada.
 *
 * El panel enseñaba todo a la vez —cuatro botones rápidos, el de pretraducir,
 * el chat y, si faltaba configurar, los ajustes abiertos encima— y había que
 * leerlo entero para saber por dónde empezar. Ahora lo primero es una pregunta
 * con tres respuestas, y cada una lleva a una cosa.
 *
 * Cuando falta configurar un servicio, se dice aquí mismo y con un enlace que
 * abre los ajustes: es lo único que hay que hacer antes de nada, y mandar a
 * alguien a buscar una rueda dentada es mandarlo a buscar.
 */
function escribirLaBienvenida() {
    const contenedor = $('aiChatContainer');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    // El mismo bocadillo del panda que dan los demás mensajes, y el mismo que da
    // la bienvenida en el editor y pide el vídeo: es la misma voz hablando.
    const aviso = document.createElement('div');
    aviso.className = 'ai-message ai-message-bot ai-bienvenida';
    aviso.dataset.bienvenida = 'sí';
    const saludo = conElPanda(aviso);

    const hola = document.createElement('p');
    hola.textContent = t('ai_saludo');
    saludo.appendChild(hola);

    // El aviso de configurar, solo si hace falta. Con el servicio ya puesto,
    // repetirlo sería ruido en el sitio donde menos sobra.
    if (!configuracionUsable()) {
        const aviso = document.createElement('p');
        aviso.className = 'ai-aviso-configurar';

        const [antes, despues] = t('ai_hay_que_configurar').split('{enlace}');
        aviso.append(antes ?? '');

        const enlace = document.createElement('button');
        enlace.type = 'button';
        enlace.className = 'ai-enlace';
        enlace.textContent = t('ai_enlace_configurar');
        enlace.addEventListener('click', () => abrirLosAjustes());
        aviso.appendChild(enlace);
        aviso.append(despues ?? '');

        saludo.appendChild(aviso);
    }

    const pregunta = document.createElement('p');
    pregunta.className = 'ai-pregunta';
    pregunta.textContent = t('ai_para_que');
    saludo.appendChild(pregunta);

    const opciones = document.createElement('div');
    opciones.className = 'ai-opciones';
    for (const [clave, hacer] of [
        ['ai_opcion_preguntar', () => empezarAPreguntar()],
        ['ai_opcion_pretraducir', () => abrirPretraducirDesdeElPanel()],
        ['ai_opcion_libre', () => $('aiUserInput')?.focus()],
    ]) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'ai-opcion';
        boton.textContent = t(clave);
        boton.addEventListener('click', () => {
            // Las tres llevan a hablar con un modelo, así que las tres necesitan
            // uno conectado. Sin él, el camino corto era escribir una pregunta y
            // recibir un error; ahora se dice antes y con el enlace a mano.
            if (!configuracionUsable()) return pedirConfiguracion();
            hacer();
        });
        opciones.appendChild(boton);
    }
    saludo.appendChild(opciones);

    contenedor.appendChild(aviso);
}

/** Lo que hace la primera opción: apunta a los botones de abajo. */
function empezarAPreguntar() {
    appendAiMessage('bot', t('ai_como_preguntar'));
    $('aiUserInput')?.focus();
}

/**
 * Abre el apartado de pretraducir.
 *
 * Vive en pretraducir-ui.js, que importa de aquí: pedírselo por un evento en
 * lugar de importarlo evita que los dos módulos se importen el uno al otro.
 */
function abrirPretraducirDesdeElPanel() {
    document.dispatchEvent(new CustomEvent('subpanda:abrir-pretraducir'));
}

/**
 * Deja el panel del asistente listo para lo que toque.
 *
 * @returns {boolean} true si falta configurar algo.
 */
export function prepararPanelDeIA() {
    const config = configuracionUsable();
    const contenedor = $('aiChatContainer');

    // Solo mientras no se haya hablado con nadie: rehacer la bienvenida encima
    // de una conversación la borraría.
    if (contenedor && (contenedor.children.length === 0 || contenedor.children.length === 1)) {
        escribirLaBienvenida();
    }

    return !config;
}

/**
 * Vuelve a escribir la bienvenida en el idioma que esté puesto.
 *
 * Solo la bienvenida: lo que se haya hablado con el modelo se queda como está.
 * Retraducir una conversación sería inventarse lo que dijo el otro.
 */
export function retraducirSaludoDeIA() {
    const contenedor = $('aiChatContainer');
    if (!contenedor) return;
    // Si ya se ha hablado, la bienvenida no es lo único que hay: se deja estar.
    if (contenedor.children.length === 1 && contenedor.firstElementChild?.dataset.bienvenida) {
        escribirLaBienvenida();
    }
}

/**
 * Abre el cuadro de ajustes y deja el cursor en lo primero que hay que elegir.
 *
 * Es un cuadro aparte y no un desplegable del propio panel: son seis campos
 * —servicio, dirección, clave, modelo, instrucciones y los límites— y en media
 * columna, encima de la conversación, era demasiado en un mismo sitio.
 */
function abrirLosAjustes() {
    $('aiConfigModal')?.classList.remove('hidden');
    $('aiProveedor')?.focus();
}

/** Avisa de que falta configurar la IA y abre el cuadro de ajustes. */
function pedirConfiguracion() {
    appendAiMessage('bot', t('ai_falta_configurar'));
    abrirLosAjustes();
}

/**
 * Quita del saludo el aviso de que hay que configurar una IA.
 *
 * Se llama al conectar. Rehacer el saludo entero borraría lo que se hubiera
 * hablado ya, y dejarlo puesto sería seguir pidiendo algo que ya está hecho.
 */
export function yaHayIAConectada() {
    document.querySelector('#aiChatContainer .ai-aviso-configurar')?.remove();
}

/** Manda lo que se haya escrito en el cuadro. */
export async function handleAiSend() {
    const campo = $('aiUserInput');
    const texto = campo?.value.trim();
    if (!texto) return;

    campo.value = '';
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

        $(pensando)?.remove();
        appendAiMessage('bot', respuesta, Boolean(segmento));

        conversacion.push({ papel: 'persona', texto: pregunta });
        conversacion.push({ papel: 'ia', texto: respuesta });
    } catch (error) {
        $(pensando)?.remove();
        appendAiMessage('bot', `❌ ${mensajeDeError(error)}`);
        if (error.codigo === 'clave') abrirLosAjustes();
    }
}

/**
 * Traduce el subtítulo en el que se está y ofrece el resultado.
 *
 * Va por su propio camino y no por el de la conversación porque aquí sí se
 * protegen las etiquetas, se pasa el límite de lo que cabe y se comprueba la
 * respuesta: una sugerencia que se carga la cursiva no se ofrece.
 */
export async function sugerirTraduccion() {
    const config = configuracionUsable();
    if (!config) return pedirConfiguracion();

    const { segmento, contexto, idiomas, limite } = loQueHayAlrededor();
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
            idiomaOrigen: idiomas.origen,
            idiomaDestino: idiomas.destino,
            contexto,
            limite,
        });

        $(pensando)?.remove();

        if (!resultado.vale) {
            // Ofrecer una traducción que se ha cargado una etiqueta sería
            // ofrecer un subtítulo roto con buena letra.
            appendAiMessage('bot', `⚠️ ${t('ai_sugerencia_descartada')} (${resultado.motivo})`);
            return;
        }

        appendAiMessage('bot', resultado.traduccion, true);
        // Se avisa, no se descarta: un subtítulo largo se lee, se ve en rojo en
        // la lista y se recorta en un momento. Uno vacío hay que traducirlo.
        if (resultado.seVaDeLargo) appendAiMessage('bot', `⚠️ ${t('ai_se_pasa_de_largo')}`);
    } catch (error) {
        $(pensando)?.remove();
        appendAiMessage('bot', `❌ ${mensajeDeError(error)}`);
        if (error.codigo === 'clave') abrirLosAjustes();
    }
}

/**
 * Enseña la pestaña del asistente, por si se llamó desde un atajo.
 *
 * Las pestañas las lleva app.js, que importa de aquí: pedírselo por un evento
 * en lugar de importarlo evita que los dos módulos se importen el uno al otro.
 */
function abrirPanel() {
    document.dispatchEvent(new CustomEvent('subpanda:abrir-pestana', { detail: 'ia' }));
}

/**
 * Los botones de acción rápida del panel.
 *
 * @param {string} accion
 */
export function triggerQuickAI(accion) {
    if (accion === 'translate') return sugerirTraduccion();

    const pregunta = t(`ai_prompt_${accion}`);
    if (!pregunta) return;

    abrirPanel();
    appendAiMessage('user', `⚡ ${pregunta}`);
    return responder(pregunta);
}

/** Empieza una conversación nueva, sin lo hablado antes. */
export function olvidarConversacion() {
    conversacion = [];
}

/** Engancha el panel del asistente. */
export function initAsistenteDeIA() {
    const panel = $('aiSidebar');
    if (!panel) return;

    // El panel es una pestaña de la columna de consulta y quien la enseña es
    // app.js: aquí solo se deja escrita la bienvenida, y se escribe al arrancar
    // para que el idioma la alcance desde el primer momento.
    prepararPanelDeIA();
    $('aiConfigToggleBtn')?.addEventListener('click', abrirLosAjustes);
    $('aiConfigCerrarBtn')?.addEventListener('click', () =>
        $('aiConfigModal')?.classList.add('hidden'),
    );

    $('aiSendBtn')?.addEventListener('click', handleAiSend);
    $('aiUserInput')?.addEventListener('keydown', (evento) => {
        // Enter manda; Mayúsculas+Enter parte la línea. Es lo contrario que en
        // el editor de subtítulos, y es lo que hace todo el mundo en un cuadro
        // de chat.
        if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault();
            handleAiSend();
        }
    });

    for (const boton of document.querySelectorAll('[data-ai-action]')) {
        boton.addEventListener('click', () => triggerQuickAI(boton.dataset.aiAction));
    }
}

export { renderTranslations };
