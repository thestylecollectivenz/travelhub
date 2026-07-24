import * as React from 'react';
import chrome from './MobileTabChrome.module.css';

function FilterIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface MobileFilterDisclosureProps {
  open: boolean;
  onToggle: () => void;
  label?: string;
  children?: React.ReactNode;
  /** Optional controls shown beside the filter toggle (e.g. Expand all). */
  trailing?: React.ReactNode;
}

/** Filters stay hidden until the filter control is tapped (mobile + iPad). */
export const MobileFilterDisclosure: React.FC<MobileFilterDisclosureProps> = ({
  open,
  onToggle,
  label = 'Filters',
  children,
  trailing
}) => (
  <>
    <div className={chrome.filterToggleRow}>
      {trailing ? <div className={chrome.filterToggleExtras}>{trailing}</div> : null}
      <button
        type="button"
        className={open ? chrome.filterToggleOn : chrome.filterToggle}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      >
        <FilterIcon />
        <span>{label}</span>
      </button>
    </div>
    {open && children ? children : null}
  </>
);
