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
    const { path } = useRouter();

    const [pathname, queryString] = path.split('?');
    const isHomePage = pathname === '/';
    
    const isStudySessionPath = (p: string) => {
        if (p === '/study/general') return true;
        if (p.startsWith('/decks/')) {
            const parts = p.split('/');
            const lastPart = parts[parts.length - 1];
            return ['study', 'cram', 'study-reversed', 'study-flip'].includes(lastPart);
        }
        return false;
    };
    const isStudyPage = isStudySessionPath(pathname);

    let headerContent;

    if (isHomePage) {
        headerContent = <Link href="/" className="no-underline"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">CogniFlow</h1></Link>;
    } else {
        let backHref = '/'; // Default to home
        let backButtonText: React.ReactNode = "Back";

        if (isStudyPage) {
            const deckName = activeDeck?.name || (pathname === '/study/general' ? 'General Study' : 'Back');
            backButtonText = <span className="truncate">{deckName}</span>;
            
            const params = new URLSearchParams(queryString);
            const seriesId = params.get('seriesId');
            const fromPath = params.get('from');
            
            if (fromPath) {
                backHref = decodeURIComponent(fromPath);
            } else {
                const deckId = pathname.split('/')[2];
                // From a study session, always go back to the deck/series page
                backHref = seriesId ? `/series/${seriesId}` : `/decks/${deckId}`;
            }
            
        } else if (pathname.startsWith('/decks/')) {
            const params = new URLSearchParams(queryString);
            const seriesId = params.get('seriesId');
            backHref = seriesId ? `/series/${seriesId}` : '/decks';
        } else if (pathname.startsWith('/series/')) {
            backHref = '/series';
        } else if (['/decks', '/series', '/settings', '/archive', '/trash', '/progress', '/instructions/json'].includes(pathname)) {
            backHref = '/';
        }

        headerContent = (
            <Link href={backHref} passAs={Button} variant="ghost" className="flex items-center space-x-2 -ml-3 min-w-0">
                <Icon name="chevron-left" />
                {backButtonText}
            </Link>
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
