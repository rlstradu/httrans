import { state } from '../state.js';
import { countWords } from './text.js';

/**
 * Extrae de una página HTML los textos que se pueden traducir.
 *
 * Recorre el documento guardando qué nodo corresponde a cada texto, para poder
 * volver a montar la página después con las traducciones en su sitio.
 *
 * @param {string} htmlContent Código HTML completo.
 * @returns {Array<Object>} Segmentos traducibles.
 */
function parseHtmlProject(htmlContent) {
    const parser = new DOMParser();
    state.currentHtmlDoc = parser.parseFromString(htmlContent, 'text/html');
    const entries = [];
    state.htmlNodeMap = [];

    let nodeCounter = 0;

    function traverse(node) {
        if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE' || node.nodeName === 'NOSCRIPT')
            return;

        if (node.nodeType === Node.ELEMENT_NODE) {
            // 1. Content Translation (innerHTML logic)
            const hasDirectText = Array.from(node.childNodes).some(
                (child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0,
            );

            if (hasDirectText) {
                const originalText = node.innerHTML.trim();
                nodeCounter++;
                const entry = {
                    msgctxt: `${node.tagName.toLowerCase()}_${nodeCounter}`,
                    msgid: originalText,
                    msgstr: '',
                    sentenceSegments: [
                        {
                            original: originalText,
                            translation: '',
                            wordCountOriginal: countWords(originalText),
                            wordCountTranslation: 0,
                            isTranslated: false,
                        },
                    ],
                };
                state.htmlNodeMap.push({ type: 'element', node: node });
                entries.push(entry);
            }

            // 2. Attribute Translation
            ['alt', 'title', 'placeholder', 'aria-label', 'meta[content]'].forEach((attr) => {
                let attrVal = '';
                let attrName = attr;

                // Handle meta description specifically
                if (
                    attr === 'meta[content]' &&
                    node.tagName === 'META' &&
                    node.getAttribute('name') === 'description'
                ) {
                    attrVal = node.getAttribute('content');
                    attrName = 'content';
                } else if (attr !== 'meta[content]' && node.hasAttribute(attr)) {
                    attrVal = node.getAttribute(attr);
                }

                if (attrVal && attrVal.trim()) {
                    nodeCounter++;
                    const entry = {
                        msgctxt: `${node.tagName.toLowerCase()}_attr_${attrName}_${nodeCounter}`,
                        msgid: attrVal,
                        msgstr: '',
                        sentenceSegments: [
                            {
                                original: attrVal,
                                translation: '',
                                wordCountOriginal: countWords(attrVal),
                                wordCountTranslation: 0,
                                isTranslated: false,
                            },
                        ],
                    };
                    state.htmlNodeMap.push({ type: 'attribute', node: node, attr: attrName });
                    entries.push(entry);
                }
            });
        }

        for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i]);
        }
    }

    traverse(state.currentHtmlDoc.body); // Start body
    // Optionally parse head for title/meta
    if (state.currentHtmlDoc.head) {
        const titleNode = state.currentHtmlDoc.head.querySelector('title');
        if (titleNode) {
            const text = titleNode.innerText;
            state.htmlNodeMap.push({ type: 'element_text', node: titleNode });
            entries.push({
                msgctxt: 'title_tag',
                msgid: text,
                msgstr: '',
                sentenceSegments: [
                    {
                        original: text,
                        translation: '',
                        wordCountOriginal: countWords(text),
                        wordCountTranslation: 0,
                        isTranslated: false,
                    },
                ],
            });
        }
        // Trigger meta logic
        Array.from(state.currentHtmlDoc.head.children).forEach((child) => traverse(child));
    }

    return entries;
}

/**
 * Vuelve a montar la página HTML con las traducciones puestas.
 *
 * @param {Array<Object>} entries Segmentos con sus traducciones.
 * @returns {string} Código HTML completo traducido.
 */
function reconstructHtml(entries) {
    if (!state.currentHtmlDoc || state.htmlNodeMap.length === 0) return null;

    entries.forEach((entry, index) => {
        let translatedText = entry.sentenceSegments
            .map((s) => s.translation)
            .join(' ')
            .trim();
        if (!translatedText) return;

        const mapItem = state.htmlNodeMap[index];
        if (!mapItem) return;

        if (mapItem.type === 'element') {
            mapItem.node.innerHTML = translatedText;
        } else if (mapItem.type === 'element_text') {
            mapItem.node.innerText = translatedText;
        } else if (mapItem.type === 'attribute') {
            mapItem.node.setAttribute(mapItem.attr, translatedText);
        }
    });
    return '<!DOCTYPE html>\n' + state.currentHtmlDoc.documentElement.outerHTML;
}

export { parseHtmlProject, reconstructHtml };
