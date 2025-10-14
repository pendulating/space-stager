// Global keymap service: single keydown/keyup listeners with prioritized subscribers.
// Consumers should use the companion hook in hooks/useGlobalKeymap.js

const subscribers = {
  keydown: new Map(),
  keyup: new Map()
};

let nextId = 1;
let isInstalled = false;

function matchesDescriptor(event, desc) {
  if (desc == null) return false;
  const { key, code, ctrl, alt, shift, meta } = desc;

  const keyMatches = Array.isArray(key)
    ? key.includes(event.key)
    : (typeof key === 'string' ? event.key === key : true);

  const codeMatches = Array.isArray(code)
    ? code.includes(event.code)
    : (typeof code === 'string' ? event.code === code : true);

  if (!keyMatches || !codeMatches) return false;

  if (typeof ctrl === 'boolean' && event.ctrlKey !== ctrl) return false;
  if (typeof alt === 'boolean' && event.altKey !== alt) return false;
  if (typeof shift === 'boolean' && event.shiftKey !== shift) return false;
  if (typeof meta === 'boolean' && event.metaKey !== meta) return false;

  return true;
}

function installGlobalListeners() {
  if (isInstalled || typeof document === 'undefined') return;
  const dispatch = (type) => (ev) => {
    const list = Array.from(subscribers[type].values())
      .filter((s) => s && (s.enabled == null || !!(typeof s.enabled === 'function' ? s.enabled() : s.enabled)))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const sub of list) {
      if (!matchesDescriptor(ev, sub)) continue;
      try {
        if (sub.preventDefault) ev.preventDefault();
        sub.onEvent && sub.onEvent(ev);
      } catch (_) {}
      if (sub.stop) break;
      if (ev.defaultPrevented) break;
    }
  };
  document.addEventListener('keydown', dispatch('keydown'));
  document.addEventListener('keyup', dispatch('keyup'));
  isInstalled = true;
}

export function subscribeKey(binding) {
  if (!binding) return () => {};
  installGlobalListeners();
  const type = binding.type === 'keyup' ? 'keyup' : 'keydown';
  const id = nextId++;
  subscribers[type].set(id, binding);
  return () => {
    try { subscribers[type].delete(id); } catch (_) {}
  };
}

export function clearAllKeySubscribers() {
  try { subscribers.keydown.clear(); } catch (_) {}
  try { subscribers.keyup.clear(); } catch (_) {}
}

export function makeKeyBinding(options) {
  return Object.assign({ type: 'keydown', priority: 0, stop: false, preventDefault: false }, options || {});
}


