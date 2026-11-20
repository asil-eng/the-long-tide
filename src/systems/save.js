// Checkpoint save in localStorage (per browser). Everything degrades gracefully if storage is blocked.
const KEY = 'dustfarm.save.v1';
export const save = {
  load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  store(data) { try { localStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() })); } catch { /* ignore */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
