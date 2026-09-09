import { saveBackup } from './backup.js';
import { EXTENSIONES_ADMITIDAS, formatoPorExtension, formatoPorId } from './core/formatos.js';
import { parseHtmlProject, reconstructHtml } from './core/html-doc.js';
import { parseJsonProject, reconstructJson } from './core/json.js';
import { parsePoContent, reconstructPo } from './core/po.js';
import { esTraduccionDeQt } from './core/qtts.js';
import { hideLoadingOverlay, showLoadingOverlay, showMessage, showPrompt } from './dialogs.js';
import { registrarProyectoAbierto } from './persistencia.js';
import { preguntarIdiomasAlAbrir } from './idiomas-proyecto.js';
import { poSearchContainer, poSearchInput, statsContainer, translationsContainer } from './dom.js';
import { filterPOEntries, renderTranslations } from './editor.js';
import { state } from './state.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import { translations } from './translations.js';

/**
 * Carga en el editor el contenido de una página HTML.
 *
 * @param {{content: string, name: string}} fileData
 * @returns {Promise<void>}
 */
async function cargarHtml(fileData) {
    try {
        // El HTML original se guarda entero: es lo que permite volver a montar
        // la página con las traducciones puestas al exportar.
        state.currentRawHtml = fileData.content;
        state.contenidoOriginal = fileData.content;

        state.poEntries = parseHtmlProject(fileData.content);
        state.currentFileType = 'html';
        state.currentFileName = fileData.name;
        await registrarProyectoAbierto({
            fileName: fileData.name,
            format: 'html',
            rawHtml: fileData.content,
            contenidoOriginal: fileData.content,
        });

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState();
        showMessage(translations[state.currentLanguage]['html_loaded_success']);

        setTimeout(saveBackup, 1000);
    } catch (e) {
        console.error(e);
        showMessage(`${translations[state.currentLanguage]['error_loading_html']} ${e.message}`);
    }
}

async function saveHtmlFile() {
    if (state.poEntries.length === 0) return;
    const targetFileName = await showPrompt(
        translations[state.currentLanguage]['html_save_filename_prompt'],
        state.currentFileName,
    );
    if (!targetFileName) return;

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        // Se reconstruye sobre la página con la que se abrió: solo cambian los
        // textos traducidos y el resto del archivo vuelve intacto.
        const htmlContent = reconstructHtml(
            state.poEntries,
            state.contenidoOriginal || state.currentRawHtml || '',
        );
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['html_saved_successfully']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_file']} ${error.message}`);
    } finally {
        hideLoadingOverlay();
    }
}

