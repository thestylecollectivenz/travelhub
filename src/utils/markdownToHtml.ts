import { plainTextToEditorHtml } from './journalRichText';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMarkdown(line: string): string {
  const holders: string[] = [];
  let s = escapeHtml(line);

  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    const html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    holders.push(html);
    return `@@LINK${holders.length - 1}@@`;
  });

  s = s.replace(/(https?:\/\/[^\s<>"']+)/g, (url: string) => {
    const html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    holders.push(html);
    return `@@LINK${holders.length - 1}@@`;
  });

  s = s.replace(/@@LINK(\d+)@@/g, (_match, index: string) => holders[Number(index)] ?? '');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

function ensureLinkTargets(html: string): string {
  return html.replace(/<a\s+(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

/** Lightweight markdown → HTML for AI replies (bold, links, lists, paragraphs). */
export function markdownToHtml(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return ensureLinkTargets(raw);

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;

  const flushList = (): void => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
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
      out.push(`<li>${inlineMarkdown((bullet || numbered)![1])}</li>`);
      continue;
    }
    flushList();
    if (!trimmed) {
      out.push('<p><br></p>');
      continue;
    }
    out.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  return out.join('') || plainTextToEditorHtml(raw);
}
