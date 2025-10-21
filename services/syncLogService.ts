import { SyncLogEntry } from '../types';

const LOG_KEY = 'cogniflow-sync-log';
const MAX_LOG_ENTRIES = 20;

export const addSyncLog = (message: string, type: SyncLogEntry['type']) => {
    try {
        const logString = localStorage.getItem(LOG_KEY);
        const logs: SyncLogEntry[] = logString ? JSON.parse(logString) : [];
        const newLog: SyncLogEntry = { timestamp: new Date().toISOString(), message, type };
        const updatedLogs = [newLog, ...logs].slice(0, MAX_LOG_ENTRIES);
        localStorage.setItem(LOG_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
        console.error("Failed to write to sync log", e);
    }
};

export const getSyncLog = (): SyncLogEntry[] => {
    try {
        const logString = localStorage.getItem(LOG_KEY);
        return logString ? JSON.parse(logString) : [];
    } catch (e) {
        console.error("Failed to read sync log", e);
        return [];
    }
};

export const clearSyncLog = () => {
    localStorage.removeItem(LOG_KEY);
};
