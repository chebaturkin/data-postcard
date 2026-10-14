// Editor effects only. The scene string remains a complete, static export.
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const active = new Map();
const feedbackTimers = new Map();
const tokens = getComputedStyle(document.documentElement);

export function cancelMotion(root) {
  for (const [node, animation] of active) {
    if (node === root || root.contains(node)) animation.cancel();
  }
}

export function animate(node, frames, timing = 'state') {
  active.get(node)?.cancel();
  if (!node?.animate || preference.matches) return;
  const animation = node.animate(frames, {
    duration: parseFloat(tokens.getPropertyValue(`--motion-${timing}`)) || 220,
    easing: tokens.getPropertyValue('--ease-settle').trim() || 'ease-out',
  });
  active.set(node, animation);
  animation.onfinish = animation.oncancel = () => {
    if (active.get(node) === animation) active.delete(node);
  };
}

preference.addEventListener('change', () => {
  if (preference.matches) cancelMotion(document.documentElement);
});

export function feedback(node, result) {
  clearTimeout(feedbackTimers.get(node));
  node.dataset.feedback = result;
  if (result === 'success') animate(node.querySelector('svg'), [
    { transform: 'translateY(2px)', opacity: .55 }, { transform: 'none', opacity: 1 },
  ]);
  feedbackTimers.set(node, setTimeout(() => {
    delete node.dataset.feedback;
    feedbackTimers.delete(node);
  }, 1600));
}

// Match keyed chart rows across sorting, leaving text nodes untouched when equal.
const keyOf = node => node?.nodeType === 1 && (node.getAttribute('data-row-key') || node.getAttribute('data-scene'));
function syncNode(current, next) {
  if (current.isEqualNode(next)) return;
  if (current.nodeType === Node.TEXT_NODE) { current.nodeValue = next.nodeValue; return; }
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  const keyed = new Map([...current.children].filter(keyOf).map(child => [keyOf(child), child]));
  let cursor = current.firstChild;
  for (const desired of next.childNodes) {
    const key = keyOf(desired);
    let child = key ? keyed.get(key) : !keyOf(cursor) && cursor;
    if (!child || child.nodeType !== desired.nodeType || child.nodeName !== desired.nodeName) {
      child = desired.cloneNode(true);
      current.insertBefore(child, cursor);
    } else {
      if (child !== cursor) current.insertBefore(child, cursor);
      syncNode(child, desired);
    }
    cursor = child.nextSibling;
  }
  while (cursor) { const nextSibling = cursor.nextSibling; cursor.remove(); cursor = nextSibling; }
}

function rowPositions(svg) {
  return new Map([...svg.querySelectorAll('[data-row-key]')].map(row => [row.dataset.rowKey, {
    top: row.getBoundingClientRect().top,
    mark: row.querySelector('[data-mark]')?.getBoundingClientRect(),
  }]));
}

function inkIn(chart) {
  if (!chart) return;
  animate(chart, [{ opacity: .4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 'panel');
  for (const path of chart.querySelectorAll('[data-route]')) {
    const length = path.getTotalLength();
    animate(path, [
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
    ], 'paper');
  }
}

export function renderPreview(markup, effect = 'none') {
  const svg = document.getElementById('postcard-preview');
  const paper = svg.parentElement;
  const previousMode = svg.querySelector('[data-scene="chart"]')?.getAttribute('aria-label');
  const positions = effect === 'data' && !preference.matches ? rowPositions(svg) : new Map();
  // Capture the currently visible positions before cancelling an interrupted move.
  cancelMotion(paper);
  const next = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  next.id = svg.id;
  next.setAttribute('class', svg.getAttribute('class'));
  syncNode(svg, next);
  if (preference.matches) return;
  const chart = svg.querySelector('[data-scene="chart"]');
  if (effect === 'paper' || effect === 'format') {
    animate(paper, [
      { transform: 'translateY(7px) rotate(.3deg)', opacity: .88 },
      { transform: 'translateY(-1px) rotate(-.05deg)', opacity: 1, offset: .7 },
      { transform: 'none', opacity: 1 },
    ], effect === 'paper' ? 'paper' : 'ink');
  } else if (effect === 'palette') {
    animate(svg, [{ opacity: .65 }, { opacity: 1 }]);
  } else if (effect === 'ink' || (effect === 'data' && previousMode !== chart?.getAttribute('aria-label'))) {
    inkIn(chart);
  } else if (effect === 'data') {
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    if (!scale) return;
    const rows = [...svg.querySelectorAll('[data-row-key]')];
    if (!rows.length) { inkIn(chart); return; }
    // Read all geometry before starting any writes/animations.
    const targets = rows.map(row => ({ row, box: row.getBoundingClientRect(), mark: row.querySelector('[data-mark]') }));
    targets.forEach(target => { target.markBox = target.mark?.getBoundingClientRect(); });
    for (const { row, box, mark, markBox } of targets) {
      const before = positions.get(row.dataset.rowKey);
      if (!before) { animate(row, [{ opacity: .35 }, { opacity: 1 }], 'ink'); continue; }
      const dy = (before.top - box.top) / scale;
      if (Math.abs(dy) > .1) animate(row, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], 'ink');
      if (markBox && before.mark) {
        const dx = (before.mark.left - markBox.left) / scale;
        const ratio = mark.localName === 'rect' && markBox.width ? before.mark.width / markBox.width : 1;
        if (Math.abs(dx) > .1 || Math.abs(ratio - 1) > .001) animate(mark, [
          { transform: `translateX(${dx}px) scaleX(${ratio})` }, { transform: 'none' },
        ], 'ink');
      }
    }
  }
}

window.addEventListener('pagehide', () => {
  cancelMotion(document.documentElement);
  for (const [node, timer] of feedbackTimers) { clearTimeout(timer); delete node.dataset.feedback; }
  feedbackTimers.clear();
});
