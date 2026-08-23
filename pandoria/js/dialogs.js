// js/dialogs.js
// Generic dialog helpers built on top of the static #messageBox and
// #confirmModal markup in index.html. Nothing here is TM/TMX-specific.

/**
 * Shows a simple message box with a single OK button.
 * @param {string} msg
 */
function showMessage(msg) {
    messageText.textContent = msg;
    messageBox.style.display = 'flex';
}

/**
 * Shows the generic confirm/cancel modal with the given title and text,
 * running `onProceed` if the user clicks the proceed button. The cancel
 * button's behavior (just hide the modal) is wired once in main.js.
 *
 * This factors out a pattern that used to be repeated inline at every
 * call site (new TMX, start alignment, import code over unsaved data,
 * and now delete-entry): set confirmTitle/confirmText, show the modal,
 * assign confirmProceedBtn.onclick.
 * @param {string} title
 * @param {string} text
 * @param {Function} onProceed
 */
function showConfirmDialog(title, text, onProceed) {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmModal.style.display = 'flex';
    confirmProceedBtn.onclick = () => {
        confirmModal.style.display = 'none';
        onProceed();
    };
}
