
import React from 'react';
import { useModal } from '../contexts/ModalContext';
import { useStore } from '../store/store';
import { useData } from '../contexts/DataManagementContext';
import { GoogleDriveFile } from '../types';
import { useRouter } from '../contexts/RouterContext';

// Import all modals
import ImportModal from './ImportModal';
import RestoreModal from './RestoreModal';
import ResetProgressModal from './ResetProgressModal';
import ConfirmModal from './ConfirmModal';
import FolderModal from './FolderModal';
import EditSeriesModal from './EditSeriesModal';
import AIGenerationModal from './AIGenerationModal';
import AIGenerationStatusModal from './AIGenerationStatusModal';
import ServerBackupModal from './ServerBackupModal';
import DroppedFileConfirmModal from './DroppedFileConfirmModal';
import AIChatModal from './AIChatModal';
import RestoreFromDriveModal from './RestoreFromDriveModal';
import MergeConflictModal from './MergeConflictModal';
import CommandPalette from './CommandPalette';
import AddDeckToSeriesModal from './AddDeckToSeriesModal';

interface ModalManagerProps {
    driveFiles: GoogleDriveFile[];
}

const ModalManager: React.FC<ModalManagerProps> = ({ driveFiles }) => {
  const { modalType, modalPayload, closeModal, openModal } = useModal();
  const dataHandlers = useData();
  const { decks, aiChatHistory } = useStore();
  const { navigate } = useRouter();

  if (!modalType) {
    return null;
  }

  const payload = modalPayload || {};

  return (
    <>
      {modalType === 'import' && <ImportModal isOpen={true} onClose={closeModal} onAddDecks={dataHandlers.handleAddDecks} onAddSeriesWithDecks={dataHandlers.handleAddSeriesWithDecks} />}
      {modalType === 'restore' && <RestoreModal isOpen={true} onClose={closeModal} onRestore={dataHandlers.handleRestoreData} />}
      {modalType === 'resetProgress' && <ResetProgressModal isOpen={true} onClose={closeModal} onReset={dataHandlers.handleResetDeckProgress} decks={decks} />}
      {modalType === 'confirm' && <ConfirmModal isOpen={true} onClose={closeModal} {...payload} />}
      {modalType === 'folder' && <FolderModal isOpen={true} onClose={closeModal} onSave={dataHandlers.handleSaveFolder} folder={payload.folder === 'new' ? null : payload.folder} />}
      {modalType === 'series' && <EditSeriesModal isOpen={true} onClose={closeModal} onSave={dataHandlers.handleSaveSeries} series={payload.series === 'new' ? null : payload.series} />}
      {modalType === 'aiGeneration' && <AIGenerationModal isOpen={true} onClose={closeModal} onGenerate={dataHandlers.handleGenerateWithAI} />}
      {modalType === 'aiStatus' && <AIGenerationStatusModal isOpen={true} onClose={closeModal} onCancel={dataHandlers.handleCancelAIGeneration} />}
      {modalType === 'serverBackup' && <ServerBackupModal isOpen={true} onClose={closeModal} onRestore={dataHandlers.handleRestoreFromServerBackup} onDelete={dataHandlers.handleDeleteServerBackup} />}
      {modalType === 'droppedFile' && <DroppedFileConfirmModal isOpen={true} onClose={closeModal} onConfirm={dataHandlers.handleDroppedFileConfirm} analysis={payload.analysis} />}
      {modalType === 'aiChat' && <AIChatModal isOpen={true} onClose={closeModal} onExecuteAction={dataHandlers.handleExecuteAIAction} history={aiChatHistory} />}
      {modalType === 'restoreFromDrive' && <RestoreFromDriveModal isOpen={true} onClose={closeModal} onRestore={dataHandlers.handleRestoreFromDrive} files={driveFiles} />}
      {modalType === 'addDeckToSeries' && <AddDeckToSeriesModal isOpen={true} onClose={closeModal} onAddDeck={(newDeck) => dataHandlers.handleAddDeckToSeries(payload.seriesId, newDeck)} />}
      {modalType === 'mergeConflict' && <MergeConflictModal isOpen={true} onClose={closeModal} onResolve={dataHandlers.handleMergeResolution} localData={payload.localData} remoteData={payload.remoteData} />}
      {modalType === 'commandPalette' && <CommandPalette 
          isOpen={true} 
          onClose={closeModal} 
          actions={[
            { id: 'import', label: 'Create / Import Deck', icon: 'plus', action: () => openModal('import'), keywords: ['new', 'add'] },
            { id: 'settings', label: 'Settings', icon: 'settings', action: () => navigate('/settings') },
            { id: 'trash', label: 'View Trash', icon: 'trash-2', action: () => navigate('/trash') },
            { id: 'archive', label: 'View Archive', icon: 'archive', action: () => navigate('/archive') },
            { id: 'progress', label: 'View Progress', icon: 'trending-up', action: () => navigate('/progress') },
          ]}
      />}
    </>
  );
};

export default ModalManager;