import * as React from 'react';
import { KNOWN_CURRENCY_CODE_SET, OTHER_CURRENCIES, PINNED_CURRENCIES } from '../../data/currencyOptions';

export interface CurrencySelectProps {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  value: string;
  onChange: (code: string) => void;
  /** When false, omit the leading option for unknown codes (e.g. strict home list). Default true. */
  allowUnknownValue?: boolean;
  /** Trip-used codes shown first in a dedicated group (e.g. currencies already on this trip). */
  priorityCodes?: string[];
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({
  id,
  className,
  style,
  value,
  onChange,
  allowUnknownValue = true,
  priorityCodes
}) => {
  const v = (value || '').trim().toUpperCase() || 'NZD';
  const showUnknown = allowUnknownValue && Boolean(v) && !KNOWN_CURRENCY_CODE_SET.has(v);

  const prioritySet = React.useMemo(() => {
    const codes = (priorityCodes ?? [])
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && KNOWN_CURRENCY_CODE_SET.has(c));
    return new Set(codes);
  }, [priorityCodes]);

  const priorityOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const rows: { code: string; name: string }[] = [];
    for (const code of priorityCodes ?? []) {
      const upper = code.trim().toUpperCase();
      if (!upper || seen.has(upper) || !KNOWN_CURRENCY_CODE_SET.has(upper)) continue;
      seen.add(upper);
      const pinned = PINNED_CURRENCIES.find((c) => c.code === upper);
      const other = OTHER_CURRENCIES.find((c) => c.code === upper);
      const name = pinned?.name ?? other?.name ?? upper;
      rows.push({ code: upper, name });
    }
    return rows;
  }, [priorityCodes]);

  const pinnedFiltered = PINNED_CURRENCIES.filter((c) => !prioritySet.has(c.code));
  const otherFiltered = OTHER_CURRENCIES.filter((c) => !prioritySet.has(c.code));

  return (
    <select id={id} className={className} style={style} value={v} onChange={(e) => onChange(e.target.value)}>
      {showUnknown ? (
        <option value={v}>{`${v} (current)`}</option>
      ) : null}
      {priorityOptions.length > 0 ? (
        <optgroup label="Used on this trip">
          {priorityOptions.map((c) => (
            <option key={`prio-${c.code}`} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="Common currencies">
        {pinnedFiltered.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="More (alphabetical)">
        {otherFiltered.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
};
