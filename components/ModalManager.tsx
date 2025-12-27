
// components/ModalManager.tsx

import React from 'react';
import { useModal } from '../contexts/ModalContext.tsx';
import { useDecksList, useStore } from '../store/store.ts';
import { useData } from '../contexts/DataManagementContext.tsx';
import { GoogleDriveFile, Deck, DeckType, FlashcardDeck, QuizDeck, LearningDeck } from '../types.ts';
import { useRouter } from '../contexts/RouterContext.tsx';

// Import all modals
import ImportModal from './ImportModal.tsx';
import RestoreModal from './RestoreModal.tsx';
import ResetProgressModal from './ResetProgressModal.tsx';
import ConfirmModal from './ConfirmModal.tsx';
import FolderModal from './FolderModal.tsx';
import EditSeriesModal from './EditSeriesModal.tsx';
import { AIGenerationModal } from './AIGenerationModal.tsx';
import AIGenerationStatusModal from './AIGenerationStatusModal.tsx';
import ServerBackupModal from './ServerBackupModal.tsx';
import DroppedFileConfirmModal from './DroppedFileConfirmModal.tsx';
import AIChatModal from './AIChatModal.tsx';
import RestoreFromDriveModal from './RestoreFromDriveModal.tsx';
import MergeConflictModal from './MergeConflictModal.tsx';
import CommandPalette from './CommandPalette.tsx';
import AddDeckToSeriesModal from './AddDeckToSeriesModal.tsx';
import AIResponseFixModal from './AIResponseFixModal.tsx';
import AIGenerationChatModal from './AIGenerationChatModal.tsx';
import DeckAnalysisModal from './DeckAnalysisModal.tsx';
import WorkloadSimulatorModal from './WorkloadSimulatorModal.tsx';
import JsonViewerModal from './JsonViewerModal.tsx';
import SynthesisConfigModal from './SynthesisConfigModal.tsx';

interface ModalManagerProps {
    driveFiles: GoogleDriveFile[];
}

const ModalManager: React.FC<ModalManagerProps> = ({ driveFiles }) => {
  const { modalType, modalPayload, closeModal, openModal } = useModal();
  const dataHandlers = useData();
  const { aiChatHistory } = useStore();
  const decks = useDecksList();
  const { navigate } = useRouter();

  if (!modalType) {
    return null;
  }

  const payload = modalPayload || {};

  // Helper to extract all items for the simulator
  const getAllReviewables = () => {
      return decks.reduce<any[]>((acc, deck) => {
        if (deck.type === DeckType.Flashcard) {
            return acc.concat((deck as FlashcardDeck).cards || []);
        } else {
            return acc.concat((deck as QuizDeck | LearningDeck).questions || []);
        }
    }, []);
  };

  return (
    <>
      {modalType === 'import' && <ImportModal isOpen={true} onClose={closeModal} onAddDecks={dataHandlers.handleAddDecks} onAddSeriesWithDecks={dataHandlers.handleAddSeriesWithDecks} />}
      {modalType === 'restore' && <RestoreModal isOpen={true} onClose={closeModal} onCompare={dataHandlers.handleCompareBackup} onRestoreSelected={dataHandlers.handleRestoreSelectedItems} file={payload.file} onFullRestore={dataHandlers.onRestoreData} openConfirmModal={(p: any) => openModal('confirm', p)} />}
      {modalType === 'resetProgress' && <ResetProgressModal isOpen={true} onClose={closeModal} onReset={dataHandlers.handleResetDeckProgress} decks={decks} />}
      {modalType === 'confirm' && <ConfirmModal isOpen={true} onClose={closeModal} {...payload} />}
      {modalType === 'folder' && <FolderModal isOpen={true} onClose={closeModal} onSave={dataHandlers.handleSaveFolder} folder={payload.folder === 'new' ? null : payload.folder} />}
      {modalType === 'series' && <EditSeriesModal isOpen={true} onClose={closeModal} onSave={dataHandlers.handleSaveSeries} series={payload.series === 'new' ? null : payload.series} />}
      {modalType === 'aiGeneration' && <AIGenerationModal isOpen={true} onClose={closeModal} onStartAIGeneration={dataHandlers.handleStartAIGeneration} initialTopic={payload.initialTopic} context={payload.context} />}
      {modalType === 'aiGenerationChat' && <AIGenerationChatModal isOpen={true} onClose={closeModal} params={payload.params} />}
      {modalType === 'aiStatus' && <AIGenerationStatusModal isOpen={true} onClose={closeModal} onCancel={dataHandlers.handleCancelAIGeneration} />}
      {modalType === 'serverBackup' && <ServerBackupModal isOpen={true} onClose={closeModal} onRestore={dataHandlers.handleRestoreFromServerBackup} onDelete={dataHandlers.handleDeleteServerBackup} />}
      {modalType === 'droppedFile' && <DroppedFileConfirmModal isOpen={true} onClose={closeModal} onConfirm={dataHandlers.handleDroppedFileConfirm} analysis={payload.analysis} />}
      {modalType === 'aiChat' && <AIChatModal isOpen={true} onClose={closeModal} onExecuteAction={dataHandlers.handleExecuteAIAction} history={aiChatHistory} />}
      {modalType === 'restoreFromDrive' && <RestoreFromDriveModal isOpen={true} onClose={closeModal} onRestore={dataHandlers.handleRestoreFromDrive} files={driveFiles} />}
      {modalType === 'addDeckToSeries' && <AddDeckToSeriesModal isOpen={true} onClose={closeModal} onAddDeck={(newDeck) => dataHandlers.handleAddDeckToSeries(payload.seriesId, newDeck)} />}
      {modalType === 'mergeConflict' && <MergeConflictModal isOpen={true} onClose={closeModal} onResolve={dataHandlers.handleMergeResolution} comparison={payload.comparison} remoteData={payload.remoteData} />}
      {modalType === 'commandPalette' && <CommandPalette 
          isOpen={true} 
          onClose={closeModal} 
          actions={[
            { id: 'import', label: 'Create / Import Deck', icon: 'plus', action: () => openModal('import'), keywords: ['new', 'add'] },
            { id: 'settings', label: 'Settings', icon: 'settings', action: () => navigate('/settings') },
            { id: 'trash', label: 'View Trash', icon: 'trash-2', action: () => navigate('/trash') },
            { id: 'archive', label: 'View Archive', icon: 'archive', action: () => navigate('/archive') },
            { id: 'progress', label: 'View Progress', icon: 'trending-up', action: () => navigate('/progress') },
            { id: 'simulate', label: 'Simulate Workload', icon: 'trending-up', action: () => openModal('workloadSimulator') },
          ]}
      />}
      {modalType === 'aiResponseFix' && <AIResponseFixModal isOpen={true} onClose={closeModal} {...payload} />}
      {modalType === 'deckAnalysis' && <DeckAnalysisModal isOpen={true} onClose={closeModal} deck={payload.deck} onUpdateDeck={dataHandlers.handleUpdateDeck} />}
      {modalType === 'workloadSimulator' && <WorkloadSimulatorModal isOpen={true} onClose={closeModal} items={getAllReviewables()} />}
      {modalType === 'viewJson' && <JsonViewerModal isOpen={true} onClose={closeModal} {...payload} />}
      {modalType === 'synthesisConfig' && <SynthesisConfigModal isOpen={true} onClose={closeModal} {...payload} />}
    </>
  );
};

export default ModalManager;
