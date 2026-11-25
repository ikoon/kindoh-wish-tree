(() => {
  'use strict';

  function setup() {
    const tree = document.getElementById('original-tree-view');
    const target = document.getElementById('rear');
    const rear = document.getElementById('tilt-rear');
    const front = document.getElementById('tilt-reset');
    const name = document.getElementById('heading-name');
    const api = window.wishPhotoTilt;
    if (!tree || !target || !rear || !front || !name || !api) return;

    const toggle = document.getElementById('spin-toggle');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let playing = !reduced.matches, visible = false, held = null, last = 0, resume = 0, frame = 0;
    function schedule() {
      cancelAnimationFrame(frame);
      last = 0;
      toggle.textContent = playing ? '회전 정지' : '자동 회전';
      toggle.setAttribute('aria-pressed', String(playing));
      if (playing && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function tick(now) {
      if (last && now >= resume && held === null && tree.dataset.frontProjection && tree.dataset.tiltRenderer === 'model3d' && !document.querySelector('dialog[open]')) {
        api.setAngle(api.getAngle() + Math.min(now-last, 70) * .008);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    }
    const delay = () => { resume = performance.now() + 1800; };
    tree.parentElement.addEventListener('pointerdown', e => { if (e.isPrimary) held = e.pointerId; }, true);
    function release(e) { if (held === e.pointerId) { held = null; delay(); } }
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', () => { held = null; delay(); });
    tree.parentElement.addEventListener('keydown', delay, true);
    toggle.addEventListener('click', () => { playing = !playing; resume = 0; schedule(); });
    reduced.addEventListener('change', () => { playing = !reduced.matches; schedule(); });
    document.addEventListener('visibilitychange', schedule);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(tree);
    schedule();

    const headings = ['정면', '앞쪽 사선', '옆면', '뒤쪽 사선', '뒷면', '뒤쪽 사선', '옆면', '앞쪽 사선'];
    function identify(angle) {
      const value = ((angle % 360) + 360) % 360;
      name.textContent = headings[Math.round(value / 45) % 8];
      const atFront = value < .01 || value > 359.99;
      const atRear = Math.abs(value - 180) < .01;
      const switchFromRear = atRear && document.activeElement === rear;
      const switchFromFront = atFront && document.activeElement === front;
      rear.hidden = atRear;
      front.hidden = atFront;
      if (switchFromRear) front.focus({preventScroll: true});
      if (switchFromFront) rear.focus({preventScroll: true});
    }

    rear.addEventListener('click', () => api.setAngle(180));
    window.addEventListener('wish:tilt', ({detail}) => identify(detail.angle));
    identify(api.getAngle());

    // The renderer queues this angle if its images are still decoding.
    function applyLink() {
      if (location.hash === '#rear') {
        api.setAngle(180);
        target.scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'});
      } else if (['', '#wish-tree'].includes(location.hash)) {
        api.setAngle(0);
      }
    }
    applyLink();
    if (location.hash === '#tree-stage') {
      const requested = new URLSearchParams(location.search).get('angle');
      if (requested && /^\d{1,3}(?:\.\d+)?$/.test(requested) && Number(requested) <= 360) {
        api.setAngle(Number(requested));
      }
    }
    window.addEventListener('hashchange', applyLink);
    if (location.hash === '#rear') {
      let moved = false;
      const observedGesture = () => { moved = true; };
      const gestureTypes = ['pointerdown', 'wheel', 'keydown'];
      gestureTypes.forEach(type => window.addEventListener(type, observedGesture, {passive: true}));
      // A native refresh can restore an old scroll position after DOMContentLoaded.
      // Recenter once after native restoration unless the visitor already navigated.
      window.addEventListener('pageshow', () => {
        gestureTypes.forEach(type => window.removeEventListener(type, observedGesture));
        if (!moved && location.hash === '#rear') applyLink();
      }, {once: true});
    }
    window.addEventListener('pageshow', event => {
      if (event.persisted) applyLink();
    });

    // Give the same clear disabled state as the ordinary rotation buttons on load failure.
    const observer = new MutationObserver(() => {
      if (!tree.dataset.tiltRenderer) return;
      rear.disabled = tree.dataset.tiltRenderer === 'photo';
    });
    observer.observe(tree, {attributes: true, attributeFilter: ['data-tilt-renderer']});
    rear.disabled = tree.dataset.tiltRenderer === 'photo';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
})();
