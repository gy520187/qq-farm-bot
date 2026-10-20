const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-farm-offline-reminder-'));
process.env.FARM_DATA_DIR = dataDir;

const store = require('../src/models/store');

test.after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('account offline reminder falls back to user config and defaults', () => {
  store.setOfflineReminder({ channel: 'onebot', token: 'user-token' }, 'owner');

  const userCfg = store.getAccountOfflineReminder('account-missing', 'owner');
  assert.equal(userCfg.channel, 'onebot');
  assert.equal(userCfg.token, 'user-token');

  const defaultCfg = store.getAccountOfflineReminder('account-missing', 'nobody');
  assert.equal(defaultCfg.channel, 'smtp');
  assert.equal(defaultCfg.offlineDeleteSec, 0);
});

test('account offline reminder is isolated per account', () => {
  store.setOfflineReminder({ channel: 'webhook', endpoint: 'https://a.example/hook', token: 'a' }, 'acc-1');
  store.setOfflineReminder({ channel: 'onebot', token: 'b' }, 'acc-2');

  const cfg1 = store.getAccountOfflineReminder('acc-1', 'owner');
  assert.equal(cfg1.channel, 'webhook');
  assert.equal(cfg1.endpoint, 'https://a.example/hook');

  const cfg2 = store.getAccountOfflineReminder('acc-2', 'owner');
  assert.equal(cfg2.channel, 'onebot');
  assert.equal(cfg2.token, 'b');

  assert.notEqual(store.getAccountOfflineReminder('acc-1', 'owner').token, 'b');
});

test('account offline reminder overrides user-level config', () => {
  store.setOfflineReminder({ token: 'owner-token' }, 'owner');
  store.setOfflineReminder({ token: 'account-token' }, 'acc-override');

  const cfg = store.getAccountOfflineReminder('acc-override', 'owner');
  assert.equal(cfg.token, 'account-token');
  assert.equal(cfg.channel, 'smtp');
});