import { updateMainContentOffset } from './i18n.js';

function makeDraggableAndResizable(sidebar) {
    const header = sidebar.querySelector('.sidebar-header');
    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

    if (header) {
        header.onmousedown = dragMouseDown;
    }

    function makeModalDraggable(modalElement) {
        const handle = modalElement.querySelector('h2');
        const content = modalElement.querySelector('.modal-content');
        let pos1 = 0,
            pos2 = 0,
            pos3 = 0,
            pos4 = 0;

        if (handle && content) {
            handle.style.cursor = 'move';
            handle.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            content.style.top = content.offsetTop - pos2 + 'px';
            content.style.left = content.offsetLeft - pos1 + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        sidebar.style.transform = 'none';
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        sidebar.style.top = sidebar.offsetTop - pos2 + 'px';
        sidebar.style.left = sidebar.offsetLeft - pos1 + 'px';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

    const resizers = sidebar.querySelectorAll('.resizer');
    let currentResizer;

    for (let resizer of resizers) {
        resizer.addEventListener('mousedown', initResize, false);
    }

    function initResize(e) {
        e.stopPropagation(); // Stop the event from bubbling up to the header
        currentResizer = e.target;
        let startX = e.clientX;
        let startY = e.clientY;
        let startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
        let startHeight = parseInt(document.defaultView.getComputedStyle(sidebar).height, 10);
        let startLeft = sidebar.offsetLeft;
        let startTop = sidebar.offsetTop;

        function doResize(e) {
            const rect = sidebar.getBoundingClientRect();
            if (currentResizer.classList.contains('resizer-r')) {
                sidebar.style.width = startWidth + e.clientX - startX + 'px';
            } else if (currentResizer.classList.contains('resizer-l')) {
                sidebar.style.width = startWidth - (e.clientX - startX) + 'px';
                sidebar.style.left = startLeft + (e.clientX - startX) + 'px';
            } else if (currentResizer.classList.contains('resizer-b')) {
                sidebar.style.height = startHeight + e.clientY - startY + 'px';
            } else if (currentResizer.classList.contains('resizer-t')) {
                sidebar.style.height = startHeight - (e.clientY - startY) + 'px';
                sidebar.style.top = startTop + (e.clientY - startY) + 'px';
            } else if (currentResizer.classList.contains('resizer-br')) {
                sidebar.style.width = startWidth + e.clientX - startX + 'px';
                sidebar.style.height = startHeight + e.clientY - startY + 'px';
            } else if (currentResizer.classList.contains('resizer-bl')) {
                sidebar.style.width = startWidth - e.clientX + startX + 'px';
                sidebar.style.left = startLeft + e.clientX - startX + 'px';
                sidebar.style.height = startHeight + e.clientY - startY + 'px';
            } else if (currentResizer.classList.contains('resizer-tr')) {
                sidebar.style.width = startWidth + e.clientX - startX + 'px';
                sidebar.style.height = startHeight - e.clientY + startY + 'px';
                sidebar.style.top = startTop + e.clientY - startY + 'px';
            } else if (currentResizer.classList.contains('resizer-tl')) {
                sidebar.style.width = startWidth - e.clientX + startX + 'px';
                sidebar.style.left = startLeft + e.clientX - startX + 'px';
                sidebar.style.height = startHeight - e.clientY + startY + 'px';
                sidebar.style.top = startTop + e.clientY - startY + 'px';
            }
            updateMainContentOffset();
        }

        function stopResize() {
            window.removeEventListener('mousemove', doResize, false);
            window.removeEventListener('mouseup', stopResize, false);
        }

        window.addEventListener('mousemove', doResize, false);
        window.addEventListener('mouseup', stopResize, false);
    }

    const resetBtn = sidebar.querySelector('.reset-panel-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.style.removeProperty('top');
            sidebar.style.removeProperty('left');
            sidebar.style.removeProperty('right');
            sidebar.style.removeProperty('bottom');
            sidebar.style.removeProperty('width');
            sidebar.style.removeProperty('height');
            sidebar.style.removeProperty('transform');

            if (!sidebar.classList.contains('show-sidebar')) {
                sidebar.classList.add('show-sidebar');
            }
            updateMainContentOffset();
        });
    }

    const resizeObserver = new ResizeObserver(() => {
        updateMainContentOffset();
    });
    resizeObserver.observe(sidebar);
}

function makeModalDraggable(modalElement) {
    // Si el elemento no existe, salimos para evitar errores
    if (!modalElement) return;

    const handle = modalElement.querySelector('h2'); // Usamos el título H2 como "agarradera"
    const content = modalElement.querySelector('.modal-content');
    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

    if (handle && content) {
        handle.style.cursor = 'move';
        handle.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        content.style.top = content.offsetTop - pos2 + 'px';
        content.style.left = content.offsetLeft - pos1 + 'px';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

export { makeDraggableAndResizable, makeModalDraggable };
