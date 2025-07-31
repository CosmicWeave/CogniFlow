import type { Deck } from '../types';

/**
 * Parses an Anki package (.apkg) file by offloading the work to a Web Worker.
 * This prevents the main thread from freezing while parsing large files.
 * @param fileBuffer The ArrayBuffer of the .apkg file.
 * @returns A promise that resolves with an array of imported Decks.
 */
export function parseAnkiPkg(fileBuffer: ArrayBuffer): Promise<Deck[]> {
    return new Promise((resolve, reject) => {
        // Create a new worker. The URL is relative to the current module's location.
        const worker = new Worker(new URL('./ankiImport.worker.ts', import.meta.url), {
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
            reject(new Error(`Anki import worker failed: ${e.message}`));
            worker.terminate();
        };

        // Send the file buffer to the worker to start parsing.
        // The buffer is transferred, not copied, for performance.
        worker.postMessage(fileBuffer, [fileBuffer]);
    });
}
