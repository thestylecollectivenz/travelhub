import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../../models';
import { buildJournalPrintDocument, type JournalExportFontSize } from '../../utils/journalPrintPreview';
import {
  downloadStampedPdf,
  stampJournalPdf,
  stampedJournalFileName
} from '../../utils/stampJournalPdf';
import { JournalPrintSheet } from './JournalPrintSheet';
import './JournalPdfExport.css';

export interface JournalPdfExportProps {
  trip: Trip;
  tripDays: TripDay[];
  entries: JournalEntry[];
  photos: JournalPhoto[];
  commentsForEntry: (entryId: string) => JournalComment[];
  /** Called when the print preview sheet is closed (also closes export dialog). */
  onCloseExport?: () => void;
}

export const JournalPdfExport: React.FC<JournalPdfExportProps> = ({
  trip,
  tripDays,
  entries,
  photos,
  commentsForEntry,
  onCloseExport
}) => {
  const [showCover, setShowCover] = React.useState(true);
  const [includeHeroOnCover, setIncludeHeroOnCover] = React.useState(true);
  const [showSummary, setShowSummary] = React.useState(true);
  const [includePreTrip, setIncludePreTrip] = React.useState(false);
  const [includeComments, setIncludeComments] = React.useState(true);
  const [includeLikes, setIncludeLikes] = React.useState(true);
  const [includePhotoCaptions, setIncludePhotoCaptions] = React.useState(true);
  const [includeEntryTimestamps, setIncludeEntryTimestamps] = React.useState(true);
  const [includeAuthorNames, setIncludeAuthorNames] = React.useState(trip.showAuthorName !== false);
  const [oneDayPerPage, setOneDayPerPage] = React.useState(false);
  const [separateCoverPage, setSeparateCoverPage] = React.useState(false);
  const [fontSize, setFontSize] = React.useState<JournalExportFontSize>('medium');

  const [stampFooterUrl, setStampFooterUrl] = React.useState(true);
  const [stampPageNumbers, setStampPageNumbers] = React.useState(true);
  const [stampHeaderTripTitle, setStampHeaderTripTitle] = React.useState(false);
  const [stampHeaderDate, setStampHeaderDate] = React.useState(false);
  const [stampSkipCoverPage, setStampSkipCoverPage] = React.useState(false);
  const [uploadedPdf, setUploadedPdf] = React.useState<File | null>(null);
  const [stampBusy, setStampBusy] = React.useState(false);
  const [stampError, setStampError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setIncludeAuthorNames(trip.showAuthorName !== false);
  }, [trip.id, trip.showAuthorName]);

  React.useEffect(() => {
    if (separateCoverPage && showCover) {
      setStampSkipCoverPage(true);
    }
  }, [separateCoverPage, showCover]);
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
      includeAuthorNames,
      oneDayPerPage,
      separateCoverPage,
      fontSize
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
    includeAuthorNames,
    oneDayPerPage,
    separateCoverPage,
    fontSize
  ]);

  const handlePdfSelected = React.useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    setStampError(null);
    setUploadedPdf(file && file.type === 'application/pdf' ? file : null);
    if (file && file.type !== 'application/pdf') {
      setStampError('Please choose a PDF file.');
    }
    e.target.value = '';
  }, []);

  const handleStampAndDownload = React.useCallback(async (): Promise<void> => {
    if (!uploadedPdf || stampBusy) return;
    if (!stampFooterUrl && !stampPageNumbers && !stampHeaderTripTitle && !stampHeaderDate) {
      setStampError('Choose at least one header or footer option.');
      return;
    }

    setStampError(null);
    setStampBusy(true);
    try {
      const bytes = await stampJournalPdf(uploadedPdf, {
        includeFooterUrl: stampFooterUrl,
        sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
        includePageNumbers: stampPageNumbers,
        includeHeaderTripTitle: stampHeaderTripTitle,
        tripTitle: trip.title,
        includeHeaderDate: stampHeaderDate,
        skipCoverPageStamp: stampSkipCoverPage
      });
      downloadStampedPdf(bytes, stampedJournalFileName(trip.title));
    } catch (err) {
      setStampError(err instanceof Error ? err.message : 'Could not stamp the PDF.');
    } finally {
      setStampBusy(false);
    }
  }, [
    uploadedPdf,
    stampBusy,
    stampFooterUrl,
    stampPageNumbers,
    stampHeaderTripTitle,
    stampHeaderDate,
    trip.title,
    stampSkipCoverPage
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
            <input
              type="checkbox"
              checked={separateCoverPage}
              onChange={(e) => setSeparateCoverPage(e.target.checked)}
              disabled={!showCover}
            />{' '}
            Separate cover page (full-page hero)
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
            <input type="checkbox" checked={includeAuthorNames} onChange={(e) => setIncludeAuthorNames(e.target.checked)} /> Author names
          </label>
          <label>
            <input type="checkbox" checked={includeEntryTimestamps} onChange={(e) => setIncludeEntryTimestamps(e.target.checked)} /> Entry dates &amp; times
          </label>
          <label>
            <input type="checkbox" checked={oneDayPerPage} onChange={(e) => setOneDayPerPage(e.target.checked)} /> One day per page (print)
          </label>
          <label className="fontSizeControl">
            Font size{' '}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as JournalExportFontSize)}
              aria-label="Export font size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <button type="button" className="printPrimaryBtn" onClick={openPreview}>
            Preview print layout
          </button>
        </div>

        <div className="pdfStampSection">
          <h4 className="pdfStampHeading">Step 1 — Print / save PDF</h4>
          <p className="pdfStampHint">
            Preview the layout, then use <strong>Print / Save PDF</strong>. Turn <strong>Headers and footers Off</strong> in the print dialog for a clean journal.
          </p>

          <h4 className="pdfStampHeading">Step 2 — Stamp headers &amp; footers</h4>
          <p className="pdfStampHint">
            Upload the PDF you saved, then add page numbers and other chrome.
            {separateCoverPage && showCover ? (
              <>
                {' '}
                With <strong>Separate cover page</strong>, headers and footers start on page 2 (e.g. 2/5); the cover page stays unmarked.
              </>
            ) : null}
          </p>
          <div className="pdfStampOptions">
            <label>
              <input type="checkbox" checked={stampPageNumbers} onChange={(e) => setStampPageNumbers(e.target.checked)} /> Page numbers (footer right)
            </label>
            <label>
              <input type="checkbox" checked={stampFooterUrl} onChange={(e) => setStampFooterUrl(e.target.checked)} /> Page URL (footer left)
            </label>
            <label>
              <input type="checkbox" checked={stampHeaderTripTitle} onChange={(e) => setStampHeaderTripTitle(e.target.checked)} /> Trip title (header left)
            </label>
            <label>
              <input type="checkbox" checked={stampHeaderDate} onChange={(e) => setStampHeaderDate(e.target.checked)} /> Export date (header right)
            </label>
            <label>
              <input
                type="checkbox"
                checked={stampSkipCoverPage}
                onChange={(e) => setStampSkipCoverPage(e.target.checked)}
              />{' '}
              Skip cover page (stamp from page 2)
            </label>
          </div>
          <div className="pdfStampActions">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="pdfStampFileInput"
              onChange={handlePdfSelected}
              aria-label="Upload saved journal PDF"
            />
            <button type="button" className="pdfStampSecondaryBtn" onClick={() => fileInputRef.current?.click()} disabled={stampBusy}>
              Choose PDF…
            </button>
            <button
              type="button"
              className="printPrimaryBtn"
              onClick={handleStampAndDownload}
              disabled={!uploadedPdf || stampBusy}
            >
              {stampBusy ? 'Stamping…' : 'Stamp & download PDF'}
            </button>
          </div>
          {uploadedPdf ? <p className="pdfStampFileName">Selected: {uploadedPdf.name}</p> : null}
          {stampError ? <p className="pdfStampError">{stampError}</p> : null}
        </div>
      </div>
      {printHtml ? (
        <JournalPrintSheet
          title={`${trip.title} — Journal`}
          html={printHtml}
          onClose={() => {
            setPrintHtml(null);
            onCloseExport?.();
          }}
        />
      ) : null}
    </>
  );
};
