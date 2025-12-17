
import { useState, useEffect } from 'react';

// Define the event type, as it's not standard in all TS lib versions.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const useInstallPrompt = (): [BeforeInstallPromptEvent | null, () => void, boolean] => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setPromptEvent(e as BeforeInstallPromptEvent);
      
      // Check criteria for showing the prompt (e.g., meaningful engagement)
      // For now, we use a simple timer or session check, but this could check DB/LocalStorage
      const hasDismissed = localStorage.getItem('cogniflow-install-dismissed');
      if (!hasDismissed) {
          // Show after a delay to ensure user has interacted with the app a bit
          setTimeout(() => setShouldShowPrompt(true), 10000); 
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    if (!promptEvent) {
      return;
    }
    // Show the install prompt
    promptEvent.prompt();
    // Wait for the user to respond to the prompt
    promptEvent.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
        // Remember dismissal
        localStorage.setItem('cogniflow-install-dismissed', 'true');
      }
      setShouldShowPrompt(false);
      // We can only use the prompt once, so clear it.
      setPromptEvent(null);
    });
  };

  return [promptEvent, handleInstall, shouldShowPrompt];
};
