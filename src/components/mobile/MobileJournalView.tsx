import * as React from 'react';
import { TripJournalFeed } from '../journal/TripJournalFeed';
import { TripPhotoAlbum } from '../journal/TripPhotoAlbum';
import { useShellMode } from '../../hooks/useShellMode';
import chrome from './MobileTabChrome.module.css';

export const MobileJournalView: React.FC = () => {
  const [sub, setSub] = React.useState<'journal' | 'photos'>('journal');
  const shellMode = useShellMode();

  return (
    <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      <h1 className={chrome.pageTitle}>Journal</h1>
      <p className={chrome.pageSub}>Entries and photos from your trip</p>

      <div className={chrome.segmented} role="tablist" aria-label="Journal or photos">
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'journal'}
          className={`${chrome.segmentBtn} ${sub === 'journal' ? chrome.segmentActive : ''}`}
          onClick={() => setSub('journal')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 4h14v16H5V4ZM8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Journal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === 'photos'}
          className={`${chrome.segmentBtn} ${sub === 'photos' ? chrome.segmentActive : ''}`}
          onClick={() => setSub('photos')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9" cy="10" r="1.5" fill="currentColor" />
            <path d="m5 17 4-4 3 3 4-5 3 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          Photos
        </button>
      </div>

      {sub === 'journal' ? <TripJournalFeed mobileLayout /> : <TripPhotoAlbum mobileLayout />}
    </div>
  );
};
