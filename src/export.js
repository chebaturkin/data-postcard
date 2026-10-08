const UNSAFE_FILENAME_CHARACTERS = /[<>:\"/\\|?*\u0000-\u001f\u007f]/g;

function cleanFilenamePart(value) {
  return String(value ?? '')
    .replace(UNSAFE_FILENAME_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
}

/** Keep a readable filename while removing path syntax and control characters. */
export function sanitizeFilename(name, fallback = 'postcard') {
  return cleanFilenamePart(name) || cleanFilenamePart(fallback) || 'postcard';
}

function requireSvgMarkup(svgText) {
  if (typeof svgText !== 'string' || !svgText.trim()) {
    throw new TypeError('SVG markup must contain non-whitespace content');
  }
  return svgText;
}

export function svgBlob(svgText) {
  return new Blob([requireSvgMarkup(svgText)], { type: 'image/svg+xml;charset=utf-8' });
}

export function downloadBlob(blob, filename = 'download') {
  const objectUrlApi = globalThis.URL;
  const url = objectUrlApi.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(filename, 'download');
  link.click();
  setTimeout(() => objectUrlApi.revokeObjectURL(url), 1000);
  return blob;
}

export function exportSvg(svgText, filename = 'data-postcard.svg') {
  return downloadBlob(svgBlob(svgText), sanitizeFilename(filename, 'data-postcard.svg'));
}

/** Rasterize the shared SVG scene through native Image and Canvas APIs. */
export function exportPng(svgText, width, height, filename = 'data-postcard.png') {
  return new Promise((resolve, reject) => {
    let objectUrl;
    let image;
    let settled = false;

    const revokeObjectUrl = () => {
      if (!objectUrl) return;
      try {
        if (typeof globalThis.URL?.revokeObjectURL === 'function') {
          globalThis.URL.revokeObjectURL(objectUrl);
        }
      } finally {
        objectUrl = undefined;
      }
    };

    const cleanup = () => {
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
      revokeObjectUrl();
    };

    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const settleReject = (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason instanceof Error ? reason : new Error(String(reason)));
    };

    try {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new RangeError('PNG dimensions must be positive finite numbers');
      }

      const svg = svgBlob(svgText);
      const objectUrlApi = globalThis.URL;
      if (!objectUrlApi || typeof objectUrlApi.createObjectURL !== 'function') {
        throw new Error('Browser URL API is unavailable for PNG export');
      }
      objectUrl = objectUrlApi.createObjectURL(svg);

      image = new Image();
      image.onload = () => {
        if (settled) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Canvas 2D context is unavailable for PNG export');
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          if (typeof canvas.toBlob !== 'function') {
            throw new Error('Canvas PNG encoding is unavailable');
          }
          canvas.toBlob((blob) => {
            if (!blob) {
              settleReject(new Error('Canvas failed to encode PNG'));
              return;
            }
            try {
              downloadBlob(blob, sanitizeFilename(filename, 'data-postcard.png'));
              settleResolve(blob);
            } catch (error) {
              settleReject(error);
            }
          }, 'image/png');
        } catch (error) {
          settleReject(error);
        }
      };
      image.onerror = () => {
        settleReject(new Error('Image failed to load SVG for PNG export'));
      };
      image.src = objectUrl;
    } catch (error) {
      settleReject(error);
    }
  });
}

export function standaloneHtml(svgText, title = 'Data Postcard', metadata = {}) {
  const safeSvgText = requireSvgMarkup(svgText);
  const safeTitle = String(title ?? '').replace(/[<&>\"']/g, '');
  const embedded = (JSON.stringify(metadata ?? {}) ?? '{}')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;background:#d9d4c8;min-height:100%;display:grid;place-items:center}svg{display:block;max-width:100vw;max-height:100vh;height:auto;box-shadow:8px 10px 0 rgba(0,0,0,.16)}</style></head><body>${safeSvgText}<script type="application/json" id="postcard-data">${embedded}</script></body></html>`;
}

export function exportStandaloneHtml(svgText, title = 'Data Postcard', filename = 'data-postcard.html', metadata = {}) {
  const html = standaloneHtml(svgText, title, metadata);
  return downloadBlob(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    sanitizeFilename(filename, 'data-postcard.html'),
  );
}
