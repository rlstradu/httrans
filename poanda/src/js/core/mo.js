/**
 * Lee un archivo PO quedándose solo con lo que necesita el formato MO.
 *
 * @param {string} poText Contenido del archivo PO.
 * @returns {Array<Object>} Mensajes con msgid, msgstr y msgctxt.
 */
function parsePoForMo(poText) {
    const lines = poText.split('\n');
    const messages = [];
    let currentMsg = {};
    let state = '';

    const unescape = (str) => str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#')) continue;

        if (trimmedLine.length === 0) {
            if (currentMsg.msgid !== undefined) {
                messages.push(currentMsg);
            }
            currentMsg = {};
            state = '';
            continue;
        }

        if (trimmedLine.startsWith('msgctxt')) {
            state = 'msgctxt';
            currentMsg.msgctxt = unescape(trimmedLine.substring(7).trim().slice(1, -1));
        } else if (trimmedLine.startsWith('msgid_plural')) {
            state = 'msgid_plural';
            currentMsg.msgid_plural = unescape(trimmedLine.substring(12).trim().slice(1, -1));
        } else if (trimmedLine.startsWith('msgid')) {
            state = 'msgid';
            currentMsg.msgid = unescape(trimmedLine.substring(5).trim().slice(1, -1));
        } else if (trimmedLine.startsWith('msgstr[')) {
            const match = trimmedLine.match(/msgstr\[(\d+)\]/);
            state = `msgstr[${match[1]}]`;
            if (!currentMsg.msgstr) currentMsg.msgstr = [];
            currentMsg.msgstr[parseInt(match[1], 10)] = unescape(
                trimmedLine.substring(match[0].length).trim().slice(1, -1),
            );
        } else if (trimmedLine.startsWith('msgstr')) {
            state = 'msgstr';
            currentMsg.msgstr = [unescape(trimmedLine.substring(6).trim().slice(1, -1))];
        } else if (trimmedLine.startsWith('"')) {
            const str = unescape(trimmedLine.slice(1, -1));
            if (state === 'msgid') currentMsg.msgid += str;
            else if (state === 'msgid_plural') currentMsg.msgid_plural += str;
            else if (state === 'msgctxt') currentMsg.msgctxt += str;
            else if (state === 'msgstr') currentMsg.msgstr[0] += str;
            else if (state.startsWith('msgstr[')) {
                const match = state.match(/msgstr\[(\d+)\]/);
                const index = parseInt(match[1], 10);
                if (!currentMsg.msgstr[index]) currentMsg.msgstr[index] = '';
                currentMsg.msgstr[index] += str;
            }
        }
    }
    if (currentMsg.msgid !== undefined) messages.push(currentMsg);
    return messages;
}

/**
 * Compila los mensajes al formato binario MO, el que consume gettext.
 *
 * Genera la tabla de cadenas ordenada y las tablas de posiciones que exige la
 * especificación del formato.
 *
 * @param {Array<Object>} messages Mensajes de parsePoForMo.
 * @returns {Uint8Array} Contenido binario del archivo MO.
 */
function compileMo(messages) {
    const textEncoder = new TextEncoder();
    const MAGIC = 0x950412de;
    const REVISION = 0;

    let header = messages.find((m) => m.msgid === '');
    if (header && header.msgstr && header.msgstr[0]) {
        if (!header.msgstr[0].includes('Content-Type')) {
            header.msgstr[0] += '\nContent-Type: text/plain; charset=UTF-8\n';
        }
    } else {
        header = { msgid: '', msgstr: ['Content-Type: text/plain; charset=UTF-8\n'] };
    }

    const translations = messages.filter((m) => m.msgid !== '');

    translations.sort((a, b) => {
        const keyA = (a.msgctxt || '') + '\u0004' + a.msgid;
        const keyB = (b.msgctxt || '') + '\u0004' + b.msgid;
        return keyA.localeCompare(keyB);
    });

    const stringCount = translations.length + 1;
    const headerSize = 28;
    const originalsTableOffset = headerSize;
    const translationsTableOffset = headerSize + stringCount * 8;

    let stringData = [];
    let currentOffset = translationsTableOffset + stringCount * 8;

    stringData.push({
        original: textEncoder.encode(''),
        translation: textEncoder.encode(header.msgstr[0]),
    });

    translations.forEach((msg) => {
        let originalStr;
        if (msg.msgid_plural) {
            originalStr =
                (msg.msgctxt ? msg.msgctxt + '\u0004' : '') +
                msg.msgid +
                '\u0000' +
                msg.msgid_plural;
        } else {
            originalStr = (msg.msgctxt ? msg.msgctxt + '\u0004' : '') + msg.msgid;
        }
        const translationStr = (msg.msgstr || []).join('\u0000');
        stringData.push({
            original: textEncoder.encode(originalStr),
            translation: textEncoder.encode(translationStr),
        });
    });

    const originalsTable = [];
    const translationsTable = [];

    stringData.forEach((data) => {
        originalsTable.push({ length: data.original.length, offset: currentOffset });
        currentOffset += data.original.length + 1;
    });
    stringData.forEach((data) => {
        translationsTable.push({ length: data.translation.length, offset: currentOffset });
        currentOffset += data.translation.length + 1;
    });

    const buffer = new ArrayBuffer(currentOffset);
    const view = new DataView(buffer);
    let byteOffset = 0;

    view.setUint32(byteOffset, MAGIC, true);
    byteOffset += 4;
    view.setUint32(byteOffset, REVISION, true);
    byteOffset += 4;
    view.setUint32(byteOffset, stringCount, true);
    byteOffset += 4;
    view.setUint32(byteOffset, originalsTableOffset, true);
    byteOffset += 4;
    view.setUint32(byteOffset, translationsTableOffset, true);
    byteOffset += 4;
    view.setUint32(byteOffset, 0, true);
    byteOffset += 4;
    view.setUint32(byteOffset, 0, true);
    byteOffset += 4;

    originalsTable.forEach((entry) => {
        view.setUint32(byteOffset, entry.length, true);
        byteOffset += 4;
        view.setUint32(byteOffset, entry.offset, true);
        byteOffset += 4;
    });
    translationsTable.forEach((entry) => {
        view.setUint32(byteOffset, entry.length, true);
        byteOffset += 4;
        view.setUint32(byteOffset, entry.offset, true);
        byteOffset += 4;
    });

    stringData.forEach((data) => {
        new Uint8Array(buffer, byteOffset).set(data.original);
        byteOffset += data.original.length + 1;
    });
    stringData.forEach((data) => {
        new Uint8Array(buffer, byteOffset).set(data.translation);
        byteOffset += data.translation.length + 1;
    });

    return buffer;
}

export { compileMo, parsePoForMo };
