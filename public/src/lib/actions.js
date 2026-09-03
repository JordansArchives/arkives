// Arkives — Event delegation: the dispatcher, act() registry and _args() helper.
import { _esc } from './esc.js';

const ACTIONS = Object.create(null);
function act(map) {
  for (const name in map) {
    if (ACTIONS[name] && ACTIONS[name] !== map[name]) console.warn('act: duplicate handler name ' + name);
    ACTIONS[name] = map[name];
  }
}
function _args() {
  return _esc(JSON.stringify(Array.prototype.slice.call(arguments)));
}
const _DELEGATED = { click: 'action', input: 'input', change: 'change', keydown: 'keydown', submit: 'submit' };
function _dispatch(ev) {
  const kind = _DELEGATED[ev.type];
  if (!kind || !(ev.target instanceof Element)) return;
  const sel = '[data-' + kind + ']';
  const argsAttr = 'data-' + (kind === 'action' ? 'args' : kind + '-args');
  let el = ev.target.closest(sel);
  while (el) {
    const name = el.getAttribute('data-' + kind);
    const fn = ACTIONS[name];
    if (typeof fn !== 'function') { console.error('No handler registered for data-' + kind + '="' + name + '"'); return; }
    let args = [];
    const raw = el.getAttribute(argsAttr);
    if (raw) {
      try { args = JSON.parse(raw); } catch (e) { console.error('Bad ' + argsAttr + ' on ' + name + ': ' + raw); return; }
      if (!Array.isArray(args)) { console.error(argsAttr + ' must be a JSON array on ' + name); return; }
      const target = el;
      args = args.map(function (a) {
        if (a === '$event') return ev;
        if (a === '$el') return target;
        if (a === '$value') return target.value;
        if (a === '$checked') return target.checked;
        return a;
      });
    }
    fn.apply(el, args);
    if (el.hasAttribute('data-stop')) ev.stopPropagation();
    if (ev.cancelBubble) { ev.stopImmediatePropagation(); return; }
    el = el.parentElement ? el.parentElement.closest(sel) : null;
  }
}
// Generic handlers used across files.
function go(hash) { window.location.hash = hash; }
act({ go: go, stop: function (ev) { ev.stopPropagation(); } });

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  Object.keys(_DELEGATED).forEach(function (t) { document.addEventListener(t, _dispatch); });
}

export { ACTIONS, _DELEGATED, _args, _dispatch, act, go };
