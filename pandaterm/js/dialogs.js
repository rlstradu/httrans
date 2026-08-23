// js/dialogs.js
// Generic dialog primitives shared across the app: a plain message box, a
// confirm/cancel dialog, toast notifications, and the shared modal-close
// helper. Nothing here is glossary-specific.

/**
 * Shows a simple message box with a single OK button.
 * @param {string} message
 */
function showMessageBox(message) {
  const existingMessageBox = document.querySelector('.message-box');
  if (existingMessageBox) {
    existingMessageBox.remove();
  }

  const messageBox = document.createElement('div');
  messageBox.className = 'message-box';

  const titleEl = document.createElement('h3');
  titleEl.textContent = translations[state.currentUILanguage]['title'];

  const messageText = document.createElement('p');
  messageText.textContent = message;
  messageText.style.marginBottom = '20px';

  const closeButton = document.createElement('button');
  closeButton.textContent = 'OK';
  closeButton.className = 'btn-primary';
  closeButton.onclick = () => document.body.removeChild(messageBox);

  messageBox.appendChild(titleEl);
  messageBox.appendChild(messageText);
  messageBox.appendChild(closeButton);
  document.body.appendChild(messageBox);
}

/**
 * Shows a confirm/cancel dialog.
 * @param {string} title
 * @param {string} message
 * @param {Function} onConfirm
 * @param {Function|null} [onCancelCallback]
 * @param {string|null} [confirmText]
 * @param {string|null} [cancelText]
 * @param {string} [confirmClass]
 */
function showConfirmationDialog(title, message, onConfirm, onCancelCallback = null, confirmText = null, cancelText = null, confirmClass = 'btn-danger') {
  const existingMessageBox = document.querySelector('.message-box');
  if (existingMessageBox) {
    existingMessageBox.remove();
  }

  const messageBox = document.createElement('div');
  messageBox.className = 'message-box';

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;

  const messageText = document.createElement('p');
  messageText.textContent = message;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'dialog-buttons';

  const confirmButton = document.createElement('button');
  confirmButton.textContent = confirmText || translations[state.currentUILanguage]['confirm_button'] || 'Confirm';
  confirmButton.className = confirmClass;
  confirmButton.onclick = () => {
    onConfirm();
    document.body.removeChild(messageBox);
  };

  const cancelButton = document.createElement('button');
  cancelButton.textContent = cancelText || translations[state.currentUILanguage]['cancel_button'] || 'Cancel';
  cancelButton.className = 'btn-secondary';
  cancelButton.onclick = () => {
    if (onCancelCallback) onCancelCallback();
    document.body.removeChild(messageBox);
  };

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);

  messageBox.appendChild(titleEl);
  messageBox.appendChild(messageText);
  messageBox.appendChild(buttonContainer);
  document.body.appendChild(messageBox);
}

/**
 * Closes a modal dialog.
 * @param {string} modalId - The ID of the modal overlay to close.
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}

/**
 * Shows a transient toast notification, bottom-left.
 * @param {string} message
 */
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.error('Toast container not found!');
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 500);
  }, 4000);
}
