/** Decorative place photo via Pollinations (no auth; best-effort). */
export function explorePlacePhotoUrl(placeName: string, city?: string): string {
  const subject = [placeName.trim(), city?.trim()].filter(Boolean).join(' in ');
  const prompt = encodeURIComponent(
    `${subject || 'travel destination'}, travel photography, inviting exterior or street view, no text, no watermark`
  );
  const seed = Math.abs(
    Array.from(subject || 'place').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  return `https://image.pollinations.ai/prompt/${prompt}?width=640&height=400&nologo=true&seed=${seed}`;
}

/** Destination hero — iconic landmark / what the place is known for. */
export function destinationHeroPhotoUrl(placeName: string, country?: string): string {
  const subject = [placeName.trim(), country?.trim()].filter(Boolean).join(', ');
  const prompt = encodeURIComponent(
    `Iconic landmark or skyline of ${subject || 'world city'}, what this destination is famous for, cinematic travel photography, golden hour, no people close-up, no text, no watermark`
  );
  const seed = Math.abs(
    Array.from(`hero:${subject || 'place'}`).reduce((acc, ch) => acc + ch.charCodeAt(0) * 3, 0)
  );
  return `https://image.pollinations.ai/prompt/${prompt}?width=960&height=720&nologo=true&seed=${seed}`;
}
