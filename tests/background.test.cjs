const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('keyboard commands route to their distinct content-script actions only on ClickUp', async () => {
  let command;
  let url = 'https://app.clickup.com/channel';
  const sent = [];
  const api = {
    runtime: { onInstalled: { addListener() {} } },
    commands: { onCommand: { addListener(fn) { command = fn; } } },
    tabs: {
      async query() { return [{ id: 17, url }]; },
      async sendMessage(id, message) { sent.push([id, message.type]); },
    },
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../background.js'), 'utf8'), { chrome: api });
  await command('toggle-controls');
  await command('toggle-hidden');
  await command('unrecognized');
  url = 'https://example.com/';
  await command('toggle-controls');
  assert.deepEqual(sent, [[17, 'cvf:toggle-controls'], [17, 'cvf:toggle']]);
});
