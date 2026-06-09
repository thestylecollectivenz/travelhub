/** Resize/compress images before journal upload to reduce storage and load time. */
export async function compressImageForUpload(
  file: File,
  maxEdge = 2040,
  quality = 0.82
): Promise<File> {
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type === 'image/gif') {
    return file;
  }

  if (file.size < 400_000) {
    return file;
  }

  const bitmap = await loadImageSource(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  if (!srcW || !srcH) {
    bitmap.cleanup?.();
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  if (scale >= 1 && file.size < 1_500_000) {
    bitmap.cleanup?.();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.cleanup?.();
    return file;
  }
  ctx.drawImage(bitmap.source, 0, 0, outW, outH);
  bitmap.cleanup?.();

  const blob = await canvasToJpegBlob(canvas, quality);
  if (!blob || blob.size >= file.size) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

type ImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
};

function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).then((bitmap) => ({
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close()
    }));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}
