
import React, { createContext, useState, useContext, ReactNode, useCallback, useRef } from 'react';

// Define all possible modal types
export type ModalType =
  | 'import'
  | 'restore'
  | 'resetProgress'
  | 'confirm'
  | 'folder'
  | 'series'
  | 'aiGeneration'
  | 'aiStatus'
  | 'serverBackup'
  | 'droppedFile'
  | 'aiChat'
  | 'restoreFromDrive'
  | 'addDeckToSeries'
  | 'commandPalette'
  | 'mergeConflict'
  | 'aiResponseFix'
  | 'aiGenerationChat'
  | 'deckAnalysis'
  | 'workloadSimulator'; // Added

// Define the shape of the modal payload. It can be anything.
export type ModalPayload = any;

interface ModalContextType {
  modalType: ModalType | null;
  modalPayload: ModalPayload;
  openModal: (type: ModalType, payload?: ModalPayload) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<{ type: ModalType | null; payload: ModalPayload }>({
    type: null,
    payload: null,
  });
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const openModal = useCallback((type: ModalType, payload: ModalPayload = {}) => {
    triggerElementRef.current = document.activeElement as HTMLElement;
    setModal({ type, payload });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: null, payload: null });
    // Restore focus to the element that opened the modal
    setTimeout(() => triggerElementRef.current?.focus(), 100);
  }, []);

  return (
    <ModalContext.Provider value={{ modalType: modal.type, modalPayload: modal.payload, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};
