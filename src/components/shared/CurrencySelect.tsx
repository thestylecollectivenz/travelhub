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
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({
  id,
  className,
  style,
  value,
  onChange,
  allowUnknownValue = true
}) => {
  const v = (value || '').trim().toUpperCase() || 'NZD';
  const showUnknown = allowUnknownValue && Boolean(v) && !KNOWN_CURRENCY_CODE_SET.has(v);

  return (
    <select id={id} className={className} style={style} value={v} onChange={(e) => onChange(e.target.value)}>
      {showUnknown ? (
        <option value={v}>{`${v} (current)`}</option>
      ) : null}
      <optgroup label="Common currencies">
        {PINNED_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="More (alphabetical)">
        {OTHER_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
};
