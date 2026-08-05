import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useAttachments } from '../../context/AttachmentsContext';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { splitNotesAndQa } from '../../utils/entryQaThread';
import { buildMobileDocLinkItems } from '../../utils/mobileDocLinkItems';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { RichTextContent } from '../shared/RichTextContent';
import styles from './MobileItinerary.module.css';

/** Expandable notes / docs / links under a day itinerary card (default collapsed). */
export const MobileItineraryCardExtras: React.FC<{
  entry: ItineraryEntry;
}> = ({ entry }) => {
  const { docsForEntry, linksForEntry } = useAttachments();
  const { canViewDocuments } = useTripPermissions();
  const [open, setOpen] = React.useState(false);

  const notesHtml = splitNotesAndQa(entry.notes).notes;
  const hasNotes = !isRichTextEditorEmpty(notesHtml);
  const docs = canViewDocuments ? docsForEntry(entry.id) : [];
  const links = linksForEntry(entry.id);
  const items = React.useMemo(
    () =>
      buildMobileDocLinkItems(docs, links, {
        placeName: entry.title || entry.location,
        placeAddress: entry.streetAddress,
        notesText: notesHtml
      }).filter((i) => i.id !== 'maps' && i.id !== 'website'),
    [docs, links, entry.title, entry.location, entry.streetAddress, notesHtml]
  );
  const hasExtras = hasNotes || items.length > 0;
  if (!hasExtras) return null;

  return (
    <div className={styles.cardExtras}>
      <button
        type="button"
        className={styles.cardExtrasToggle}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className={styles.cardExtrasIcons} aria-hidden>
          {hasNotes ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : null}
          {items.length ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M8 7h11v14H8V7Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 4h11v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : null}
        </span>
        <span>{open ? 'Hide notes & files' : 'Notes & files'}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div
          className={styles.cardExtrasBody}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {hasNotes ? (
            <div className={styles.cardExtrasNotes}>
              <RichTextContent html={notesHtml} />
            </div>
          ) : null}
          {items.length ? (
            <div className={styles.cardExtrasLinks}>
              {items.map((item) => (
                <a
                  key={item.id}
                  className={styles.cardExtrasLink}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.kind === 'document' ? 'Doc' : 'Link'}: {item.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
