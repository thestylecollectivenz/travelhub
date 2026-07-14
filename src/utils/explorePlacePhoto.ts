/** Decorative place photo via Pollinations (no auth; best-effort). */
export function explorePlacePhotoUrl(placeName: string, city?: string): string {
  const subject = [placeName.trim(), city?.trim()].filter(Boolean).join(' in ');
  const prompt = encodeURIComponent(
    `${subject || 'travel destination'}, travel photography, inviting exterior or street view, no text, no watermark`
  );
  const seed = Math.abs(
    Array.from(subject || 'place').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  return `https://image.pollinations.ai/prompt/${prompt}?width=480&height=360&nologo=true&seed=${seed}`;
}
