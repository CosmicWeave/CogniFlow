
import { Deck, Card, DeckType, FlashcardDeck } from '../types';
import { INITIAL_EASE_FACTOR, MIN_EASE_FACTOR } from '../constants';
import JSZip from 'jszip';
import initSqlJs, { type SqlJsStatic } from 'sql.js';

/**
 * Parses an Anki package (.apkg) file by offloading the work to a Web Worker.
 * This prevents the main thread from freezing while parsing large files.
 * @param fileBuffer The ArrayBuffer of the .apkg file.
 * @returns A promise that resolves with an array of imported Decks.
 */
export function parseAnkiPkg(fileBuffer: ArrayBuffer): Promise<Deck[]> {
    return new Promise((resolve, reject) => {
        // Construct an absolute URL for the worker from the current origin
        // to prevent cross-origin loading errors in certain environments.
        const workerUrl = new URL('/services/ankiImport.worker.ts', window.location.origin);
        
        const worker = new Worker(workerUrl, {
            type: 'module'
        });
        
        // Listen for messages from the worker.
        worker.onmessage = (e: MessageEvent) => {
            const { status, decks, error } = e.data;
            if (status === 'success') {
                resolve(decks as Deck[]);
            } else {
                reject(new Error(error));
            }
            worker.terminate();
        };
        
        // Listen for errors from the worker itself (e.g., script not found).
        worker.onerror = (e) => {
            console.error('Worker error:', e);
            const errorMessage = e.message || 'The worker script could not be loaded or an unexpected error occurred.';
            reject(new Error(`Anki import worker failed: ${errorMessage}`));
            worker.terminate();
        };

        // Send the file buffer to the worker to start parsing.
        // The buffer is transferred, not copied, for performance.
        worker.postMessage(fileBuffer, [fileBuffer]);
    });
}


// --- Main thread fallback implementation ---
// This code is duplicated from the ankiImport.worker.ts file to provide
// a fallback in case the worker fails to load or execute.

let SQL: SqlJsStatic | null = null;

interface AnkiNote {
    mid: number;
    flds: string[];
}

interface AnkiModelField {
    name: string;
}

async function getSqlJs(): Promise<SqlJsStatic> {
    if (!SQL) {
        SQL = await initSqlJs({ locateFile: file => `https://esm.sh/sql.js@1.10.3/dist/${file}` });
    }
    return SQL;
}

type MediaFile = { data: Uint8Array; type: string };

