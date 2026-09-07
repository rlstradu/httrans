import { loadingMessage, loadingOverlay, messageBox, messageText } from './dom.js';

function showMessage(msg) {
    messageText.textContent = msg;
    messageBox.classList.remove('hidden');
}

function showLoadingOverlay(message) {
    if (loadingMessage && loadingOverlay) {
        loadingMessage.textContent = message;
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Pide una confirmación (sí / no) usando el modal propio de Poanda.
 *
 * Sustituye al `confirm()` nativo del navegador, que AGENTS.md §5 prohíbe.
 * Devuelve una promesa: `true` si la persona acepta, `false` si cancela o
 * cierra con Escape.
 *
 * @param {string} message Texto que se muestra en el diálogo.
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const text = document.getElementById('confirmModalText');
        const okBtn = document.getElementById('confirmModalOkBtn');
        const cancelBtn = document.getElementById('confirmModalCancelBtn');
        if (!modal || !text || !okBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        text.textContent = message;
        modal.classList.remove('hidden');
        okBtn.focus();

        const close = (result) => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };
        const onOk = () => close(true);
        const onCancel = () => close(false);
        const onKey = (e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

/**
 * Pide un texto usando el modal propio de Poanda.
 *
 * Sustituye al `prompt()` nativo del navegador. Devuelve una promesa con el
 * texto escrito, o `null` si la persona cancela.
 *
 * @param {string} message Texto explicativo (por ejemplo, "Nombre del archivo").
 * @param {string} [defaultValue] Valor con el que aparece rellenado el campo.
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const text = document.getElementById('promptModalText');
        const input = document.getElementById('promptModalInput');
        const okBtn = document.getElementById('promptModalOkBtn');
        const cancelBtn = document.getElementById('promptModalCancelBtn');
        if (!modal || !text || !input || !okBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        text.textContent = message;
        input.value = defaultValue;
        modal.classList.remove('hidden');
        input.focus();
        input.select();

        const close = (result) => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
            resolve(result);
        };
        const onOk = () => close(input.value.trim() ? input.value.trim() : null);
        const onCancel = () => close(null);
        const onKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onOk();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    });
}

export { hideLoadingOverlay, showLoadingOverlay, showMessage };
