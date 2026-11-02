/** Wrap an offline IIFE bundle and its CSS; the session injects a fresh CSP nonce. */
export const createCanvasPrototypeDocument = (script: string, css: string): string => {
  return `<!doctype html><html class="origamix-ui"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-__CANVAS_NONCE__'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script nonce="__CANVAS_NONCE__">${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
};
