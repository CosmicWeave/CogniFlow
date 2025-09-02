import React from 'react';
import type { InfoCard } from '../types';
import DangerousHtmlRenderer from './ui/DangerousHtmlRenderer';

interface InfoCardDisplayProps {
  infoCard: InfoCard;
}

const InfoCardDisplay: React.FC<InfoCardDisplayProps> = ({ infoCard }) => {
  const contentClasses = "text-lg text-left text-text break-words prose dark:prose-invert max-w-none prose-img:mx-auto prose-img:max-h-64";

  return (
    <div className="w-full bg-surface rounded-lg shadow-lg border border-border">
      <div className="p-6 md:p-8 min-h-[12rem] flex items-center justify-center">
        <DangerousHtmlRenderer
          html={infoCard.content}
          className={contentClasses}
        />
      </div>
    </div>
  );
};

export default InfoCardDisplay;
