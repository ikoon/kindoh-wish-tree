(() => {
  const tree = document.getElementById('original-tree-view');
  const controls = tree.parentElement.querySelectorAll('.photo-controls button');
  const sources = ['tree-model.js?v=gold5', 'fir-surface.js?v=gold5', 'lamp-spill.js?v=gold5', 'print-clearance.js?v=gold5', 'front-turn.js?v=gold5', 'tree-navigation.js?v=auto1'];
  const observer = new MutationObserver(updateControls);
  observer.observe(tree, {attributes: true, attributeFilter: ['data-front-projection', 'data-tilt-renderer']});
  function updateControls() {
    if (tree.dataset.frontProjection === 'ready' && tree.dataset.tiltRenderer === 'model3d') {
      for (const button of controls) button.disabled = false;
    } else if (tree.dataset.tiltRenderer === 'photo' || tree.dataset.frontProjection === 'fallback') {
      for (const button of controls) button.disabled = true;
    }
  }
  let started = false;
  function load() {
    if (started) return;
    started = true;
    clearTimeout(deadline);
    for (const url of sources) {
      const script = document.createElement('script');
      script.async = false;
      script.src = url;
      script.addEventListener('error', () => {
        tree.dataset.tiltRenderer = 'photo';
      }, {once: true});
      document.head.append(script);
    }
  }
  const deadline = setTimeout(load, 1400);
  tree.parentElement.addEventListener('pointerdown', load, {once: true});
  tree.querySelector('.original-tree-photo').decode().catch(() => {}).then(() => {
    requestAnimationFrame(() => setTimeout(load, 0));
  });
})();
