(() => {
  'use strict';

  const root = document.getElementById('ornament-carousel');
  if (!root) return;

  const artNames = { nutcracker: '병정', snowglobe: '스노우볼', gingerbread: '진저브레드', stocking: '양말', ribbon: '리본' };
  // Each demonstration record belongs to one cream plaque in the reference
  // photograph. The two reference renderWishes examples are included.
  const frontExamples = [
    ['nutcracker', 0, '우리 가족 건강하자'],
    ['snowglobe', 3, '첫눈을 함께 봐요'],
    ['gingerbread', 1, '우리 아기 잘 자요'],
    ['stocking', 0, '웃음 가득한 아침'],
    ['snowglobe', 0, '행운이 찾아오길'],
    ['gingerbread', 0, '포근한 꿈 꾸기를'],
    ['nutcracker', 1, '씩씩하게 자라렴'],
    ['stocking', 2, '늘 행복해'],
    ['snowglobe', 1, '함께라서 행복해'],
    ['gingerbread', 2, '사랑이 가득하길'],
    ['nutcracker', 2, '눈길 함께 걷자'],
    ['snowglobe', 2, '매일 웃어 주렴'],
    ['gingerbread', 3, '따뜻한 겨울 보내자'],
    ['ribbon', 0, '고마워', 14],
    ['ribbon', 1, '늘 함께', 15],
    ['ribbon', 2, '평안하길', 16],
    ['stocking', 1, '킨도야 사랑해', 13]
  ].map(([art, slot, text, originalId], i) => ({ id: 'sample-' + (originalId ?? i), art, slot, text, example: true }));
  // Each mount owns an independent wish, including around the far side.
  // The original event's 17 IDs and already-saved physical slots stay stable.
  const sideMessages = [
    '오늘도 푹 자렴', '눈사람 만들자', '소중한 우리 아기', '웃는 아침 맞자',
    '반짝이는 첫겨울', '한 걸음씩 천천히', '따뜻하게 안아 줄게', '사랑 가득한 날',
    '소복소복 첫눈', '네 꿈을 응원해', '손잡고 걷자', '우리 집에 찾아온 봄',
    '작은 기적', '늘 곁에', '꿈을 꿔', '같이 놀자', '행복한 밤 보내렴'
  ];
  const rearMessages = [
    '온 가족 도란도란', '별빛 아래 소풍', '무럭무럭 자라렴', '우리 내일도 웃자',
    '눈꽃처럼 반짝여', '다정한 꿈 꾸자', '생애 첫 크리스마스', '사뿐사뿐 첫걸음',
    '기쁨이 피어나길', '우리 오래오래', '하얀 겨울의 추억', '산타가 오는 밤',
    '별 하나', '꼭 안아', '널 응원해', '많이 웃자', '포근한 우리 집'
  ];
  const examples = [...frontExamples];
  for (const [sector, messages] of [sideMessages, rearMessages].entries()) {
    frontExamples.forEach((front, index) => {
      const slot = front.slot + (sector + 1) * window.WISH_FRONT_SLOT_COUNTS[front.art];
      examples.push({
        id: 'sample-' + (17 + sector * 17 + index), art: front.art, slot,
        text: messages[index], example: true
      });
    });
  }
  const slotCounts = window.WISH_PHOTO_SLOT_COUNTS;
  const artWidths = { nutcracker: 602, stocking: 469, snowglobe: 481, gingerbread: 481, ribbon: 481 };
  const assets = window.WISH_ORNAMENT_ASSETS || {};
  const storagePrefix = 'kindoh.wish-tree.wish.v1.';
  const saved = readSavedWishes();
  const wishes = [...examples];
  for (const entry of saved) {
    if (entry.slot == null) {
      entry.slot = leastOccupied(entry.art);
      saveWish(entry);
    }
    replaceExample(entry);
    wishes.push(entry);
  }
  const indices = new Map(wishes.map((entry, i) => [entry.id, i]));
  let latestTime = saved.length ? saved[saved.length - 1].createdAt : 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wrap = (n) => ((n % wishes.length) + wishes.length) % wishes.length;
  const padded = (n) => String(n).padStart(2, '0');

  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', '캐러셀');
  root.setAttribute('aria-label', '가족의 소원 오너먼트');
  root.innerHTML = `
    <div class="orn-viewport"></div>
    <div class="orn-controls">
      <button class="orn-nav orn-prev" type="button" aria-label="이전 소원 보기">이전 소원</button>
      <span class="orn-count" aria-hidden="true">
        <span class="orn-current">01</span><span class="orn-separator"></span>
        <span class="orn-total"></span>
      </span>
      <button class="orn-nav orn-next" type="button" aria-label="다음 소원 보기">다음 소원</button>
    </div>
    <span class="orn-announcement" aria-live="polite" aria-atomic="true"></span>`;

  const viewport = root.querySelector('.orn-viewport');
  const cue = document.createElement('span');
  cue.className = 'orn-demo-cue';
  cue.textContent = '예시 소원';
  root.querySelector('.orn-controls').prepend(cue);
  const counter = root.querySelector('.orn-current');
  const announcement = root.querySelector('.orn-announcement');
  const total = root.querySelector('.orn-total');
  total.textContent = padded(wishes.length);
  cue.hidden = !wishes[saved.length ? wishes.length - 1 : 0].example;
  let position = saved.length ? wishes.length - 1 : 0;
  let target = position;
  let step = 160;
  let frameWidth = 1;
  let layout = [];
  let circumference = 1;
  let animation = 0;
  let displayedTree = false;
  let gesture = null;
  let lastWheel = -Infinity;
  let blockClickUntil = -Infinity;

  const cards = wishes.map(makeCard);

  function makeCard({ id, art, text: message, example }) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'orn-card';
    card.dataset.art = art;
    card.dataset.wishId = id;
    card.dataset.draft = String(!!example);
    card.dataset.example = String(!!example);
    card.tabIndex = -1;
    card.setAttribute('aria-label', artNames[art] + ' 장식, 소원 보기');

    const img = document.createElement('img');
    img.src = assets[art] || 'assets/ornaments/orn-' + art + '.png';
    img.alt = '';
    img.draggable = false;

    const text = document.createElement('span');
    text.className = 'orn-message';
    text.setAttribute('aria-hidden', 'true');
    if (Array.from(message).length > 16) text.classList.add('orn-long');
    text.textContent = message;

    card.append(img, text);
    viewport.append(card);
    card.addEventListener('click', () => {
      if (performance.now() < blockClickUntil) return;
      const index = indices.get(id);
      if (card.classList.contains('is-center') && Math.abs(offsetFromPosition(index)) < .1) {
        centerOn(index);
        displayWish(wishes[index], false, true);
        activate(wishes[index]);
      } else {
        goTo(position + offsetFromPosition(index));
      }
    });
    return card;
  }

  function activate(wish) {
    const type = wish.example ? 'wish:compose' : 'wish:inspect';
    window.dispatchEvent(new CustomEvent(type, { detail: { id: wish.id, art: wish.art, slot: wish.slot, text: wish.text } }));
  }

  function leastOccupied(art) {
    const count = slotCounts[art];
    const used = Array(count).fill(0);
    for (const entry of wishes) {
      if (!entry.example && entry.art === art && Number.isInteger(entry.slot)) used[entry.slot]++;
    }
    return used.indexOf(Math.min(...used));
  }

  function replaceExample(entry) {
    const i = wishes.findIndex(wish => wish.example && wish.art === entry.art && wish.slot === entry.slot);
    if (i >= 0) wishes.splice(i, 1);
  }

  // Preserve the reference's different artwork widths and its 111/1440 gap.
  function updateLayout() {
    let x = 0;
    layout = wishes.map((wish, index) => {
      const start = x;
      const next = wishes[(index + 1) % wishes.length];
      x += (artWidths[wish.art] / 2 + 111 + artWidths[next.art] / 2) / 1440;
      return start;
    });
    circumference = x;
  }

  function trackX(index) {
    const whole = Math.floor(index);
    const i = wrap(whole);
    const next = i + 1 < layout.length ? layout[i + 1] : circumference;
    return Math.floor(whole / wishes.length) * circumference + layout[i] + (index - whole) * (next - layout[i]);
  }

  function offsetFromPosition(index) {
    return wrap(index - position + wishes.length / 2) - wishes.length / 2;
  }

  function paint() {
    const nearest = wrap(Math.round(position));
    cards.forEach((card, i) => {
      const offset = offsetFromPosition(i);
      const distance = Math.abs(offset);
      const visible = distance < 1.85;
      const middle = i === nearest;
      const side = Math.min(distance, 1);
      card.style.visibility = visible ? 'visible' : 'hidden';
      card.style.pointerEvents = visible ? 'auto' : 'none';
      card.classList.toggle('is-center', middle);
      card.setAttribute('aria-hidden', String(!visible));
      const item = wishes[i];
      const name = artNames[item.art];
      card.setAttribute('aria-label', name + (item.example ? ' 장식의 예시 소원. ' : ' 장식의 소원. ') +
        item.text + (middle && item.example ? ', 눌러 내 소원 쓰기' : ''));
      card.tabIndex = middle ? 0 : -1;
      if (!visible) return;
      card.style.zIndex = String(Math.round(100 - distance * 20));
      const offsetPx = frameWidth * (trackX(position + offset) - trackX(position));
      card.style.transform = 'translate3d(calc(-50% + ' + offsetPx + 'px), 0, 0) scale(' + (1 - side * .04) + ')';
      card.style.opacity = String(Math.max(0, 1 - side * .43 - Math.max(0, distance - 1) * .7));
      card.style.filter = 'blur(' + (side * 2) + 'px)';
    });
    counter.textContent = padded(nearest + 1);
    cue.hidden = !wishes[nearest].example;
  }

  function announce() {
    const i = wrap(Math.round(position));
    const wish = wishes[i];
    announcement.textContent = artNames[wish.art] + (wish.example ? ' 예시 소원. ' : ' 장식. ') + wish.text;
  }

  function revealCenteredWish() {
    const wish = wishes[wrap(target)];
    displayWish(wish, false, true);
    window.dispatchEvent(new CustomEvent('wish:reveal', {detail:{id:wish.id}}));
  }

  function goTo(value) {
    target = Math.round(value);
    cancelAnimationFrame(animation);
    const start = position;
    const distance = target - start;
    if (Math.abs(distance) < .001 || reducedMotion.matches) {
      position = target;
      paint();
      announce();
      revealCenteredWish();
      return;
    }
    const begun = performance.now();
    const duration = Math.min(420, 230 + Math.abs(distance) * 65);
    const tick = (now) => {
      const t = Math.min(1, (now - begun) / duration);
      position = start + distance * (1 - Math.pow(1 - t, 3));
      paint();
      if (t < 1) animation = requestAnimationFrame(tick);
      else {
        announce();
        revealCenteredWish();
      }
    };
    animation = requestAnimationFrame(tick);
  }

  function measure() {
    frameWidth = viewport.getBoundingClientRect().width;
    step = Math.max(60, frameWidth * .44);
    paint();
  }

  root.querySelector('.orn-prev').addEventListener('click', () => goTo(target - 1));
  root.querySelector('.orn-next').addEventListener('click', () => goTo(target + 1));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.target.classList.contains('orn-card')) {
      // Keep keyboard focus inside the carousel while the active card moves.
      const nav = root.querySelector(event.key === 'ArrowLeft' ? '.orn-prev' : '.orn-next');
      nav.focus({ preventScroll: true });
    }
    goTo(target + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  viewport.addEventListener('pointerdown', (event) => {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
      origin: position, axis: '', time: performance.now() };
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (gesture.axis === 'x') {
        cancelAnimationFrame(animation);
        gesture.origin = position;
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('is-dragging');
      }
    }
    if (gesture.axis !== 'x') return;
    position = gesture.origin - dx / step;
    paint();
  });

  function finishGesture(event, cancelled) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { origin, axis, x, time } = gesture;
    gesture = null;
    viewport.classList.remove('is-dragging');
    if (axis !== 'x') return;
    blockClickUntil = performance.now() + 250;
    const travel = (x - event.clientX) / step;
    const quick = performance.now() - time < 340;
    let next = Math.round(position);
    if (!cancelled && Math.abs(travel) > (quick ? .1 : .22) && next === Math.round(origin)) {
      next = Math.round(origin) + Math.sign(travel);
    }
    goTo(next);
  }

  viewport.addEventListener('pointerup', event => finishGesture(event, false));
  viewport.addEventListener('pointercancel', event => finishGesture(event, true));
  viewport.addEventListener('pointerleave', event => {
    if (gesture && gesture.axis !== 'x') finishGesture(event, true);
  });
  viewport.addEventListener('wheel', event => {
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (!horizontal) return;
    event.preventDefault();
    if (Math.abs(horizontal) < 4) return;
    const now = performance.now();
    const newGesture = now - lastWheel > 160;
    lastWheel = now;
    if (newGesture) goTo(target + Math.sign(horizontal));
  }, { passive: false });

  function parseWish(data) {
    if (!data || typeof data.id !== 'string' || !data.id || typeof data.text !== 'string') return null;
    if (data.id.startsWith('draft-') || /^sample-\d+$/.test(data.id)) return null;
    const text = data.text.normalize('NFC').trim().replace(/[\r\n]+/g, ' ');
    if (!text || Array.from(text).length > 24) return null;
    const art = Object.prototype.hasOwnProperty.call(artNames, data.art) ? data.art : 'nutcracker';
    const createdAt = Number.isFinite(data.createdAt) ? data.createdAt : 0;
    const slot = Number.isInteger(data.slot) && data.slot >= 0 && data.slot < slotCounts[art] ? data.slot : null;
    return { id: data.id, text, art, createdAt, slot };
  }

  function readSavedWishes() {
    const result = [];
    try {
      const storage = window.localStorage;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key || !key.startsWith(storagePrefix)) continue;
        try {
          const entry = parseWish(JSON.parse(storage.getItem(key)));
          if (entry && key === storagePrefix + entry.id) result.push(entry);
        } catch {
          // Ignore a malformed entry without losing other saved wishes.
        }
      }
    } catch {
      // Wishes can still be displayed when the browser blocks local storage.
    }
    return result.sort(inCreatedOrder);
  }

  function saveWish(entry) {
    try {
      window.localStorage.setItem(storagePrefix + entry.id, JSON.stringify(entry));
      return true;
    } catch {
      return false;
    }
  }

  function inCreatedOrder(a, b) {
    return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
  }

  function insertWish(entry) {
    const existing = indices.get(entry.id);
    if (existing !== undefined) return existing;
    cancelAnimationFrame(animation);
    gesture = null;
    viewport.classList.remove('is-dragging');

    const centeredId = wishes[wrap(Math.round(position))].id;
    if (entry.slot == null) entry.slot = leastOccupied(entry.art);
    replaceExample(entry);
    const following = wishes.findIndex(wish => !wish.example && inCreatedOrder(entry, wish) < 0);
    const index = following < 0 ? wishes.length : following;
    wishes.splice(index, 0, entry);
    updateLayout();
    indices.clear();
    wishes.forEach((wish, i) => indices.set(wish.id, i));
    viewport.replaceChildren();
    cards.splice(0, cards.length, ...wishes.map(makeCard));
    target = position = indices.get(centeredId) ?? index;
    total.textContent = padded(wishes.length);
    latestTime = Math.max(entry.createdAt, latestTime);
    return index;
  }

  function centerOn(index) {
    cancelAnimationFrame(animation);
    gesture = null;
    viewport.classList.remove('is-dragging');
    target = position = index;
    paint();
    announce();
  }

  function displayWish({ id, text, art }, focusTree, persisted) {
    displayedTree = true;
    const current = wishes[indices.get(id)];
    const slot = current.slot;
    cards[indices.get(id)].dataset.slot = String(slot);
    const ornaments = wishes.map(({ id, art, text, slot, example }) => ({ id, art, text, slot, example: !!example }));
    window.dispatchEvent(new CustomEvent('wish:display', {
      detail: {
        id, text, art, slot, example: !!current.example,
        examples: ornaments.some(entry => entry.example), allExamples: ornaments.every(entry => entry.example),
        ornaments, focusTree, persisted
      }
    }));
  }

  window.addEventListener('wish:choose', event => {
    const index = indices.get(event.detail?.id);
    if (index === undefined) return;
    centerOn(index);
    displayWish(wishes[index], false, true);
  });

  window.addEventListener('wish:add', event => {
    const entry = parseWish(event.detail);
    if (!entry) return;
    entry.createdAt = Math.max(Date.now(), latestTime + 1);
    const selectedDraft = wishes[wrap(Math.round(position))];
    if (entry.slot == null && selectedDraft.example && selectedDraft.art === entry.art) entry.slot = selectedDraft.slot;
    const index = insertWish(entry);
    const selected = wishes[index];
    const persisted = saveWish(selected);
    centerOn(index);
    displayWish(selected, true, persisted);
    window.dispatchEvent(new CustomEvent('wish:reveal', {detail:{id:selected.id}}));
  });

  window.addEventListener('storage', event => {
    if (!event.key || !event.key.startsWith(storagePrefix) || !event.newValue) return;
    let entry;
    try { entry = parseWish(JSON.parse(event.newValue)); } catch { return; }
    if (entry && event.key === storagePrefix + entry.id && !indices.has(entry.id)) {
      insertWish(entry);
      paint();
      displayWish(wishes[wrap(Math.round(position))], false, true);
    }
  });

  const restore = () => setTimeout(() => {
    if (!displayedTree) displayWish(saved.length ? saved[saved.length - 1] : wishes[0], false, true);
  }, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true });
  else restore();

  updateLayout();
  measure();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(viewport);
  else window.addEventListener('resize', measure);
})();
