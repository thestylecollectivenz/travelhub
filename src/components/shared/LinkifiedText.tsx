import * as React from 'react';

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/gi;

export function splitTextWithUrls(text: string): Array<{ type: 'text' | 'url'; value: string }> {
  const parts: Array<{ type: 'text' | 'url'; value: string }> = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, 'gi');
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) });
    }
    parts.push({ type: 'url', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: text }];
}

export const LinkifiedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const parts = splitTextWithUrls(text);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'url' ? (
          <a key={`${i}-${part.value}`} href={part.value} target="_blank" rel="noopener noreferrer">
            {part.value}
          </a>
        ) : (
          <React.Fragment key={`${i}-t`}>{part.value}</React.Fragment>
        )
      )}
    </span>
  );
};
