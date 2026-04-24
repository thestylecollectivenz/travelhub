import * as React from 'react';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import type { Trip, TripLifecycleStatus } from '../../models/Trip';
import { useSpContext } from '../../context/SpContext';
import { joinWebAbsoluteAndServerRelative } from '../../utils/sharePointUrl';

export interface EditTripPanelProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partial: Partial<Trip>) => void;
}

const STATUSES: TripLifecycleStatus[] = ['Planning', 'Upcoming', 'In Progress', 'Completed', 'Archived'];

function pickServerRelativeUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const root = payload as Record<string, unknown>;
  const direct = root.ServerRelativeUrl ?? root.FileRef;
  if (typeof direct === 'string' && direct.trim() !== '') return direct;
  const d = root.d;
  if (d && typeof d === 'object') {
    const dd = d as Record<string, unknown>;
    const nested = dd.ServerRelativeUrl ?? dd.FileRef;
    if (typeof nested === 'string' && nested.trim() !== '') return nested;
  }
  const list = root.ListItemAllFields;
  if (list && typeof list === 'object') {
    const lf = list as Record<string, unknown>;
    const ref = lf.FileRef ?? lf.ServerRelativeUrl;
    if (typeof ref === 'string' && ref.trim() !== '') return ref;
  }
  return undefined;
}

