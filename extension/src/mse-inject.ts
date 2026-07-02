// MSE Hook — runs in the MAIN world via manifest.json content_scripts world: "MAIN".
// Cannot use any extension APIs (chrome.*), only window.postMessage to communicate
// with the isolated-world content script.

(function() {
  if ((window as any).__MediaGrabberMSEHooked) return;
  (window as any).__MediaGrabberMSEHooked = true;

  const MSE_STATE: any = {
    blobUrl: null,
    mimeType: null,
    codecs: null,
    totalBytes: 0,
    segmentCount: 0,
    segmentUrls: [] as string[],
    initSegmentUrl: null,
    duration: 0
  };

  function postToContentScript(payload: any): void {
    window.postMessage(Object.assign({ source: 'MediaGrabber-MSE' }, payload), '*');
  }

  function extractCodecs(mime: string): string | null {
    const m = mime.match(/codecs="([^"]+)"/);
    return m ? m[1] : null;
  }

  function isVideoMime(mime: string): boolean {
    return mime && (mime.indexOf('video/mp4') === 0 || mime.indexOf('video/webm') === 0 || mime.indexOf('audio/mp4') === 0);
  }

  function looksLikeSegment(url: string): boolean {
    if (!url || url.indexOf('http') !== 0) return false;
    const path = url.split('?')[0].toLowerCase();
    if (path.indexOf('.m4s') >= 0) return true;
    if (path.indexOf('.mp4') >= 0) return true;
    if (path.indexOf('.webm') >= 0) return true;
    if (path.indexOf('.ts') >= 0 && path.indexOf('.ts/') < 0) return true;
    if (path.indexOf('segment') >= 0 || path.indexOf('seg-') >= 0) return true;
    if (path.indexOf('chunk') >= 0 || path.indexOf('fragment') >= 0) return true;
    if (path.indexOf('init') >= 0 && path.indexOf('.mp4') >= 0) return true;
    return false;
  }

  const origCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(obj: any): string {
    const url = origCreateObjectURL.call(this, obj);
    if (obj instanceof MediaSource) {
      MSE_STATE.blobUrl = url;
      postToContentScript({ type: 'mse-detected', blobUrl: url });
    }
    return url;
  };

  const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function(mimeType: string): SourceBuffer {
    if (isVideoMime(mimeType)) {
      MSE_STATE.mimeType = mimeType;
      MSE_STATE.codecs = extractCodecs(mimeType);
      postToContentScript({
        type: 'source-buffer',
        blobUrl: MSE_STATE.blobUrl,
        mimeType,
        codecs: MSE_STATE.codecs
      });
    }
    return origAddSourceBuffer.call(this, mimeType);
  };

  const origAppendBuffer = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function(data: any): void {
    try {
      if (data instanceof ArrayBuffer) {
        MSE_STATE.totalBytes += data.byteLength;
      } else if (data && data.buffer) {
        MSE_STATE.totalBytes += data.buffer.byteLength;
      }
      MSE_STATE.segmentCount++;

      if (MSE_STATE.segmentCount === 1) {
        postToContentScript({
          type: 'first-segment',
          blobUrl: MSE_STATE.blobUrl,
          mimeType: MSE_STATE.mimeType,
          codecs: MSE_STATE.codecs,
          totalBytes: MSE_STATE.totalBytes,
          segmentCount: MSE_STATE.segmentCount
        });
      }

      if (MSE_STATE.segmentCount % 50 === 0) {
        postToContentScript({
          type: 'progress',
          blobUrl: MSE_STATE.blobUrl,
          totalBytes: MSE_STATE.totalBytes,
          segmentCount: MSE_STATE.segmentCount
        });
      }
    } catch {}

    return origAppendBuffer.call(this, data);
  };

  const origDurationDesc = Object.getOwnPropertyDescriptor(MediaSource.prototype, 'duration');
  if (origDurationDesc && origDurationDesc.set) {
    const origDurationSet = origDurationDesc.set;
    Object.defineProperty(MediaSource.prototype, 'duration', {
      get: origDurationDesc.get,
      set: function(val: number) {
        MSE_STATE.duration = val;
        postToContentScript({ type: 'duration', blobUrl: MSE_STATE.blobUrl, duration: val });
        return origDurationSet.call(this, val);
      },
      configurable: true
    });
  }

  const origFetch = window.fetch;
  window.fetch = function(input: any, init?: any): Promise<Response> {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (looksLikeSegment(url)) {
      if (MSE_STATE.segmentUrls.length < 500) {
        MSE_STATE.segmentUrls.push(url);
        if (url.indexOf('init') >= 0 || MSE_STATE.segmentUrls.length === 1) {
          MSE_STATE.initSegmentUrl = MSE_STATE.initSegmentUrl || url;
        }
        postToContentScript({
          type: 'segment-url',
          url,
          isInit: url.indexOf('init') >= 0,
          totalUrls: MSE_STATE.segmentUrls.length
        });
      }
    }
    return origFetch.apply(this, arguments as any);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string): void {
    if (looksLikeSegment(url)) {
      if (MSE_STATE.segmentUrls.length < 500) {
        MSE_STATE.segmentUrls.push(url);
        if (url.indexOf('init') >= 0 || MSE_STATE.segmentUrls.length === 1) {
          MSE_STATE.initSegmentUrl = MSE_STATE.initSegmentUrl || url;
        }
        postToContentScript({
          type: 'segment-url',
          url,
          isInit: url.indexOf('init') >= 0,
          totalUrls: MSE_STATE.segmentUrls.length
        });
      }
    }
    return origXHROpen.apply(this, arguments as any);
  };
})();
