import * as React from 'react';
import { TripJournalFeed } from '../journal/TripJournalFeed';
import { TripPhotoAlbum } from '../journal/TripPhotoAlbum';
import styles from './MobileShell.module.css';

export const MobileJournalView: React.FC = () => {
  const [sub, setSub] = React.useState<'journal' | 'photos'>('journal');

  return (
    <>
      <div className={styles.subTabs}>
        <button
          type="button"
          className={`${styles.pagerBtn} ${sub === 'journal' ? styles.pagerBtnActive : ''}`}
          onClick={() => setSub('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          className={`${styles.pagerBtn} ${sub === 'photos' ? styles.pagerBtnActive : ''}`}
          onClick={() => setSub('photos')}
        >
          Photos
        </button>
      </div>
      {sub === 'journal' ? <TripJournalFeed /> : <TripPhotoAlbum />}
    </>
  );
};
