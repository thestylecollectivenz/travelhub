import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../../models';
import { useConfig } from '../../context/ConfigContext';
import { buildJournalPrintDocument } from '../../utils/journalPrintPreview';
import { JournalPrintSheet } from './JournalPrintSheet';
import './JournalPdfExport.css';

export interface JournalPdfExportProps {
  trip: Trip;
  tripDays: TripDay[];
  entries: JournalEntry[];
  photos: JournalPhoto[];
  commentsForEntry: (entryId: string) => JournalComment[];
}

export const JournalPdfExport: React.FC<JournalPdfExportProps> = ({ trip, tripDays, entries, photos, commentsForEntry }) => {
  const { config } = useConfig();
  const [showCover, setShowCover] = React.useState(true);
  const [includeHeroOnCover, setIncludeHeroOnCover] = React.useState(true);
  const [showSummary, setShowSummary] = React.useState(true);
  const [includePreTrip, setIncludePreTrip] = React.useState(false);
  const [includeComments, setIncludeComments] = React.useState(true);
  const [includeLikes, setIncludeLikes] = React.useState(true);
  const [includePhotoCaptions, setIncludePhotoCaptions] = React.useState(true);
  const [includeEntryTimestamps, setIncludeEntryTimestamps] = React.useState(true);
  const [oneDayPerPage, setOneDayPerPage] = React.useState(false);
  const [printHtml, setPrintHtml] = React.useState<string | null>(null);

  const openPreview = React.useCallback((): void => {
    const html = buildJournalPrintDocument({
      trip,
      tripDays,
      entries,
      photos,
      commentsForEntry,
      showCover,
      includeHeroOnCover,
      showSummary,
      includePreTrip,
      includeComments,
      includeLikes,
      includePhotoCaptions,
      includeEntryTimestamps,
      oneDayPerPage,
      dateFormat: config.dateFormat
    });
    setPrintHtml(html);
  }, [
    trip,
    tripDays,
    entries,
    photos,
    commentsForEntry,
    showCover,
    includeHeroOnCover,
    showSummary,
    includePreTrip,
    includeComments,
    includeLikes,
    includePhotoCaptions,
    includeEntryTimestamps,
    oneDayPerPage,
    config.dateFormat
  ]);

  return (
    <>
      <div className="controls">
        <div className="controlsRow">
          <label>
            <input type="checkbox" checked={showCover} onChange={(e) => setShowCover(e.target.checked)} /> Cover page
          </label>
          <label>
            <input type="checkbox" checked={includeHeroOnCover} onChange={(e) => setIncludeHeroOnCover(e.target.checked)} disabled={!showCover} />{' '}
            Hero image on cover
          </label>
          <label>
            <input type="checkbox" checked={showSummary} onChange={(e) => setShowSummary(e.target.checked)} /> Cover summary
          </label>
          <label>
            <input type="checkbox" checked={includePreTrip} onChange={(e) => setIncludePreTrip(e.target.checked)} /> Include pre-trip
          </label>
          <label>
            <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} /> Include comments
          </label>
          <label>
            <input type="checkbox" checked={includeLikes} onChange={(e) => setIncludeLikes(e.target.checked)} /> Include likes
          </label>
          <label>
            <input type="checkbox" checked={includePhotoCaptions} onChange={(e) => setIncludePhotoCaptions(e.target.checked)} /> Photo captions
          </label>
          <label>
            <input type="checkbox" checked={includeEntryTimestamps} onChange={(e) => setIncludeEntryTimestamps(e.target.checked)} /> Entry dates &amp; times
          </label>
          <label>
            <input type="checkbox" checked={oneDayPerPage} onChange={(e) => setOneDayPerPage(e.target.checked)} /> One day per page (print)
          </label>
          <button type="button" className="printPrimaryBtn" onClick={openPreview}>
            Preview print layout
          </button>
        </div>
      </div>
      {printHtml ? (
        <JournalPrintSheet title={`${trip.title} — Journal`} html={printHtml} onClose={() => setPrintHtml(null)} />
      ) : null}
    </>
  );
};
