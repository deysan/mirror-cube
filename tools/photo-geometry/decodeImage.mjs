// Offline Node adapter: use an installed Chromium's image decoder/Canvas, not a recognition library or service.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function imageMime(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  throw new Error('Expected a local JPEG or PNG.');
}

export async function decodeImage(bytes, width, height) {
  const mime = imageMime(bytes);
  if (bytes.length > 30_000_000 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 2 || height < 2 || width * height > 25_000_000) throw new Error('Image exceeds offline decoder limits.');
  const executable = process.env.CHROME_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
  const profile = await mkdtemp(join(tmpdir(), 'mirror-photo-decode-'));
  let child;
  const pending = new Map();
  let sequence = 0, buffer = Buffer.alloc(0), failure;
  const fail = error => {
    failure = error;
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); }
    pending.clear();
  };
  try {
    child = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
      '--disable-sync', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
    child.once('error', error => fail(new Error(`Cannot start local Chromium; set CHROME_PATH. ${error.message}`)));
    child.once('exit', () => fail(new Error('Local image decoder exited.')));
    child.stdio[3].on('error', fail);
    child.stdio[4].on('error', fail);
    child.stdio[4].on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      let end;
      while ((end = buffer.indexOf(0)) !== -1) {
        const text = buffer.subarray(0, end).toString('utf8'); buffer = buffer.subarray(end + 1);
        try {
          const message = JSON.parse(text), p = pending.get(message.id);
          if (p) { pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result); }
        } catch (error) { fail(error); }
      }
    });
    const request = (method, params = {}, sessionId, timeout = 30_000) => new Promise((resolve, reject) => {
      if (failure) { reject(failure); return; }
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Local image decoder timed out: ${method}`)); }, timeout);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
    const version = await request('Browser.getVersion');
    const { targetId } = await request('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await request('Target.attachToTarget', { targetId, flatten: true });
    await request('Page.enable', {}, sessionId);
    await request('Network.enable', {}, sessionId);
    await request('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*', 'file://*'] }, sessionId);
    const { frameTree } = await request('Page.getFrameTree', {}, sessionId);
    await request('Page.setDocumentContent', { frameId: frameTree.frame.id,
      html: '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:"><title>Local image decoder</title>' }, sessionId);
    const response = await request('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const image = new Image(); image.src = ${JSON.stringify(`data:${mime};base64,${bytes.toString('base64')}`)};
      await image.decode();
      if (image.naturalWidth !== ${width} || image.naturalHeight !== ${height}) throw new Error('Decoded image dimensions/orientation do not match annotations.');
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', {willReadFrequently:true}); context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const gray = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < gray.length; i++) {
        if (rgba[i*4+3] !== 255) throw new Error('Transparent pixels are unsupported; composite explicitly before annotation.');
        gray[i] = Math.round(0.2126*rgba[i*4] + 0.7152*rgba[i*4+1] + 0.0722*rgba[i*4+2]);
      }
      let binary = ''; for (let i = 0; i < gray.length; i += 8192) binary += String.fromCharCode(...gray.subarray(i,i+8192));
      return btoa(binary);
    })()` }, sessionId);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    if (typeof response.result?.value !== 'string') throw new Error('No grayscale pixels returned by decoder.');
    const data = new Uint8Array(Buffer.from(response.result.value, 'base64'));
    if (data.length !== width * height) throw new Error('Incomplete grayscale raster.');
    await request('Browser.close', {}, undefined, 2000).catch(() => {});
    return { width, height, data, decoder: version.product };
  } finally {
    fail(new Error('Local image decoder closed.'));
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exited; clearTimeout(timer);
    }
    await rm(profile, { recursive: true, force: true });
  }
}
