
import React from 'react';
import { useRouter } from '../contexts/RouterContext.tsx';
import { Deck } from '../types.ts';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';
import Link from './ui/Link.tsx';

interface HeaderProps {
    onOpenMenu: () => void;
    onOpenCommandPalette: () => void;
    activeDeck: Deck | null;
    isVisible: boolean;
}

const Header: React.FC<HeaderProps> = ({ onOpenMenu, onOpenCommandPalette, activeDeck, isVisible }) => {
    const { path, goBack, canGoBack } = useRouter();

    const [pathname] = path.split('?');
    const isHomePage = pathname === '/';
    
    let headerContent;

    if (isHomePage) {
        headerContent = <Link href="/" className="no-underline"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">CogniFlow</h1></Link>;
    } else {
        // Use generic "Back" text or try to be context aware if possible, 
        // but for pure history, "Back" is safest.
        // We can display the active deck name if available for context, essentially as a title.
        let titleText = "Back";
        if (activeDeck) {
            titleText = activeDeck.name;
        } else if (pathname === '/study/general') {
            titleText = "General Study";
        } else if (pathname === '/settings') {
            titleText = "Settings";
        }

        // If we can't go back (e.g. refresh on sub-page), we still show the title but maybe with a Home link or disabled back button?
        // Standard UX: If deep linked and no history, "Back" might go Home or be hidden.
        // The router's goBack implementation falls back to Home if history is empty.
        
        headerContent = (
            <Button 
                variant="ghost" 
                onClick={goBack} 
                className="flex items-center space-x-2 -ml-3 min-w-0"
                aria-label="Go Back"
            >
                <Icon name="chevron-left" />
                <span className="truncate">{titleText}</span>
            </Button>
        );
    }

    return (
        <header className={`bg-surface/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-20 border-b border-border transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                <div className="flex items-center flex-1 min-w-0">{headerContent}</div>
                <div className="flex items-center space-x-1">
                    <Button variant="ghost" onClick={onOpenCommandPalette} className="p-1 h-auto" aria-label="Open command palette">
                        <Icon name="search" />
                    </Button>
                    <Button variant="ghost" onClick={onOpenMenu} className="p-1 h-auto" aria-label="Open menu"><Icon name="menu" /></Button>
                </div>
            </nav>
        </header>
    );
};

export default Header;
