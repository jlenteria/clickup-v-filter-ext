const api = typeof browser !== 'undefined' ? browser : chrome;
const KEY = 'clickupHideConfig';
const DEFAULTS = { enabled: true, channelFilter: '', reveal: false };
async function seed() {
  for (const delay of [0, 120, 300, 700]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const stored = await api.storage.local.get(KEY);
      if (stored[KEY] === undefined) await api.storage.local.set({ [KEY]: DEFAULTS });
      return;
    } catch {}
  }
}
api.runtime.onInstalled.addListener(seed);
if (api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener(async (name) => {
    const type = { 'toggle-hidden': 'cvf:toggle', 'toggle-controls': 'cvf:toggle-controls' }[name];
    if (!type) return;
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/app\.clickup\.com\//.test(tab.url || '')) return;
    try { await api.tabs.sendMessage(tab.id, { type }); } catch {}
  });
}
