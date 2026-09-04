// Arkives — the store factory.
// A store owns a slice of `state` (its `keys`), knows how to load it once,
// and tells subscribers when it changed. Views subscribe while mounted (the
// router does this) and re-render on notify(); domain writes live on the
// store and call notify() after they change state.
import { state } from '../state.js';

export function defineStore(name, { keys, fetch, deps = [] }) {
  let promise = null;
  const subs = new Set();
  const store = {
    name,
    keys,
    loaded: false,
    // Idempotent: the first call fetches, later calls return the same
    // promise. Without a signed-in user it is a no-op (tests and the
    // shared-link routes stub or skip data), and a failed fetch leaves the
    // store unloaded so the next navigate tries again.
    load() {
      if (promise) return promise;
      if (!state._authUser) return Promise.resolve(false);
      promise = (async () => {
        await Promise.all(deps.map((d) => d.load()));
        const ok = await fetch();
        store.loaded = ok !== false;
        if (!store.loaded) promise = null;
        return store.loaded;
      })();
      return promise;
    },
    reload() { promise = null; store.loaded = false; return store.load(); },
    reset() { promise = null; store.loaded = false; },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    notify() {
      for (const fn of [...subs]) {
        try { fn(); } catch (e) { console.error('store ' + name + ': subscriber failed', e); }
      }
    },
  };
  return store;
}
