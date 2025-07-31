
const SYNC_CHANNEL_NAME = 'cogniflow-sync';

// Ensure channel is created only once.
let channel: BroadcastChannel | null = null;
const getChannel = (): BroadcastChannel => {
    if (!channel) {
        channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    }
    return channel;
};

/**
 * Broadcasts a message to other tabs that data has changed.
 */
export const broadcastDataChange = () => {
    getChannel().postMessage({ type: 'data-changed' });
};

/**
 * Listens for data change messages from other tabs.
 * @param callback The function to call when data changes.
 * @returns A function to unsubscribe from the listener.
 */
export const onDataChange = (callback: () => void): (() => void) => {
    const channelInstance = getChannel();
    const handler = () => {
        // Any message on this channel means "sync".
        // This is simple and robust. The callback reloads data, which is idempotent.
        callback();
    };
    channelInstance.addEventListener('message', handler);

    return () => {
        channelInstance.removeEventListener('message', handler);
    };
};
