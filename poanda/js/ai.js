import { showMessage } from './dialogs.js';
import {
    aiChatContainer,
    aiConfigPanel,
    aiSidebar,
    aiUserInput,
    configSrcLang,
    configTgtLang,
} from './dom.js';
import { getCurrentFocusedIndex, pushToUndoStack } from './editor.js';
import { state } from './state.js';
import { translations } from './translations.js';

async function callGeminiAI(prompt) {
    // Limpiamos la clave de posibles espacios en blanco al principio/final
    const cleanApiKey = state.aiApiKey ? state.aiApiKey.trim() : '';

    if (!cleanApiKey) {
        appendAiMessage('bot', translations[state.currentLanguage]['ai_no_api_key']);
        aiConfigPanel.classList.remove('hidden');
        return;
    }

    const loadingId = appendAiMessage('bot', translations[state.currentLanguage]['ai_thinking']);

    // Función auxiliar para intentar conectar con un modelo específico
    const tryFetch = async (modelName) => {
        const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${cleanApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });
        return await response.json();
    };

    try {
        // INTENTO 1: Gemini 2.5 Flash (Rápido, eficiente y soporta "thinking")
        // NOTA: Usamos solo el nombre final, sin 'models/' delante
        let data = await tryFetch('gemini-2.5-flash');

        // Si falla, probamos el Plan B
        if (data.error) {
            console.warn('Intento 1 fallido con 2.5 Flash, probando 2.5 Pro...', data.error);

            // INTENTO 2: Gemini 2.5 Pro (Más potente)
            data = await tryFetch('gemini-2.5-pro');
        }

        // Eliminamos mensaje de "pensando"
        const loadingMsg = document.getElementById(loadingId);
        if (loadingMsg) loadingMsg.remove();

        // Procesamos la respuesta final
        if (data.error) {
            // Si fallan los dos, mostramos el error
            let errorMsg = data.error.message;
            if (errorMsg.includes('API key not valid'))
                errorMsg = 'La API Key es incorrecta. Revisa espacios en blanco.';
            appendAiMessage('bot', `❌ Error: ${errorMsg}`);
        } else if (data.candidates && data.candidates.length > 0) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            appendAiMessage('bot', aiResponse, true);
        } else {
            appendAiMessage('bot', 'La IA no devolvió respuesta.');
        }
    } catch (error) {
        const loadingMsg = document.getElementById(loadingId);
        if (loadingMsg) loadingMsg.remove();
        console.error('Error de red:', error);
        appendAiMessage('bot', `❌ Error de conexión: ${error.message}`);
    }
}

function appendAiMessage(sender, text, allowInsert = false) {
    // 1. Guardar última respuesta para el atajo
    if (sender === 'bot') state.lastAiResponseText = text;

    const msgDiv = document.createElement('div');
    const msgId = 'msg-' + Date.now();
    msgDiv.id = msgId;
    msgDiv.className = `ai-message ai-message-${sender}`;

    // 2. Renderizado con enlaces personalizados
    if (sender === 'bot' && typeof marked !== 'undefined') {
        // Configurar renderer para que los links sean botones
        const renderer = new marked.Renderer();
        renderer.link = ({ href }) => {
            // Obtenemos el texto "Source" o "Fuente" según idioma actual
            const label = translations[state.currentLanguage]['ai_link_source'] || 'Source';
            // Devolvemos el HTML del botón, forzando nueva pestaña y title con la URL
            return `<a href="${href}" target="_blank" title="${href}" class="ai-source-link">${label}</a>`;
        };

        // Parsear usando nuestro renderer
        msgDiv.innerHTML = marked.parse(text, { renderer: renderer });
    } else {
        msgDiv.textContent = text;
    }

    // Add Insert Button if it's a bot translation/suggestion
    if (allowInsert && sender === 'bot') {
        const insertBtn = document.createElement('span');
        insertBtn.className = 'ai-insert-btn';
        insertBtn.textContent = '📋 Insertar / Copiar';
        insertBtn.onclick = () => insertAiResponse(text);
        msgDiv.appendChild(insertBtn);
    }

    aiChatContainer.appendChild(msgDiv);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
    return msgId;
}

