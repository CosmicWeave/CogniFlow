import React from 'react';
import { useRouter } from '../contexts/RouterContext';
import { Deck } from '../types';
import Button from './ui/Button';
import Icon from './ui/Icon';
import ThemeToggle from './ui/ThemeToggle';
import Link from './ui/Link';

interface HeaderProps {
    onOpenMenu: () => void;
    activeDeck: Deck | null;
}

const Header: React.FC<HeaderProps> = ({ onOpenMenu, activeDeck }) => {
    const { path, navigate } = useRouter();

    let headerContent;

    const logoTextSpan = <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">CogniFlow</span>;
    const activeDeckId = activeDeck?.id;

    if (path.startsWith('/decks/') && path.endsWith('/study')) {
        const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId');
        const backPath = seriesId ? `/series/${seriesId}` : (activeDeckId ? `/decks/${activeDeckId}`: '/');
        headerContent = <Button variant="ghost" onClick={() => navigate(backPath)} className="flex items-center space-x-2 -ml-3"><Icon name="chevron-left" /><span className="truncate">{activeDeck?.name || 'Back'}</span></Button>;
    } else if (path.startsWith('/decks/')) { // Deck Details Page
        const seriesId = new URLSearchParams(window.location.hash.split('?')[1]).get('seriesId');
        if (seriesId) {
            headerContent = <Button variant="ghost" onClick={() => navigate(`/series/${seriesId}`)} className="flex items-center space-x-2 -ml-3"><Icon name="chevron-left" /><span>Back to Series</span></Button>;
        } else {
            headerContent = <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center space-x-2 -ml-3"><Icon name="chevron-left" />{logoTextSpan}</Button>;
        }
    } else if (path.startsWith('/series/') || path === '/study/general' || path === '/settings' || path === '/instructions/json' || path === '/archive' || path === '/trash') {
        headerContent = <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center space-x-2 -ml-3"><Icon name="chevron-left" />{logoTextSpan}</Button>;
    } else {
        // Home page
        headerContent = <Link href="/" className="no-underline"><h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">CogniFlow</h1></Link>;
    }

    return (
        <header className="bg-white/80 dark:bg-gray-800/30 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                <div className="flex-1 min-w-0">{headerContent}</div>
                <div className="flex items-center space-x-1">
                    <Button variant="ghost" onClick={onOpenMenu} className="p-1 h-auto" aria-label="Open menu"><Icon name="menu" /></Button>
                </div>
            </nav>
        </header>
    );
};

export default Header;