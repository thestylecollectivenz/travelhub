import * as React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { placeDirectionsFromHereUrl, placeDirectionsFromCoordsUrl, placeDirectionsFromOriginUrl, googleMapsDirectionsBetweenCoordsUrl, placeQueryMapsUrl } from '../../utils/googleMapsLink';
import { formatModeMinutes } from '../../utils/travelModeDurations';
import { openMobileExternalUrl } from '../../hooks/useMobileDetailHistory';
import { normalizeHttpsUrl } from '../../utils/imageUrlUtils';
import { resolvePlaceCardPhoto } from '../../utils/resolvePlaceCardPhoto';
import styles from './MobilePlaceDiscoverCard.module.css';

export type PlaceDiscoverCardModel = {
  id: string;
  name: string;
  categoryLabel: string;
  rating?: number;
  description?: string;
  distanceRaw?: string;
  address?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  tags?: string[];
  city?: string;
  nearLabel?: string;
  latitude?: number;
  longitude?: number;
  walkMinutes?: number;
  driveMinutes?: number;
  transitMinutes?: number;
  /** Prefer Wikipedia-style hero photos (sights/parks). Default venue listing. */
  photoKind?: 'landmark' | 'venue';
  /** Gemini / TripAdvisor image URL when available. */
  photoUrl?: string;
  tripadvisorUrl?: string;
};

export type PlaceDiscoverPrimaryKind = 'save' | 'delete' | 'label';

export interface MobilePlaceDiscoverCardProps {
  card: PlaceDiscoverCardModel;
  startingPointLabel: string;
  cityFallback: string;
  layout?: 'strip' | 'list';
  /** When set, Directions use this origin (Explore). When omitted, use current location (Near Me). */
  directionsOrigin?: { lat: number; lng: number };
  /** Prefer Gemini/TripAdvisor photo + click URL over Google Places. */
  preferProvidedPhoto?: boolean;
  primaryAction?: {
    label: string;
    onClick: () => void;
    kind?: PlaceDiscoverPrimaryKind;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  tertiaryAction?: {
    label: string;
    onClick: () => void;
    kind?: 'task' | 'itinerary';
  };
}

function IconPin(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function IconCar({ active }: { active?: boolean }): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 16h14v2.2a1 1 0 0 1-1 1h-1.2a1.5 1.5 0 0 1-2.9 0H10.1a1.5 1.5 0 0 1-2.9 0H6a1 1 0 0 1-1-1V16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? 'currentColor' : 'none'}
        opacity={active ? 0.15 : 1}
      />
      <path
        d="M4 16l1.5-5.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="16.5" r="1.2" fill="currentColor" />
      <circle cx="16.5" cy="16.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconTransit(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="3" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10h12M9 17l-1.5 3M15 17l1.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function IconWalk({ active }: { active?: boolean }): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="13" cy="5" r="2" fill="currentColor" />
      <path
        d="M13 8.5 10 12l2 3.5L9.5 20M13 8.5l3 2.5 1.5 4.5M10 12H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDirections(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2 4 20l8-4 8 4L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconItinerary(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M12 11v5M9.5 13.5H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTask(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 11.5 11 13.5 15.5 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconSave(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M7 3v5h8V3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 21v-8h10v8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="9" y="13" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconDelete(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 7V5h4v2m-6 3v8m4-8v8M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function parseModeMinutes(raw: string | undefined): { walk?: number; drive?: number } {
  const text = (raw || '').trim();
  const walk = text.match(/(\d+)\s*min(?:ute)?s?\s*walk/i);
  const drive = text.match(/(\d+)\s*min(?:ute)?s?\s*drive/i);
  return {
    walk: walk ? Number(walk[1]) : undefined,
    drive: drive ? Number(drive[1]) : undefined
  };
}