function insertAiResponse(text) {
    const focused = getCurrentFocusedIndex() || state.lastFocusedSegment;
    if (focused) {
        const textarea = document.getElementById(
            `msgstr-${focused.entryIndex}-${focused.segmentIndex}`,
        );
        if (textarea && !textarea.readOnly) {
            pushToUndoStack();
            // Limpiar texto de markdown simple si la IA lo devolvió
            const cleanText = text.replace(/\*\*/g, '').replace(/```/g, '').trim();
            textarea.value = cleanText;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.focus();

            // Visual feedback on button
            showMessage(translations[state.currentLanguage]['ai_inserted']);
        }
    } else {
        showMessage(translations[state.currentLanguage]['ai_no_segment']);
    }
}

function getContextPrompt(userQuery) {
    // 1. Obtener segmento activo
    const focused = getCurrentFocusedIndex() || state.lastFocusedSegment;
    if (!focused) return null;

    const entryIndex = focused.entryIndex;
    const segmentIndex = focused.segmentIndex;
    const entry = state.poEntries[entryIndex];
    const segment = entry.sentenceSegments[segmentIndex];

    // 2. Configuración de idiomas
    const srcLang = state.glossarySourceLanguage || configSrcLang?.value || 'Unknown';
    const tgtLang = state.glossaryTargetLanguage || configTgtLang?.value || 'Unknown';

    // 3. RECUPERAR GLOSARIO (Contexto Terminológico)
    let glossaryContext = 'No relevant glossary terms found.';
    if (state.termsFoundInActiveSegment && state.termsFoundInActiveSegment.size > 0) {
        const foundTermsList = [];
        state.termsFoundInActiveSegment.forEach((srcTerm) => {
            // Buscamos la traducción en el array global 'glossary'
            const match = state.glossary.find((g) => g.srcTerm === srcTerm);
            if (match) {
                foundTermsList.push(`"${match.srcTerm}" -> "${match.tgtTerm}"`);
            }
        });
        if (foundTermsList.length > 0) {
            glossaryContext =
                'STRICTLY USE these glossary terms:\n- ' + foundTermsList.join('\n- ');
        }
    }

    // 4. RECUPERAR MEMORIA DE TRADUCCIÓN (Contexto Histórico)
    let tmContext = 'No TM match available.';
    // Usamos la variable global tmBestMatchForActiveSegment que ya calcula Poanda
    if (state.tmBestMatchForActiveSegment) {
        tmContext =
            `Found a similar translation in TM (${state.tmBestMatchForActiveSegment.score}% match):\n` +
            `- Original: "${state.tmBestMatchForActiveSegment.srcText}"\n` +
            `- Translation: "${state.tmBestMatchForActiveSegment.tgtText}"\n` +
            `Use this as a reference style or base.`;
    }

    // 5. RECUPERAR CONTEXTO VECINO (Flujo del texto)
    // Intentamos coger el segmento anterior y el posterior para dar contexto
    let prevSegmentText = 'N/A (Start of file)';
    let nextSegmentText = 'N/A (End of file)';

    // Lógica simple para previo
    if (segmentIndex > 0) {
        prevSegmentText =
            entry.sentenceSegments[segmentIndex - 1].translation || '(Not translated yet)';
    } else if (entryIndex > 0) {
        // Si es el primer segmento de una entrada, miramos la entrada anterior (simplificado)
        const prevEntry = state.poEntries[entryIndex - 1];
        if (prevEntry && prevEntry.sentenceSegments.length > 0) {
            const lastSeg = prevEntry.sentenceSegments[prevEntry.sentenceSegments.length - 1];
            prevSegmentText = lastSeg.translation || '(Not translated yet)';
        }
    }

    // Lógica simple para siguiente
    if (segmentIndex < entry.sentenceSegments.length - 1) {
        nextSegmentText = entry.sentenceSegments[segmentIndex + 1].original;
    } else if (entryIndex < state.poEntries.length - 1) {
        const nextEntry = state.poEntries[entryIndex + 1];
        if (nextEntry && !nextEntry.isHeader && nextEntry.sentenceSegments.length > 0) {
            nextSegmentText = nextEntry.sentenceSegments[0].original;
        }
    }

    // 6. CONSTRUCCIÓN DEL PROMPT MAESTRO
    return `
                ACT AS: Professional Translator & Localization Expert (PandaBot).
                
                --- PROJECT CONTEXT ---
                Source Language: ${srcLang}
                Target Language: ${tgtLang}
                
                --- TERMINOLOGY & MEMORY (PRIORITY HIGH) ---
                ${glossaryContext}
                
                ${tmContext}
                
                --- TEXT FLOW CONTEXT ---
                Previous Sentence (Context): "...${prevSegmentText}"
                Current Sentence (TARGET): "${segment.original}"
                Next Sentence (Context): "${nextSegmentText}..."
                
                --- CURRENT STATUS ---
                Current Draft Translation: "${document.getElementById(`msgstr-${entryIndex}-${segmentIndex}`)?.value || ''}"
                Context ID (msgctxt): ${entry.msgctxt || 'N/A'}
                
                --- USER REQUEST ---
                ${userQuery}
                
                OUTPUT GUIDELINES:
                1. Be concise.
                2. If the user asks to translate, prioritize Glossary terms and TM style.
                3. Provide the result directly.
            `;
}

function handleAiSend() {
    const text = aiUserInput.value.trim();
    if (!text) return;

    const prompt = getContextPrompt(text);
    if (!prompt) {
        appendAiMessage('bot', translations[state.currentLanguage]['ai_no_segment']);
        return;
    }

    appendAiMessage('user', text);
    aiUserInput.value = '';
    callGeminiAI(prompt);
}

function triggerQuickAI(actionType) {
    let query = '';
    switch (actionType) {
        case 'translate':
            query = translations[state.currentLanguage]['ai_prompt_translate'];
            break;
        case 'improve':
            query = translations[state.currentLanguage]['ai_prompt_improve'];
            break;
        case 'explain':
            query = translations[state.currentLanguage]['ai_prompt_explain'];
            break;
        case 'fix':
            query = translations[state.currentLanguage]['ai_prompt_fix'];
            break;
    }

    if (query) {
        const prompt = getContextPrompt(query);
        if (!prompt) {
            appendAiMessage('bot', translations[state.currentLanguage]['ai_no_segment']);
            // Open sidebar if closed so user sees the error
            if (!aiSidebar.classList.contains('show-sidebar'))
                aiSidebar.classList.add('show-sidebar');
            return;
        }
        appendAiMessage('user', `⚡ ${query}`);
        callGeminiAI(prompt);
    }
}

export {
    appendAiMessage,
    callGeminiAI,
    getContextPrompt,
    handleAiSend,
    insertAiResponse,
    triggerQuickAI,
};
