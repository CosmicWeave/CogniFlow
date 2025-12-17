
export const stripHtml = (html: string | undefined): string => {
    if (!html) return "";
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    } catch (e) {
        // Fallback for invalid HTML or environments where DOMParser is not available.
        // A simple regex might not be perfect but is a decent fallback.
        return String(html).replace(/<[^>]+>/g, '');
    }
};

/**
 * Decodes and plays raw PCM audio data (from Gemini TTS) using the Web Audio API.
 * @param base64Audio Base64 encoded audio string
 * @param sampleRate The sample rate of the audio (default 24000 for Gemini TTS)
 */
export const playPcmAudio = async (base64Audio: string, sampleRate = 24000): Promise<void> => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext({ sampleRate });
    
    // Convert 16-bit PCM to Float32 AudioBuffer
    // Gemini returns single channel 16-bit PCM
    const dataInt16 = new Int16Array(bytes.buffer);
    const numChannels = 1;
    const frameCount = dataInt16.length / numChannels;
    const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
    
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            // Normalize 16-bit integer to -1.0 to 1.0 float
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
    
    // Clean up context after playback
    return new Promise((resolve) => {
        source.onended = () => {
            audioContext.close();
            resolve();
        };
    });
};
