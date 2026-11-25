(() => {
  const form = document.querySelector('#wish-form');
  const input = document.querySelector('#wish-text');
  const count = document.querySelector('#wish-count');
  const result = document.querySelector('#wish-result');
  const treeLink = document.querySelector('#my-tree');
  const limit = 24;
  const labels = {nutcracker: '병정', snowglobe: '스노우볼', stocking: '양말', gingerbread: '진저브레드', ribbon: '리본'};
  let composing = false;

  const dialog = document.querySelector('#wish-detail');
  const detailArt = document.querySelector('#detail-art');
  const detailText = document.querySelector('#detail-text');
  const detailTitle = document.querySelector('#detail-title');
  let selectedId = null;
  let goToList = false;
  let opener = null;
  let visibleCardId = null;

  window.addEventListener('wish:compose', ({detail}) => {
    if (!Object.hasOwn(labels, detail?.art || '')) return;
    input.setAttribute('aria-label', labels[detail.art] + ' 오너먼트에 걸 소원, 24자 이내');
    input.scrollIntoView({block: 'center'});
    input.focus({preventScroll: true});
  });

  treeLink.addEventListener('click', event => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('wish:reveal', {detail:{id:visibleCardId}}));
    document.getElementById('original-tree-view').scrollIntoView({block:'center', behavior:'instant'});
  });

  window.addEventListener('wish:inspect', ({detail}) => {
    if (!detail?.id || !detail.text || !Object.hasOwn(labels, detail.art)) return;
    selectedId = detail.id;
    goToList = false;
    opener = document.activeElement;
    dialog.dataset.example = String(!!detail.example);
    detailTitle.textContent = labels[detail.art] + (detail.example ? ' 오너먼트의 예시 소원' : ' 오너먼트의 소원');
    detailArt.src = window.WISH_ORNAMENT_ASSETS?.[detail.art] || 'assets/ornaments/orn-' + detail.art + '.png';
    detailText.textContent = detail.text;
    if (!dialog.open) dialog.showModal();
  });
  document.querySelector('#close-wish').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  document.querySelector('#choose-wish').addEventListener('click', () => {
    goToList = true;
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (goToList) {
      window.dispatchEvent(new CustomEvent('wish:choose', {detail: {id: selectedId}}));
      const card = document.querySelector('#ornament-carousel .orn-card.is-center');
      card?.focus({preventScroll:true});
      card?.scrollIntoView({block:'center'});
    } else {
      if (opener?.isConnected && !opener.hidden) opener.focus({preventScroll:true});
      else document.querySelector('#original-tree-view').focus({preventScroll:true});
    }
  });

  function updateCount() {
    const length = Array.from(input.value.normalize('NFC').trim()).length;
    count.textContent = length + ' / ' + limit + '자';
    count.classList.toggle('over-limit', length > limit);
    input.setCustomValidity(length > limit ? '소원을 24자 이내로 적어주세요.' : '');
  }

  input.addEventListener('input', () => {
    updateCount();
    result.textContent = '';
    treeLink.hidden = true;
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; updateCount(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (composing || event.isComposing || event.keyCode === 229)) {
      // The IME uses Enter to confirm the current syllable.
      event.stopPropagation();
    }
  });

  window.addEventListener('wish:display', (event) => {
    const {id, art, example, focusTree} = event.detail;
    if (visibleCardId !== id) result.textContent = '';
    visibleCardId = id;
    treeLink.hidden = !!example;
    const name = labels[art] || '병정';
    input.setAttribute('aria-label', name + ' 오너먼트에 걸 소원, 24자 이내');
    if (!focusTree) return;
    result.textContent = name + ' 장식에 소원을 걸었어요.' +
      (event.detail.persisted === false ? ' 이 창을 닫기 전까지 볼 수 있어요.' : '');
    treeLink.hidden = false;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (composing) return;
    const text = input.value.normalize('NFC').trim();
    updateCount();
    if (!text) input.setCustomValidity('소원을 입력해주세요.');
    if (!input.reportValidity()) return;
    const active = document.querySelector('#ornament-carousel .orn-card.is-center');
    const art = active?.dataset.art || 'nutcracker';
    const id = globalThis.crypto?.randomUUID?.() ||
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const slot = active?.dataset.draft === 'true' && active.dataset.slot !== undefined
      ? Number(active.dataset.slot) : null;
    window.dispatchEvent(new CustomEvent('wish:add', {detail: {id, text, art, slot}}));
    input.value = '';
    updateCount();
    input.blur();
  });
})();