function processMedia(html: string, mediaFiles: Map<string, MediaFile>): string {
    let processedHtml = html;
    processedHtml = processedHtml.replace(/<img\s[^>]*?src=(["'])(.*?)\1[^>]*?>/gi, (match, _quote, filename) => {
        const decodedFilename = decodeURIComponent(filename);
        const mediaFile = mediaFiles.get(decodedFilename);
        if (mediaFile) {
            const base64 = btoa(new Uint8Array(mediaFile.data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            const newSrc = `src="data:${mediaFile.type};base64,${base64}"`;
            return match.replace(/src=(["']).*?\1/i, newSrc);
        }
        return match;
    });
    processedHtml = processedHtml.replace(/\[sound:(.*?)\]/g, (match, filename) => {
        const decodedFilename = decodeURIComponent(filename.trim());
        const mediaFile = mediaFiles.get(decodedFilename);
        if (mediaFile) {
            const base64 = btoa(new Uint8Array(mediaFile.data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            return `<audio controls src="data:${mediaFile.type};base64,${base64}"></audio>`;
        }
        return '';
    });
    return processedHtml;
}

function renderAnkiTemplate(template: string, fields: Map<string, string>, ord: number, isFront: boolean, frontSideContent?: string): string {
    let output = template;
    const clozeRegex = /{{c(\d+)::(.*?)(?:::(.*?))?}}/gs;
    output = output.replace(clozeRegex, (_, clozeIndexStr, text, hint) => {
        const clozeIndex = parseInt(clozeIndexStr, 10);
        if (isFront) {
            return (clozeIndex === ord + 1) ? `<span class="cloze">[${hint || '...'}]</span>` : `<span class="cloze-inactive">${text}</span>`;
        }
        return (clozeIndex === ord + 1) ? `<span class="cloze"><b>${text}</b></span>` : `<span class="cloze-inactive">${text}</span>`;
    });

    if (frontSideContent) {
        output = output.replace(/<hr id=answer>/g, '').replace(/{{FrontSide}}/g, frontSideContent);
    }
    
    const conditionalRegex = /{{#([^}]+?)}}(.*?){{\/\1}}/gs;
    let prevOutput;
    do {
        prevOutput = output;
        output = output.replace(conditionalRegex, (_, fieldName, content) => {
             const fieldValue = fields.get(fieldName.trim());
             return (fieldValue && fieldValue.trim() !== '') ? content : '';
        });
    } while (output !== prevOutput);

    const invertedConditionalRegex = /{{\^([^}]+?)}}(.*?){{\/\1}}/gs;
    do {
        prevOutput = output;
        output = output.replace(invertedConditionalRegex, (_, fieldName, content) => {
            const fieldValue = fields.get(fieldName.trim());
            return (!fieldValue || fieldValue.trim() === '') ? content : '';
        });
    } while (output !== prevOutput);

    fields.forEach((value, key) => {
        const fieldPlaceholder = new RegExp(`{{${key}}}`, 'g');
        output = output.replace(fieldPlaceholder, value);
    });

    output = output.replace(/{{(.*?)}}/g, '');
    return output;
}

/**
 * Fallback Anki parser that runs on the main thread.
 * This can cause the UI to freeze with large files.
 * @param fileBuffer The ArrayBuffer of the .apkg file.
 * @returns A promise that resolves with an array of imported Decks.
 */
export async function parseAnkiPkgMainThread(fileBuffer: ArrayBuffer): Promise<Deck[]> {
    const sql = await getSqlJs();
    const zip = await JSZip.loadAsync(fileBuffer);
    const dbFileArray = zip.file(/collection.anki2[1]?/);
    if (!dbFileArray || dbFileArray.length === 0) throw new Error('collection.anki2 or .anki21 file not found.');
    
    const dbFileContent = await dbFileArray[0].async('uint8array');
    const db = new sql.Database(dbFileContent);

    const mediaFile = zip.file('media');
    let mediaMap: Record<string, string> = {};
    if (mediaFile) {
        try {
            mediaMap = JSON.parse(await mediaFile.async('string'));
        } catch (e) {
            console.warn("Could not parse media file.", e);
        }
    }
    
    const mediaFiles = new Map<string, MediaFile>();
    for(const key in mediaMap) {
        const filename = mediaMap[key];
        const file = zip.file(key);
        if(file) {
            const data = await file.async('uint8array');
            const extension = filename.split('.').pop()?.toLowerCase() || '';
            let mimeType = 'application/octet-stream';
            if (['jpg', 'jpeg'].includes(extension)) mimeType = 'image/jpeg';
            else if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'gif') mimeType = 'image/gif';
            else if (extension === 'svg') mimeType = 'image/svg+xml';
            else if (extension === 'mp3') mimeType = 'audio/mpeg';
            else if (extension === 'ogg') mimeType = 'audio/ogg';
            else if (extension === 'wav') mimeType = 'audio/wav';
            mediaFiles.set(filename, { data, type: mimeType });
        }
    }

    const colQueryRes = db.exec("SELECT models, decks, crt FROM col");
    if (!colQueryRes[0]) throw new Error('Could not read collection data.');
    
    const [modelsStr, decksStr, collectionCreationTime] = colQueryRes[0].values[0];
    const models = JSON.parse(modelsStr as string);
    const decks = JSON.parse(decksStr as string);
    
    const notesRes = db.exec("SELECT id, mid, flds FROM notes");
    const notes = new Map<number, AnkiNote>(notesRes[0].values.map(row => [
        row[0] as number, { mid: row[1] as number, flds: (row[2] as string).split('\x1f') }
    ]));
    
    const cardsRes = db.exec("SELECT id, nid, did, ord, due, ivl, factor, type, lapses FROM cards");
    const allCards = cardsRes[0].values;
    const importedDecks = new Map<string, FlashcardDeck>();

    for(const deckId in decks) {
        const deckInfo = decks[deckId];
        importedDecks.set(deckId, {
            id: crypto.randomUUID(), name: deckInfo.name,
            description: deckInfo.desc || `Imported Anki deck.`,
            type: DeckType.Flashcard, cards: []
        });
    }

    for (const cardData of allCards) {
        const [cardId, noteId, deckId, ord, due, interval, easeFactor, cardType, lapses] = cardData as [number, number, number, number, number, number, number, number, number];
        const note = notes.get(noteId);
        if (!note) continue;
        const model = models[note.mid];
        if (!model?.tmpls) continue;
        const deck = importedDecks.get(deckId.toString());
        if (!deck) continue;
        const template = model.tmpls[ord];
        if (!template) continue;
        
        const fieldMap = new Map((model.flds as AnkiModelField[] || []).map((f, i) => [f.name, note.flds[i] || '']));
        let frontContent = renderAnkiTemplate(template.qfmt, fieldMap, ord, true);
        let backContent = renderAnkiTemplate(template.afmt, fieldMap, ord, false, frontContent);
        frontContent = processMedia(frontContent, mediaFiles);
        backContent = processMedia(backContent, mediaFiles);

        let dueDate: Date;
        let lastReviewedDate: Date | undefined = undefined;

        if (cardType === 2 && interval > 0) { // review card
             dueDate = new Date((collectionCreationTime as number) * 1000);
             dueDate.setDate(dueDate.getDate() + (due as number));
             lastReviewedDate = new Date(dueDate.getTime());
             lastReviewedDate.setDate(lastReviewedDate.getDate() - interval);
        } else { // new or learning card
             dueDate = new Date();
             dueDate.setHours(0,0,0,0);
        }

        const masteryLevel = Math.min(1, Math.log1p(interval) / Math.log1p(90));

        deck.cards.push({
            id: cardId.toString(), front: frontContent, back: backContent,
            css: model.css ? `<style>${model.css}</style>` : '',
            dueDate: dueDate.toISOString(), interval: interval,
            easeFactor: easeFactor ? Math.max(easeFactor / 1000, MIN_EASE_FACTOR) : INITIAL_EASE_FACTOR,
            masteryLevel,
            lastReviewed: lastReviewedDate?.toISOString(),
            lapses: lapses || 0,
        });
    }
    
    db.close();
    return Array.from(importedDecks.values()).filter(d => d.cards.length > 0);
}
