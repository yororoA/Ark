/* The sandbox keeps an opaque origin. Only this frame's parent may configure
   its appearance; messages contain no file, account or application data. */
(() => {
  let engineLoaded = false;
  let failed = false;
  const report = () => {
    if (parent === window || (!engineLoaded && !failed)) return;
    parent.postMessage({ type: 'ark:lab:status', status: failed ? 'error' : 'ready' }, '*');
  };
  window.addEventListener('error', event => {
    const resource = event.target;
    if (resource instanceof HTMLScriptElement && resource.id === 'lab-engine') failed = true;
    else if (event instanceof ErrorEvent && !engineLoaded) failed = true;
    report();
  }, true);
  document.addEventListener('load', event => {
    if (!(event.target instanceof HTMLScriptElement) || event.target.id !== 'lab-engine') return;
    engineLoaded = true;
    // Script load follows its synchronous execution, including the existing
    // final updateUI(). Runtime errors above prevent a false ready handshake.
    if (typeof window.updateUI !== 'function' || !document.getElementById('applyBtn') || !document.getElementById('sourceCanvas')) failed = true;
    report();
  }, true);
  window.addEventListener('message', event => {
    if (event.source !== parent || parent === window || event.data?.type !== 'ark:lab:configure') return;
    const { design, mode } = event.data;
    if (!['voyage', 'default'].includes(design) || !['light', 'dark', 'system'].includes(mode)) return;
    if (design === 'voyage') {
      document.documentElement.dataset.design = 'voyage';
      document.documentElement.dataset.theme = mode;
    } else {
      delete document.documentElement.dataset.design;
      delete document.documentElement.dataset.theme;
    }
    report();
  });
  // Request the palette while the engine is still loading. Readiness remains a
  // separate message and is only sent after its initialization succeeds.
  if (parent !== window) parent.postMessage({ type: 'ark:lab:configure-request' }, '*');
})();
