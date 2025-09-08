
import { useCallback } from 'react';
import * as googleDriveService from '../../services/googleDriveService';

// This factory function creates handlers specifically for Google Drive operations.
export const createDriveHandlers = ({ addToast, openConfirmModal, openRestoreFromDriveModal, setDriveFiles, handleRestoreData }: any) => {

  const handleGoogleSignIn = useCallback(() => {
    googleDriveService.requestManualSignIn();
  }, []);
  
  const handleGoogleSignOut = useCallback(() => {
    googleDriveService.signOut();
    addToast("Signed out of Google Drive.", "info");
  }, [addToast]);
  
  const handleBackupToDrive = useCallback(() => {
    openConfirmModal({
        title: 'Backup to Google Drive',
        message: 'This will create a new backup file in a private application folder in your Google Drive. Are you sure?',
        onConfirm: async () => {
            try {
                const file = await googleDriveService.backup();
                addToast(`Successfully created backup: ${file.name}`, 'success');
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to create backup.";
                addToast(message, 'error');
            }
        }
    });
  }, [addToast, openConfirmModal]);

  const handleListDriveFiles = useCallback(async () => {
    try {
        const files = await googleDriveService.listFiles();
        setDriveFiles(files);
        openRestoreFromDriveModal();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to list files from Google Drive.";
        addToast(message, 'error');
    }
  }, [addToast, setDriveFiles, openRestoreFromDriveModal]);

  const handleRestoreFromDrive = useCallback(async (fileId: string) => {
    openConfirmModal({
        title: 'Restore from Google Drive',
        message: 'Restoring from a backup will merge and overwrite data. Decks and folders with the same ID will be replaced. This action cannot be undone. Are you sure?',
        onConfirm: async () => {
            try {
                const data = await googleDriveService.downloadFile(fileId);
                await handleRestoreData(data); // Re-use the main restore logic
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to restore from backup.";
                addToast(message, 'error');
            }
        }
    });
  }, [addToast, openConfirmModal, handleRestoreData]);

  return {
    handleGoogleSignIn,
    handleGoogleSignOut,
    handleBackupToDrive,
    handleListDriveFiles,
    handleRestoreFromDrive,
    openRestoreFromDriveModal: handleListDriveFiles, // The action to open the modal should first list the files
  };
};
