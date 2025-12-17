
import React from 'react';
import Button from './Button';
import Icon from './Icon';

interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

const InstallBanner: React.FC<InstallBannerProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-in-up">
      <div className="bg-primary text-on-primary rounded-lg shadow-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
                <Icon name="download" className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold">Install CogniFlow</h3>
                <p className="text-sm opacity-90">Add to your home screen for the best experience.</p>
            </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onDismiss} className="flex-1 sm:flex-none border-transparent text-primary hover:bg-white">Not Now</Button>
            <Button variant="secondary" onClick={onInstall} className="flex-1 sm:flex-none bg-white text-primary hover:bg-white/90 font-bold border-transparent">Install</Button>
        </div>
      </div>
    </div>
  );
};

export default InstallBanner;