async function saveJsonFile() {
    // Allow saving if ANY entries exist, regardless of original file type
    if (state.poEntries.length === 0) {
        showMessage(translations[state.currentLanguage]['no_translations_to_save']);
        return;
    }

    // Always prompt for filename in this simplified flow
    let targetFileName = await showPrompt(
        translations[state.currentLanguage]['json_save_filename_prompt'],
        `translations_${state.currentLanguage}.json`,
    );
    if (!targetFileName) {
        showMessage(translations[state.currentLanguage]['select_file_error']); // User cancelled prompt
        return;
    }
    // Ensure it ends with .json
    if (!targetFileName.toLowerCase().endsWith('.json')) {
        targetFileName += '.json';
    }

    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        // Se reconstruye sobre el archivo con el que se abrió: así vuelven los
        // grupos de claves, el orden y la sangría que tuviera.
        const updatedJsonContent = reconstructJson(state.poEntries, state.contenidoOriginal || '');
        const blob = new Blob([updatedJsonContent], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['json_saved_success']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_json']} ${error.message}`);
        console.error('Error saving JSON file:', error);
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Descarga el archivo PO con las traducciones puestas.
 * @returns {Promise<void>}
 */
async function savePoFile() {
    if (state.poEntries.length === 0) {
        showMessage(translations[state.currentLanguage]['no_translations_to_save']);
        return;
    }
    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const contenido = reconstructPo(state.poEntries);
        const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = state.currentFileName.replace(/\.po$/i, '') + '.po';
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['file_saved_successfully']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_file']} ${error.message}`);
        console.error('Error saving file:', error);
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Formatos que Poanda sabe abrir para traducir.
 *
 * Sale de la tabla de core/formatos.js: añadir un formato allí lo añade aquí,
 * en el aviso de "formato no admitido" y en el recuadro de soltar archivos.
 */
export const FORMATOS_ADMITIDOS = EXTENSIONES_ADMITIDAS;

/** Formatos de proyecto guardado de Poanda. */
export const FORMATOS_PROYECTO = ['.poanda', '.zip'];

/**
 * Devuelve la extensión de un nombre de archivo, en minúsculas y con el punto.
 * @param {string} nombre
 * @returns {string}
 */
export function extensionDe(nombre) {
    const punto = (nombre || '').lastIndexOf('.');
    return punto === -1 ? '' : nombre.slice(punto).toLowerCase();
}

/**
 * Abre cualquier archivo compatible, mirando su extensión.
 *
 * Es el único camino de entrada: lo usan tanto el botón de cargar como el
 * recuadro donde se sueltan archivos. Así no hay dos sitios que decidan qué
 * hacer con un .json y acaben haciendo cosas distintas.
 *
 * @param {File} file Archivo elegido o soltado.
 * @returns {Promise<boolean>} true si se ha podido abrir.
 */
async function abrirArchivo(file) {
    if (!file) return false;
    const extension = extensionDe(file.name);

    if (FORMATOS_PROYECTO.includes(extension)) {
        await openProject(file);
        return true;
    }

    if (!FORMATOS_ADMITIDOS.includes(extension)) {
        showMessage(
            `${translations[state.currentLanguage]['unsupported_file']} ${FORMATOS_ADMITIDOS.join(', ')}`,
        );
        return false;
    }

    const formato = formatoPorExtension(extension);
    // Los .mo no son texto: son el catálogo compilado, y leerlos como texto
    // los destroza. El resto de formatos sí son texto.
    const contenido = formato.binario ? await file.arrayBuffer() : await file.text();

    // La extensión .ts la comparten los archivos de traducción de Qt y los
    // de TypeScript, que son código. Abrir un archivo de código como si
    // fuera de traducción no daría un error: daría una lista de segmentos
    // vacía y la sensación de que Poanda está rota.
    if (formato.id === 'qtts' && !esTraduccionDeQt(contenido)) {
        showMessage(translations[state.currentLanguage]['ts_no_es_de_qt']);
        return false;
    }

    // De qué idioma a qué idioma. Se pregunta antes de leer el archivo y con la
    // pantalla despejada: es un dato del proyecto que va a hacer falta enseguida
    // —para la memoria, para el glosario y para el asistente— y preguntarlo
    // después, con la lista ya pintada, se lee como una interrupción.
    await preguntarIdiomasAlAbrir({ formato: formato.id, nombre: file.name, contenido });

    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        // Los tres formatos antiguos tienen su propio camino porque hacen más
        // cosas al abrirse; ver el comentario de core/formatos.js.
        if (formato.id === 'po') {
            state.currentFileName = file.name;
            processPoContent(contenido);
        } else if (formato.id === 'json') {
            await cargarJson({ content: contenido, name: file.name });
        } else if (formato.id === 'html') {
            await cargarHtml({ content: contenido, name: file.name });
        } else {
            await cargarConFormato(formato, { content: contenido, name: file.name });
        }
        return true;
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Abre un archivo usando el lector de su formato.
 *
 * Es el camino general: todo lo que hace es leer el archivo, dejar las entradas
 * en el editor y guardar el contenido original, que es lo que necesita el
 * escritor para devolver intacto lo que no se traduce.
 *
 * @param {Object} formato Entrada de la tabla de core/formatos.js.
 * @param {{content: string, name: string}} fileData
 * @returns {Promise<void>}
 */
async function cargarConFormato(formato, fileData) {
    try {
        state.poEntries = formato.leer(fileData.content);
        state.currentFileType = formato.id;
        state.currentFileName = fileData.name;
        // El contenido con el que se abrió el archivo se guarda también cuando
        // es binario: los formatos que por dentro son un zip (Word, Excel,
        // LibreOffice) necesitan el archivo entero para devolver intactas las
        // partes que no llevan texto.
        state.contenidoOriginal = fileData.content;

        await registrarProyectoAbierto({
            fileName: fileData.name,
            format: formato.id,
            contenidoOriginal: fileData.content,
        });

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState();

        setTimeout(saveBackup, 1000);
    } catch (e) {
        console.error(e);
        showMessage(`${translations[state.currentLanguage]['error_loading_file']} ${e.message}`);
    }
}

/**
 * Descarga el archivo actual reconstruido con su propio escritor.
 *
 * @param {Object} formato Entrada de la tabla de core/formatos.js.
 * @returns {Promise<void>}
 */
async function guardarConFormato(formato) {
    showLoadingOverlay(translations[state.currentLanguage]['saving_file']);
    try {
        const contenido = formato.escribir(state.poEntries, state.contenidoOriginal || '');
        const blob = new Blob([contenido], { type: formato.mime });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = state.currentFileName;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
        showMessage(translations[state.currentLanguage]['file_saved_successfully']);
    } catch (error) {
        showMessage(`${translations[state.currentLanguage]['error_saving_file']} ${error.message}`);
        console.error('Error saving file:', error);
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Abre el diálogo del sistema para elegir un archivo y lo carga.
 * @returns {Promise<void>}
 */
async function elegirYAbrirArchivo() {
    const entrada = document.getElementById('anyFile');
    if (!entrada) return;

    // La lista de extensiones del diálogo se pone aquí, sacada de la tabla de
    // formatos. Escrita a mano en el HTML se quedaba atrás en cuanto se añadía
    // un formato, y el archivo aparecía en gris en el explorador aunque Poanda
    // supiera abrirlo perfectamente.
    entrada.setAttribute('accept', FORMATOS_ADMITIDOS.join(','));

    const alCambiar = async (evento) => {
        entrada.removeEventListener('change', alCambiar);
        const file = evento.target.files[0];
        entrada.value = ''; // permite volver a elegir el mismo archivo
        if (file) await abrirArchivo(file);
    };

    entrada.addEventListener('change', alCambiar);
    entrada.click();
}

/**
 * Guarda el archivo en el mismo formato en el que se cargó.
 * @returns {Promise<void>}
 */
async function guardarArchivoActual() {
    if (state.poEntries.length === 0) return;

    const formato = formatoPorId(state.currentFileType) || formatoPorId('po');

    if (formato.id === 'json') await saveJsonFile();
    else if (formato.id === 'html') await saveHtmlFile();
    else if (formato.id === 'po') await savePoFile();
    else await guardarConFormato(formato);
}

/**
 * Ajusta el menú Archivo a lo que hay cargado.
 *
 * "Guardar archivo" solo se puede pulsar si hay algo abierto, y "Convertir
 * a .mo" solo aparece con un archivo PO, que es el único formato que gettext
 * sabe compilar.
 */
/**
 * ¿Lo que hay abierto es un PO?
 *
 * Compilar a .mo solo tiene sentido con un PO: es lo único que compila
 * gettext. Esta pregunta la hacen dos sitios —el menú, para enseñar o esconder
 * la entrada, y el propio botón, antes de abrir el conversor— y tiene que dar
 * la misma respuesta en los dos. El botón solo miraba si había segmentos, así
 * que un .txt o un .json abierto se dejaba "compilar": salía un .mo con
 * basura dentro, que es peor que no salir.
 *
 * @returns {boolean}
 */
function hayUnPoAbierto() {
    return state.poEntries.length > 0 && (state.currentFileType || 'po') === 'po';
}

function updateSaveButtonsState() {
    const hayContenido = state.poEntries.length > 0;

    // Con un archivo abierto, la cabecera grande deja paso al texto: el logo se
    // reduce a la esquina y la descripción de la herramienta desaparece.
    document.body.classList.toggle('con-proyecto', hayContenido);

    const esPo = hayUnPoAbierto();

    const guardar = document.getElementById('saveFileBtn');
    const convertir = document.getElementById('convertFileMoBtn');
    const separador = document.getElementById('convertMoSeparator');

    if (guardar) guardar.classList.toggle('disabled-link', !hayContenido);

    // Convertir a .mo no se desactiva: se esconde. Si no has abierto un PO, esa
    // opción no significa nada y solo estorba en el menú.
    if (convertir) convertir.classList.toggle('hidden', !esPo);
    if (separador) separador.classList.toggle('hidden', !esPo);
}

/**
 * Carga en el editor el contenido de un archivo JSON de clave-valor.
 *
 * @param {{content: string, name: string}} fileData
 * @returns {Promise<void>}
 */
async function cargarJson(fileData) {
    try {
        state.poEntries = parseJsonProject(fileData.content);
        state.currentFileType = 'json'; // Mark as JSON type
        state.currentFileName = fileData.name; // Use the loaded filename
        state.contenidoOriginal = fileData.content;
        await registrarProyectoAbierto({
            fileName: fileData.name,
            format: 'json',
            contenidoOriginal: fileData.content,
        });
        // Reset other JSON names as they aren't relevant in this flow
        state.currentJsonSourceFileName = fileData.name;
        state.currentJsonTargetFileName = null;

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState(); // Enable JSON saving
        showMessage(translations[state.currentLanguage]['json_loaded_success']);
    } catch (error) {
        showMessage(
            `${translations[state.currentLanguage]['error_loading_json']} ${error.message || error}`,
        );
        console.error('Error loading single JSON file:', error);
    }
}

function processPoContent(content) {
    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
    try {
        state.poEntries = parsePoContent(content);
        // El formato tiene que quedar apuntado como cualquier otro: es lo que
        // mira todo lo que se comporta distinto según el archivo (las etiquetas
        // que se reconocen, el menú, la IA). Antes se quedaba sin poner y cada
        // sitio lo suplía con un "si no hay nada, será un PO", que funcionaba
        // hasta que alguien se olvidaba de suplirlo.
        state.currentFileType = 'po';
        state.contenidoOriginal = content;
        registrarProyectoAbierto({ fileName: state.currentFileName, format: 'po' });
        setTimeout(() => {
            renderTranslations(state.poEntries);
            updateStatsDisplay();
        }, 0);
        poSearchInput.value = ''; // Clear search on new file
        filterPOEntries(); // Apply empty filter to reset view
    } catch (error) {
        showMessage(
            `${translations[state.currentLanguage]['error_reading_file']} ${error.message}`,
        );
        console.error('Error parsing file:', error);
        translationsContainer.innerHTML = `
                    <div class="text-center text-red-500 p-4 border border-red-300 rounded-md">
                        ${translations[state.currentLanguage]['file_processing_error']}
                    </div>
                `;
        savePoButton.disabled = true;
        convertToMoButton.disabled = true;
        poSearchContainer.classList.add('hidden');
        statsContainer.classList.remove('show');
        updateUtilityButtonStates();
    } finally {
        hideLoadingOverlay();
    }
}

async function processFile(file) {
    state.currentFileName = file.name;
    const content = await file.text();
    processPoContent(content);
}

function selectFile(inputId, promptMessage = 'Please select a file:') {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById(inputId);
        if (!fileInput) {
            return reject(`File input with ID "${inputId}" not found.`);
        }

        // Optional: Show a message if needed (could use your showMessage modal)
        // alert(promptMessage); // Simple alert for now

        const changeHandler = async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    const content = await file.text();
                    resolve({ content: content, name: file.name });
                } catch (error) {
                    reject(`Error reading file: ${error.message}`);
                }
            } else {
                reject(
                    translations[state.currentLanguage]['select_file_error'] ||
                        'File selection failed or cancelled.',
                );
            }
            // Clean up listener and reset input
            fileInput.removeEventListener('change', changeHandler);
            fileInput.value = ''; // Allows selecting the same file again
        };

        fileInput.addEventListener('change', changeHandler);
        fileInput.click();
    });
}

export {
    abrirArchivo,
    elegirYAbrirArchivo,
    guardarArchivoActual,
    hayUnPoAbierto,
    processFile,
    processPoContent,
    saveHtmlFile,
    saveJsonFile,
    updateSaveButtonsState,
};
