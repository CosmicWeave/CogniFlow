import React from 'react';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { useModal } from '../contexts/ModalContext.tsx';
import { useSettings } from '../hooks/useSettings.ts';

const AIChatFab: React.FC = () => {
    const { openModal } = useModal();
    const { aiFeaturesEnabled } = useSettings();

    const handleOpenChat = () => {
        openModal('aiChat');
    };

    if (!aiFeaturesEnabled) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-40 animate-fade-in">
            <Button 
                variant="primary" 
                onClick={handleOpenChat}
                className="rounded-full w-16 h-16 shadow-lg flex items-center justify-center"
                aria-label="Open AI Assistant"
            >
                <Icon name="bot" className="w-8 h-8"/>
            </Button>
        </div>
    );
};

export default AIChatFab;