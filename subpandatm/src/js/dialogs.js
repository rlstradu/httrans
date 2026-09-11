/**
 * Los avisos y las esperas, para los módulos que no viven en app.js.
 *
 * El cuerpo de la herramienta tiene sus propias showMessage y showLoadingOverlay
 * desde antes del refactor. Estas son las mismas, expuestas como módulo para
 * que el glosario y la memoria no dependan del ámbito de app.js.
 */
import { loadingMessage, loadingOverlay, messageBox, messageText } from './dom.js';

export function showMessage(msg) {
    if (!messageBox || !messageText) return;
    messageText.textContent = msg;
    messageBox.classList.remove('hidden');
}

export function showLoadingOverlay(message) {
    if (loadingMessage && loadingOverlay) {
        loadingMessage.textContent = message;
        loadingOverlay.classList.remove('hidden');
    }
}

export function hideLoadingOverlay() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}