export const MobilePlaceDiscoverCard: React.FC<MobilePlaceDiscoverCardProps> = ({
  card,
  startingPointLabel,
  cityFallback,
  layout = 'list',
  directionsOrigin,
  preferProvidedPhoto: _preferProvidedPhoto = false,
  primaryAction,
  secondaryAction,
  tertiaryAction
}) => {
  const { config } = useConfig();
  const city = card.city || cityFallback;
  const [photo, setPhoto] = React.useState<{
    imageUrl: string;
    sourceUrl: string;
    displayName?: string;
    provider?: 'google' | 'wikipedia' | 'commons' | 'openverse' | 'other';
  } | null>(null);
  const [mode, setMode] = React.useState<'drive' | 'transit' | 'walk'>('walk');

  React.useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      const hit = await resolvePlaceCardPhoto({
        name: card.name,
        address: card.address,
        city,
        latitude: card.latitude,
        longitude: card.longitude,
        photoKind: card.photoKind,
        photoUrl: card.photoUrl,
        tripadvisorUrl: card.tripadvisorUrl,
        websiteUrl: card.websiteUrl,
        googleMapsApiKey: config.googleMapsApiKey
      });
      if (cancelled) return;
      setPhoto(
        hit || {
          imageUrl: '',
          sourceUrl:
            normalizeHttpsUrl(card.tripadvisorUrl) ||
            normalizeHttpsUrl(card.websiteUrl) ||
            placeQueryMapsUrl(card.name, card.address) ||
            '',
          displayName: card.name
        }
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    card.name,
    card.address,
    card.photoKind,
    card.photoUrl,
    card.tripadvisorUrl,
    card.websiteUrl,
    card.latitude,
    card.longitude,
    city,
    config.googleMapsApiKey
  ]);

  const parsed = parseModeMinutes(card.distanceRaw);
  const walkMins = card.walkMinutes ?? parsed.walk;
  const driveMins = card.driveMinutes ?? parsed.drive;
  const transitMins = card.transitMinutes;

  const distLabel = (card.nearLabel || startingPointLabel || '').trim();
  const distShort = (card.distanceRaw || '').match(/^([\d.]+\s*(?:m|km|mi))\b/i)?.[1];
  const displayName = (photo?.displayName || '').trim() || card.name;

  const destQuery =
    (card.address || '').trim() ||
    [displayName, city].filter(Boolean).join(', ');
  const directions = directionsOrigin
    ? Number.isFinite(card.latitude) && Number.isFinite(card.longitude)
      ? googleMapsDirectionsBetweenCoordsUrl(
          directionsOrigin.lat,
          directionsOrigin.lng,
          Number(card.latitude),
          Number(card.longitude)
        )
      : placeDirectionsFromOriginUrl(
          directionsOrigin.lat,
          directionsOrigin.lng,
          displayName,
          card.address,
          city
        )
    : (Number.isFinite(card.latitude) && Number.isFinite(card.longitude)
        ? placeDirectionsFromCoordsUrl(Number(card.latitude), Number(card.longitude))
        : undefined) ||
      placeDirectionsFromHereUrl(displayName, card.address, city) ||
      undefined;

  const listingHref =
    normalizeHttpsUrl(card.tripadvisorUrl) ||
    normalizeHttpsUrl(card.websiteUrl) ||
    normalizeHttpsUrl(photo?.sourceUrl) ||
    normalizeHttpsUrl(card.mapsUrl) ||
    placeQueryMapsUrl(displayName, card.address) ||
    placeQueryMapsUrl(destQuery) ||
    undefined;
  const photoHref = listingHref;
  const kind = primaryAction?.kind || 'label';
  const openListing = (e: React.MouseEvent): void => {
    if (!listingHref) return;
    openMobileExternalUrl(listingHref, e);
  };

  return (
    <article className={`${styles.card} ${layout === 'strip' ? styles.strip : styles.list}`}>
      {photoHref ? (
        <a
          className={styles.photo}
          href={photoHref}
          target="_blank"
          rel="noopener noreferrer"
          style={photo?.imageUrl ? { backgroundImage: `url(${photo.imageUrl})` } : undefined}
          aria-label={`Open listing for ${displayName}`}
          title="Open listing"
          onClick={openListing}
        />
      ) : (
        <div
          className={styles.photo}
          style={photo?.imageUrl ? { backgroundImage: `url(${photo.imageUrl})` } : undefined}
          aria-hidden
        />
      )}
      <div className={styles.body}>
        <div className={styles.titleRow}>
          {listingHref ? (
            <a
              className={styles.nameLink}
              href={listingHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openListing}
            >
              <strong className={styles.name}>{displayName}</strong>
            </a>
          ) : (
            <strong className={styles.name}>{displayName}</strong>
          )}
          {typeof card.rating === 'number' ? (
            <span className={styles.rating}>★ {card.rating.toFixed(1)}</span>
          ) : null}
        </div>
        <span className={styles.tag}>{card.categoryLabel}</span>
        {card.description ? <p className={styles.desc}>{card.description}</p> : null}
        {card.address ? <p className={styles.addr}>{card.address}</p> : null}
        {distShort || walkMins || driveMins ? (
          <div className={styles.travelModes} role="group" aria-label="Travel times">
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'drive' ? styles.modeBtnOn : ''}`}
              onClick={() => setMode('drive')}
            >
              <IconCar active={mode === 'drive'} />
              <span>{formatModeMinutes(driveMins)}</span>
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'transit' ? styles.modeBtnOn : ''}`}
              onClick={() => setMode('transit')}
            >
              <IconTransit />
              <span>{formatModeMinutes(transitMins)}</span>
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'walk' ? styles.modeBtnOn : ''}`}
              onClick={() => setMode('walk')}
            >
              <IconWalk active={mode === 'walk'} />
              <span>{formatModeMinutes(walkMins)}</span>
            </button>
          </div>
        ) : null}
        {distShort && distLabel ? (
          <p className={styles.dist}>
            <IconPin /> {distShort} from {distLabel}
          </p>
        ) : null}
        {card.tags?.length ? (
          <div className={styles.tagRow}>
            {card.tags.slice(0, 3).map((t) => (
              <span key={t} className={styles.miniTag}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className={styles.actions}>
          {directions ? (
            <a
              className={`${styles.action} ${styles.actionDirections}`}
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openMobileExternalUrl(directions, e)}
            >
              <IconDirections /> Directions
            </a>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              className={`${styles.action} ${styles.actionPrimary}`}
              onClick={secondaryAction.onClick}
              aria-label={secondaryAction.label}
              title={secondaryAction.label}
            >
              <IconItinerary /> {secondaryAction.label}
            </button>
          ) : null}
          {tertiaryAction ? (
            <button
              type="button"
              className={`${styles.action} ${styles.actionIcon}`}
              onClick={tertiaryAction.onClick}
              aria-label={tertiaryAction.label}
              title={tertiaryAction.label}
            >
              {tertiaryAction.kind === 'task' ? <IconTask /> : <IconItinerary />}
            </button>
          ) : null}
          {primaryAction ? (
            <button
              type="button"
              className={`${styles.action} ${kind === 'delete' ? styles.actionIconDanger : ''} ${
                kind !== 'label' ? styles.actionIcon : ''
              }`}
              onClick={primaryAction.onClick}
              aria-label={primaryAction.label}
              title={primaryAction.label}
            >
              {kind === 'save' ? <IconSave /> : null}
              {kind === 'delete' ? <IconDelete /> : null}
              {kind === 'label' ? primaryAction.label : null}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
