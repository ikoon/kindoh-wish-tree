(() => {
  'use strict';
  const stage = document.getElementById('original-tree-view');
  if (!stage) return;

  const sourceWidth = 1440;
  const cropHeight = 1940;
  const cropTop = 770;
  const image = document.createElement('img');
  image.className = 'original-tree-photo';
  image.width = sourceWidth;
  image.height = cropHeight;
  image.alt = '금빛 별과 가족의 소원 장식이 걸린 킨도 크리스마스 트리';
  image.draggable = false;
  image.fetchPriority = 'high';
  image.src = window.WISH_ORIGINAL_PHOTO || 'assets/original-tree.webp';
  const layer = document.createElement('div');
  layer.className = 'original-wish-layer';
  const lightPlate = new Image(sourceWidth, cropHeight);
  lightPlate.className = 'front-lamp-exposure';
  lightPlate.alt = '';
  lightPlate.draggable = false;
  lightPlate.setAttribute('aria-hidden', 'true');
  lightPlate.src = window.WISH_FRONT_LIGHTS || 'assets/environment/front-lamp-exposure.webp';
  stage.append(image, lightPlate, layer);

  // Coordinates are measured on the supplied 1440 × 10000 photograph.
  // Each row: cream writing area (center x/y, safe width/height, angle), then
  // the touch bounds covering both the illustrated character and its plaque.
  const places = {
    nutcracker: [
      [864.5,2257.5,141,43,0, 777,2071,954,2322],
      [947,1996,114,42,0, 850,1795,1024,2057],
      [654,1767,112,42,0, 573,1580,735,1827]
    ],
    gingerbread: [
      [568,2278,116,42,0, 486,2080,649,2340],
      [497,1906,89,37,-4, 427,1761,562,1966],
      [617,1301,83,32,-14, 551,1175,678,1349],
      [924,1538,85,34,14, 854,1407,990,1586]
    ],
    snowglobe: [
      [407,2240,88,30,0, 346,2090,471,2286],
      [1030,2292,88,30,0, 968,2140,1095,2339],
      [686,1478,79,28,0, 627,1341,745,1522],
      [805,1382,70,25,0, 754,1252,858,1421]
    ],
    ribbon: [
      [805,1161,67,29,26, 752,1106,868,1214],
      [536,1620,67,31,-27, 482,1524,591,1681],
      [994,1754,56,27,38, 929,1669,1041,1814]
    ],
    stocking: [
      [722.5,2092.5,133,45,0, 631,1900,813,2150],
      [827,1719,110,38,0, 749,1556,905,1770],
      [384,1990,34,43,16, 351,1825,438,2035]
    ]
  };

  window.WISH_FRONT_PLACES = places;
  window.WISH_FRONT_SLOT_COUNTS = Object.freeze(Object.fromEntries(
    Object.entries(places).map(([art, slots]) => [art, slots.length])
  ));
  window.WISH_PHOTO_SLOT_COUNTS = Object.freeze(Object.fromEntries(Object.entries(places).map(([art,slots]) => [art, slots.length * 3])));
  const artNames = { nutcracker: '병정', gingerbread: '진저브레드', snowglobe: '스노우볼', stocking: '양말', ribbon: '리본' };
  const metric = document.createElement('canvas').getContext('2d');
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
  const planted = [];
  const sampleCue = document.createElement('span');
  sampleCue.className = 'tree-example-cue';
  sampleCue.textContent = '예시 소원';
  sampleCue.hidden = true;
  stage.append(sampleCue);

  function openWish(wish, art, slot) {
    const id = wish?.id || 'draft-' + art;
    window.dispatchEvent(new CustomEvent('wish:choose', { detail: { id, slot } }));
    const action = wish?.text ? 'wish:inspect' : 'wish:compose';
    window.dispatchEvent(new CustomEvent(action, {
      detail: { id, slot, art, text: wish?.text || '', example: !!wish?.example }
    }));
  }

  function previewText(message, width, height) {
    const value = message.trim().replace(/\s+/g, ' ');
    const glyphs = segmenter ? Array.from(segmenter.segment(value), p => p.segment) : Array.from(value);
    const baseSize = Math.min(height * .44, width * .27);
    const fontFamily = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
    function balanced(text, size, wordsOnly) {
      metric.font = '650 ' + size + 'px ' + fontFamily;
      if (metric.measureText(text).width <= width) return { text, size };
      const chars = segmenter ? Array.from(segmenter.segment(text), p => p.segment) : Array.from(text);
      let best = null;
      let leastDifference = Infinity;
      for (let i = 1; i < chars.length; i++) {
        if (wordsOnly && chars[i - 1] !== ' ' && chars[i] !== ' ') continue;
        const a = chars.slice(0, i).join('').trim();
        const b = chars.slice(i).join('').trim();
        if (!a || !b || b === '…') continue;
        const w1 = metric.measureText(a).width, w2 = metric.measureText(b).width;
        const difference = Math.abs(w1 - w2);
        if (Math.max(w1, w2) <= width && difference < leastDifference) {
          best = { text: a + '\n' + b, size };
          leastDifference = difference;
        }
      }
      return best;
    }
    // Preserve Korean word endings even when shrinking slightly would avoid
    // splitting a syllable group. Long unspaced words can break by grapheme.
    const sizes = [baseSize, baseSize * .93, baseSize * .86];
    for (const wordsOnly of [true, false]) {
      for (const size of sizes) {
        const fit = balanced(value, size, wordsOnly);
        if (fit) return fit;
      }
    }
    const size = sizes[sizes.length - 1];
    for (let n = glyphs.length - 1; n > 0; n--) {
      const short = glyphs.slice(0, n).join('').trimEnd() + '…';
      const fit = balanced(short, size, true) || balanced(short, size, false);
      if (fit) return fit;
    }
    return { text: '…', size };
  }

  function positionLabel({button, writing, place}) {
    const [x,y,width,height,angle,left,top,right,bottom] = place;
    button.style.left = (left/sourceWidth*100) + '%';
    button.style.top = ((top-cropTop)/cropHeight*100) + '%';
    button.style.width = ((right-left)/sourceWidth*100) + '%';
    button.style.height = ((bottom-top)/cropHeight*100) + '%';
    writing.style.left = ((x-left)/(right-left)*100) + '%';
    writing.style.top = ((y-top)/(bottom-top)*100) + '%';
    writing.style.transform = 'translate(-50%,-50%) rotate('+angle+'deg)';
  }

  for (const [art, slots] of Object.entries(places)) {
    for (const [slot, place] of slots.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'original-wish-hit';
      button.dataset.art = art;
      button.dataset.slot = String(slot);
      const writing = document.createElement('span');
      writing.className = 'original-wish-writing';
      writing.setAttribute('aria-hidden', 'true');
      writing.style.width = (place[2] / sourceWidth * 100) + 'cqw';
      writing.style.height = (place[3] / sourceWidth * 100) + 'cqw';
      button.append(writing);
      layer.append(button);
      const plaque = { button, writing, place, art, slot, wish: null };
      planted.push(plaque);
      button.addEventListener('click', () => {
        const wish = plaque.wish;
        openWish(wish, art, slot);
      });
    }
  }

  function render({ornaments, id, examples, allExamples}) {
    sampleCue.hidden = !examples;
    sampleCue.textContent = allExamples ? '예시 소원' : '예시 소원 포함';
    const physical = new Map((window.wishModelOrnaments?.list() || []).map(w => [w.id, w.poseKey]));
    const assignments = new Map();
    for (const wish of ornaments) {
      const nominal = wish.art + ':' + wish.slot;
      const key = physical.get(wish.id) || nominal;
      if (!assignments.has(key) || physical.has(wish.id)) assignments.set(key, wish);
    }
    for (const plaque of planted) {
      const { button, writing, place, art, slot } = plaque;
      const key = art + ':' + slot;
      const wish = assignments.get(key);
      const selected = wish?.id === id;
      plaque.wish = wish;
      button.dataset.wishId = wish?.id || 'draft-' + art;
      button.dataset.example = String(!!wish?.example);
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-label', artNames[art] +
        (wish ? (wish.example ? ' 장식의 예시 소원, ' : ' 장식의 소원, ') + wish.text : ' 빈 장식, 눌러 소원 쓰기'));
      if (writing.dataset.message !== (wish?.text || '')) {
        writing.dataset.message = wish?.text || '';
        if (wish) {
          const fitted = previewText(wish.text, place[2], place[3]);
          writing.style.fontSize = (fitted.size / sourceWidth * 100) + 'cqw';
          writing.textContent = fitted.text;
        } else {
          writing.textContent = '';
        }
      }
      positionLabel(plaque);
    }
    window.dispatchEvent(new Event('wish:front-ink'));
  }

  // The same ink is used on the front-facing photograph as it begins to turn.
  window.paintWishFront = (context) => {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const {place, writing, wish} of planted) {
      if (!wish || !writing.textContent) continue;
      const [x,y,,,rotation] = place;
      const size = parseFloat(writing.style.fontSize) * sourceWidth / 100;
      const lines = writing.textContent.split('\n');
      context.save();
      context.translate(x, y - cropTop);
      context.rotate(rotation * Math.PI / 180);
      context.font = '650 '+size+'px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
      context.fillStyle = '#412719';
      lines.forEach((line,i) => context.fillText(line, 0, (i-(lines.length-1)/2)*size*1.08));
      context.restore();
    }
  };

  let latestDisplay;
  window.addEventListener('wish:display', ({ detail }) => {
    if (!Array.isArray(detail?.ornaments)) return;
    latestDisplay = detail;
    // Wait until the 3D mounts have claimed their slots for this update.
    queueMicrotask(() => { if (detail === latestDisplay) render(detail); });
  });
})();
