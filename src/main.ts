import initViz from './charts/init';

initViz().catch(err => {
  console.error('[wow-vis] initViz failed:', err);
  const msg = document.createElement('p');
  msg.style.cssText = 'color:#f87171;padding:20px;font-family:monospace;white-space:pre-wrap';
  msg.textContent = `Error: ${err?.message ?? err}`;
  document.body.prepend(msg);
});