export const EditTripPanel: React.FC<EditTripPanelProps> = ({ trip, isOpen, onClose, onSave }) => {
  const spContext = useSpContext();
  const [draft, setDraft] = React.useState<Trip>(trip);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(trip);
      setSelectedFile(null);
      setIsUploading(false);
      setUploadError(null);
    }
  }, [isOpen, trip]);

  const dateRangeValid = !draft.dateStart || !draft.dateEnd || new Date(draft.dateEnd) >= new Date(draft.dateStart);
  const canSave = draft.title.trim().length > 0 && draft.dateStart.length > 0 && draft.dateEnd.length > 0 && dateRangeValid && !isUploading;

  const webAbsoluteUrl = React.useMemo(
    () => spContext.pageContext.web.absoluteUrl.replace(/\/$/, ''),
    [spContext.pageContext.web.absoluteUrl]
  );

  const { heroImagesFolderPath, tripHeroFolderPath } = React.useMemo(() => {
    const webServerRelative = spContext.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
    const heroImages = `${webServerRelative}/TravelHubAssets/hero-images`;
    return { heroImagesFolderPath: heroImages, tripHeroFolderPath: `${heroImages}/${trip.id}` };
  }, [spContext.pageContext.web.serverRelativeUrl, trip.id]);

  /** POST .../folders/add('path') — treat 200 and 400/409 as OK (created or already exists). */
  const addFolderLevel = React.useCallback(
    async (serverRelativeFolderPath: string): Promise<void> => {
      const escaped = serverRelativeFolderPath.replace(/'/g, "''");
      const url = `${webAbsoluteUrl}/_api/web/folders/add('${escaped}')`;
      const resp: SPHttpClientResponse = await spContext.spHttpClient.post(url, SPHttpClient.configurations.v1, {
        headers: {
          Accept: 'application/json;odata.metadata=minimal'
        }
      });
      if (resp.ok || resp.status === 400 || resp.status === 409) {
        return;
      }
      throw new Error(`Could not ensure folder (${resp.status})`);
    },
    [spContext.spHttpClient, webAbsoluteUrl]
  );

  const ensureHeroImageFolders = React.useCallback(async (): Promise<void> => {
    await addFolderLevel(heroImagesFolderPath);
    await addFolderLevel(tripHeroFolderPath);
  }, [addFolderLevel, heroImagesFolderPath, tripHeroFolderPath]);

  const uploadHeroImage = React.useCallback(async (file: File): Promise<string> => {
    await ensureHeroImageFolders();
    const buffer = await file.arrayBuffer();
    const safeFolder = tripHeroFolderPath.replace(/'/g, "''");
    const encodedFileName = encodeURIComponent(file.name);
    const uploadUrl =
      `${webAbsoluteUrl}/_api/web/getfolderbyserverrelativeurl('${safeFolder}')/files/add(url='${encodedFileName}',overwrite=true)`;
    const uploadResp = await spContext.spHttpClient.post(uploadUrl, SPHttpClient.configurations.v1, {
      headers: {
        Accept: 'application/json;odata.metadata=minimal'
      },
      body: buffer
    });
    if (!uploadResp.ok) {
      throw new Error(`Upload failed (${uploadResp.status})`);
    }
    const payload = await uploadResp.json();
    const serverRelativeUrl = pickServerRelativeUrl(payload);
    if (!serverRelativeUrl) {
      throw new Error('Upload succeeded but no file URL returned');
    }
    const rel = serverRelativeUrl.startsWith('/') ? serverRelativeUrl : `/${serverRelativeUrl}`;
    return joinWebAbsoluteAndServerRelative(webAbsoluteUrl, rel);
  }, [ensureHeroImageFolders, tripHeroFolderPath, webAbsoluteUrl, spContext.spHttpClient]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        style={{
          width: 'min(100%, 30rem)',
          height: '100%',
          background: 'var(--color-surface-raised)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit trip details"
      >
        <div
          style={{
            padding: 'var(--space-5)',
            borderBottom: 'var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--color-blue-800)', fontSize: 'var(--font-size-lg)' }}>Edit trip details</h2>
          <button type="button" onClick={onClose} aria-label="Close panel" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-lg)' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Trip title</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={255}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Destination</span>
            <input
              type="text"
              value={draft.destination}
              onChange={(e) => setDraft((prev) => ({ ...prev, destination: e.target.value }))}
              maxLength={255}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Date range</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <input
                type="date"
                value={draft.dateStart}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateStart: e.target.value }))}
                style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
              />
              <input
                type="date"
                value={draft.dateEnd}
                min={draft.dateStart || undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateEnd: e.target.value }))}
                style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
              />
            </div>
            {!dateRangeValid ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                End date must be on or after start date.
              </span>
            ) : null}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
              Changing dates does not add or remove days. Use day management to adjust the itinerary structure.
            </span>
          </div>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TripLifecycleStatus }))}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Description</span>
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              style={{ minHeight: '5rem', padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-700)' }}>Hero image</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                if (nextFile && nextFile.size > 10 * 1024 * 1024) {
                  setUploadError('Image must be 10MB or smaller.');
                  setSelectedFile(null);
                  return;
                }
                setUploadError(null);
                setSelectedFile(nextFile);
              }}
              style={{ padding: 'var(--space-2)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
            <input
              type="url"
              value={draft.heroImageUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))}
              placeholder="Fallback URL (https://...)"
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)' }}
            />
            {isUploading ? <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>Uploading…</span> : null}
            {uploadError ? <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>{uploadError}</span> : null}
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: 'var(--space-4) var(--space-5)', borderTop: 'var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" onClick={onClose} style={{ padding: 'var(--space-2) var(--space-4)', background: 'transparent', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={async () => {
              try {
                setUploadError(null);
                let heroImageUrl = draft.heroImageUrl.trim();
                if (selectedFile) {
                  setIsUploading(true);
                  heroImageUrl = await uploadHeroImage(selectedFile);
                }
                onSave({
                  title: draft.title.trim(),
                  destination: draft.destination.trim(),
                  dateStart: draft.dateStart,
                  dateEnd: draft.dateEnd,
                  status: draft.status,
                  description: (draft.description ?? '').trim(),
                  heroImageUrl
                });
                onClose();
              } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Image upload failed');
              } finally {
                setIsUploading(false);
              }
            }}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: canSave ? 'var(--color-primary)' : 'var(--color-sand-300)',
              color: canSave ? 'var(--color-surface-raised)' : 'var(--color-sand-600)',
              cursor: canSave ? 'pointer' : 'not-allowed'
            }}
          >
            Save changes
          </button>
        </div>
      </aside>
    </div>
  );
};
