import * as React from 'react';
import type { Trip } from '../../models/Trip';
import type { TripDay } from '../../models/TripDay';
import type { JournalEntry, JournalPhoto, JournalComment } from '../../models';
import {
  buildJournalPrintDocument,
  type CoverTitleAlign,
  type CoverTitleFontSize,
  type JournalExportFontSize
} from '../../utils/journalPrintPreview';
import {
  chooseJournalExportFolder,
  getExportFolderLabel,
  pickJournalPdfFile,
  saveStampedJournalPdf,
  supportsJournalExportFolderPicker
} from '../../utils/journalExportFilePicker';
import { stampJournalPdf, stampedJournalFileName } from '../../utils/stampJournalPdf';
import { JournalPrintSheet } from './JournalPrintSheet';
import './JournalPdfExport.css';

export interface JournalPdfExportProps {
  trip: Trip;
  tripDays: TripDay[];
  entries: JournalEntry[];
  photos: JournalPhoto[];
  photosForEntry?: (entryId: string) => JournalPhoto[];
  commentsForEntry: (entryId: string) => JournalComment[];
  /** Called when the print preview sheet is closed (also closes export dialog). */
  onCloseExport?: () => void;
}

export const JournalPdfExport: React.FC<JournalPdfExportProps> = ({
  trip,
  tripDays,
  entries,
  photos,
  photosForEntry,
  commentsForEntry
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
  const [coverTitleAlign, setCoverTitleAlign] = React.useState<CoverTitleAlign>('center');
  const [coverTitleFontSize, setCoverTitleFontSize] = React.useState<CoverTitleFontSize>('medium');
  const [fontSize, setFontSize] = React.useState<JournalExportFontSize>('medium');

  const [showStampStep, setShowStampStep] = React.useState(false);
  const stampSectionRef = React.useRef<HTMLDivElement | null>(null);

  const [stampFooterUrl, setStampFooterUrl] = React.useState(true);
  const [stampPageNumbers, setStampPageNumbers] = React.useState(true);
  const [stampHeaderTripTitle, setStampHeaderTripTitle] = React.useState(false);
  const [stampHeaderDate, setStampHeaderDate] = React.useState(false);
  const [stampHeaderTitleAlign, setStampHeaderTitleAlign] = React.useState<CoverTitleAlign>('center');
  const [stampSkipCoverPage, setStampSkipCoverPage] = React.useState(false);
  const [uploadedPdf, setUploadedPdf] = React.useState<File | null>(null);
  const [stampBusy, setStampBusy] = React.useState(false);
  const [stampError, setStampError] = React.useState<string | null>(null);
  const [exportFolderLabel, setExportFolderLabel] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderPickerSupported = supportsJournalExportFolderPicker();

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
      coverTitleAlign,
      coverTitleFontSize,
      fontSize,
      photosForEntry
    });
    setShowStampStep(false);
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
    coverTitleAlign,
    coverTitleFontSize,
    fontSize,
    photosForEntry
  ]);

  const refreshExportFolderLabel = React.useCallback((): void => {
    if (!folderPickerSupported) return;
    void getExportFolderLabel().then(setExportFolderLabel);
  }, [folderPickerSupported]);

  const handlePrintFinished = React.useCallback((): void => {
    setPrintHtml(null);
    setShowStampStep(true);
    refreshExportFolderLabel();
    window.setTimeout(() => {
      stampSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }, [refreshExportFolderLabel]);

  const handleClosePrintPreview = React.useCallback((): void => {
    setPrintHtml(null);
  }, []);

  const applyPdfFile = React.useCallback((file: File | undefined): void => {
    setStampError(null);
    if (!file) {
      setUploadedPdf(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setUploadedPdf(null);
      setStampError('Please choose a PDF file.');
      return;
    }
    setUploadedPdf(file);
  }, []);

  const handlePdfSelected = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      applyPdfFile(e.target.files?.[0]);
      e.target.value = '';
    },
    [applyPdfFile]
  );

  const handleChoosePdf = React.useCallback(async (): Promise<void> => {
    if (stampBusy) return;
    setStampError(null);
    try {
      const file = await pickJournalPdfFile();
      if (file) {
        applyPdfFile(file);
        refreshExportFolderLabel();
        return;
      }
    } catch (err) {
      setStampError(err instanceof Error ? err.message : 'Could not open the file picker.');
      return;
    }
    fileInputRef.current?.click();
  }, [stampBusy, applyPdfFile, refreshExportFolderLabel]);

  const handleSetExportFolder = React.useCallback(async (): Promise<void> => {
    if (stampBusy) return;
    setStampError(null);
    try {
      const name = await chooseJournalExportFolder();
      if (name) {
        setExportFolderLabel(name);
      }
    } catch (err) {
      setStampError(err instanceof Error ? err.message : 'Could not choose a folder.');
    }
  }, [stampBusy]);

  const handleStampDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(false);
      if (stampBusy) return;
      const file = e.dataTransfer.files?.[0];
      applyPdfFile(file);
    },
    [stampBusy, applyPdfFile]
  );

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
        headerTripTitleAlign: stampHeaderTitleAlign,
        includeHeaderDate: stampHeaderDate,
        skipCoverPageStamp: stampSkipCoverPage
      });
      await saveStampedJournalPdf(bytes, stampedJournalFileName(trip.title));
      refreshExportFolderLabel();
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
    stampSkipCoverPage,
    stampHeaderTitleAlign,
    refreshExportFolderLabel
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
            Cover title align{' '}
            <select
              value={coverTitleAlign}
              onChange={(e) => setCoverTitleAlign(e.target.value as CoverTitleAlign)}
              disabled={!showCover}
              aria-label="Cover title alignment"
            >
              <option value="center">Centred</option>
              <option value="left">Left aligned</option>
            </select>
          </label>
          <label className="fontSizeControl">
            Cover title size{' '}
            <select
              value={coverTitleFontSize}
              onChange={(e) => setCoverTitleFontSize(e.target.value as CoverTitleFontSize)}
              disabled={!showCover}
              aria-label="Cover title font size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="fontSizeControl">
            Journal font size{' '}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as JournalExportFontSize)}
              aria-label="Journal body font size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <button type="button" className="printPrimaryBtn" onClick={openPreview}>
            Step 1 — Preview &amp; print
          </button>
        </div>

        <p className="pdfStampHint pdfStepOneHint">
          Choose your options, then <strong>Step 1 — Preview &amp; print</strong>. In the print dialog use{' '}
          <strong>Save as PDF</strong> and turn <strong>Headers and footers Off</strong>. Step 2 appears after you close the print dialog.
        </p>

        {showStampStep ? (
        <div
          className={`pdfStampSection pdfStampSectionReveal${dragOver ? ' pdfStampSectionDragOver' : ''}`}
          ref={stampSectionRef}
          onDragEnter={(e) => {
            if (Array.from(e.dataTransfer.types).indexOf('Files') >= 0) setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleStampDrop}
        >
          <h4 className="pdfStampHeading">Step 2 — Stamp headers &amp; footers</h4>
          <p className="pdfStampHint">
            Upload the PDF you saved in Step 1, then add page numbers and other chrome.
            {folderPickerSupported ? (
              <>
                {' '}
                <strong>Choose PDF</strong> opens your{' '}
                <strong>{exportFolderLabel ?? 'Downloads'}</strong> folder The print dialog cannot tell the app where you saved — use{' '}
                <button type="button" className="pdfStampLinkBtn" onClick={handleSetExportFolder} disabled={stampBusy}>
                  Set export folder…
                </button>{' '}
                once if you use a different location. Or drag the PDF here.
              </>
            ) : (
              <> Drag the PDF onto this box, or use Choose PDF.</>
            )}
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
              <input type="checkbox" checked={stampHeaderTripTitle} onChange={(e) => setStampHeaderTripTitle(e.target.checked)} /> Trip title (header)
            </label>
            <label className="fontSizeControl">
              Header title align{' '}
              <select
                value={stampHeaderTitleAlign}
                onChange={(e) => setStampHeaderTitleAlign(e.target.value as CoverTitleAlign)}
                disabled={!stampHeaderTripTitle}
                aria-label="Stamped header title alignment"
              >
                <option value="center">Centred</option>
                <option value="left">Left aligned</option>
              </select>
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
            <button type="button" className="pdfStampSecondaryBtn" onClick={handleChoosePdf} disabled={stampBusy}>
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
        ) : null}
      </div>
      {printHtml ? (
        <JournalPrintSheet
          title={`${trip.title} — Journal`}
          html={printHtml}
          onClose={handleClosePrintPreview}
          onAfterPrint={handlePrintFinished}
        />
      ) : null}
    </>
  );
};
