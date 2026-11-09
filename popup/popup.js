const api = typeof browser !== 'undefined' ? browser : chrome;
const KEY = 'clickupHideConfig';
const $ = (id) => document.getElementById(id);
const defaults = { enabled: true, channelFilter: '', reveal: false };

function setStatus(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}

function renderStatus(res) {
  $('enabled').checked = res.enabled;
  $('controls').textContent = res.controlsVisible ? 'Hide message buttons' : 'Show Hide buttons';
  $('controls').setAttribute('aria-pressed', String(!!res.controlsVisible));
  $('controls').disabled = !res.enabled || !res.inScope;
  $('toggle').textContent = res.reveal ? 'Hide messages again' : 'Show hidden messages';
  $('toggle').setAttribute('aria-pressed', String(!!res.reveal));
  if (!res.enabled) setStatus('Hiding is paused.');
  else if (!res.inScope) setStatus('This page is outside your channel filter.');
  else if (res.reveal) setStatus(`Showing hidden messages · ${res.manualHidden} saved`);
  else setStatus(`${res.hidden} hidden on this page · ${res.manualHidden} saved`);
}

async function send(type) {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    const res = await api.tabs.sendMessage(tab.id, { type });
    if (!res?.ok) throw new Error('No connection');
    renderStatus(res);
    return res;
  } catch {
    setStatus('Open ClickUp and reload the tab. Allow this extension in Safari’s website settings.', true);
    $('controls').disabled = true;
    return null;
  }
}

async function saveSetting(change) {
  try {
    const stored = await api.storage.local.get(KEY);
    const { enabled, channelFilter, reveal } = { ...defaults, ...stored[KEY], ...change };
    await api.storage.local.set({ [KEY]: { enabled, channelFilter, reveal } });
    await send('cvf:rescan');
  } catch {
    setStatus('Could not save settings. Please try again.', true);
  }
}

async function load() {
  try {
    const stored = await api.storage.local.get(KEY);
    const config = { ...defaults, ...stored[KEY] };
    $('enabled').checked = config.enabled;
    $('channelFilter').value = config.channelFilter || '';
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('shortcut').textContent = 'Ctrl ⇧ Y';
    await send('cvf:status');
  } catch {
    setStatus('Could not load settings.', true);
  }
}

$('enabled').addEventListener('change', () => saveSetting({ enabled: $('enabled').checked }));
$('channelFilter').addEventListener('change', () => saveSetting({ channelFilter: $('channelFilter').value.trim() }));
$('controls').addEventListener('click', () => send('cvf:toggle-controls'));
$('toggle').addEventListener('click', () => send('cvf:toggle'));
$('check').addEventListener('click', () => send('cvf:rescan'));
$('revealAll').addEventListener('click', () => send('cvf:reveal-all'));
load();
