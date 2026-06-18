import { plainTextToEditorHtml } from './journalRichText';

/** Lightweight markdown → HTML for AI replies (bold, links, lists, paragraphs). */
export function markdownToHtml(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;

  const flushList = (): void => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const inline = (line: string): string => {
    let s = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline((bullet || numbered)![1])}</li>`);
      continue;
    }
    flushList();
    if (!trimmed) {
      out.push('<p><br></p>');
      continue;
    }
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  flushList();
  return out.join('') || plainTextToEditorHtml(raw);
}
