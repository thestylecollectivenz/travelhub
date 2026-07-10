import * as React from 'react';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import { useSpContext } from '../../context/SpContext';

export interface TravellerAvatarProps {
  displayName: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
  title?: string;
}

export function travellerInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const TravellerAvatar: React.FC<TravellerAvatarProps> = ({
  displayName,
  avatarUrl,
  size = 28,
  className,
  title
}) => {
  const sp = useSpContext();
  const [failed, setFailed] = React.useState(false);
  const src = React.useMemo(() => {
    const raw = (avatarUrl || '').trim();
    if (!raw) return null;
    return resolveSharePointMediaSrc(
      raw,
      sp.pageContext.web.absoluteUrl,
      sp.pageContext.web.serverRelativeUrl || ''
    );
  }, [avatarUrl, sp.pageContext.web.absoluteUrl, sp.pageContext.web.serverRelativeUrl]);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '999px',
    objectFit: 'cover',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'color-mix(in srgb, var(--color-blue-100) 70%, white)',
    color: 'var(--color-blue-800)',
    fontSize: Math.max(10, Math.round(size * 0.36)),
    fontWeight: 700,
    overflow: 'hidden',
    border: '1px solid color-mix(in srgb, var(--color-blue-800) 12%, transparent)'
  };

  if (src && !failed) {
    return (
      <img
        className={className}
        src={src}
        alt=""
        title={title || displayName}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={className} title={title || displayName} style={style} aria-hidden={!title}>
      {travellerInitials(displayName)}
    </span>
  );
};
