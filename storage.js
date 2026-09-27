import { validateSave } from './engine.js';
const KEY='leaving-earth.prototype.v1';
export function save(storage,state) {
  const text=JSON.stringify(validateSave(state));
  const old=storage.getItem(KEY);
  if (old) { try { validateSave(JSON.parse(old)); storage.setItem(KEY+'.backup',old); } catch { /* Keep the previous valid backup. */ } }
  storage.setItem(KEY,text);
}
export function load(storage) {
  let damaged=false;
  for (const key of [KEY,KEY+'.backup']) {
    const raw=storage.getItem(key);
    if (!raw) continue;
    try { return {state:validateSave(JSON.parse(raw)),recovered:damaged}; } catch { damaged=true; }
  }
  if (damaged) throw new Error('Local saves are damaged. Import a backup or start a new campaign.');
  return {state:null,recovered:false};
}
export function importSave(text) { if (text.length>2000000) throw new Error('Save is too large.'); return validateSave(JSON.parse(text)); }