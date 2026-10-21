const test = require('node:test');
const assert = require('node:assert/strict');

const { createDataProvider } = require('../src/runtime/data-provider');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createProvider(callWorkerApi) {
  return createDataProvider({
    workers: {},
    globalLogs: [],
    accountLogs: [],
    store: {},
    getAccounts: () => ({
      accounts: [{ id: 'account-1' }, { id: 'account-2' }]
    }),
    callWorkerApi,
    filterLogs: logs => logs
  });
}

test('getBag coalesces concurrent requests for the same account', async () => {
  const first = deferred();
  const calls = [];
  const provider = createProvider((accountId, method) => {
    calls.push({ accountId, method });
    return first.promise;
  });

  const requests = Array.from({ length: 20 }, () => provider.getBag('account-1'));
  await Promise.resolve();

  assert.deepEqual(calls, [{ accountId: 'account-1', method: 'getBag' }]);
  first.resolve({ items: [{ id: 1 }] });
  const results = await Promise.all(requests);
  assert.equal(results.length, 20);
  assert.ok(results.every(result => result === results[0]));
});

test('getBag keeps accounts separate and releases failed requests', async () => {
  const calls = [];
  const pending = [deferred(), deferred(), deferred()];
  const provider = createProvider((accountId, method) => {
    calls.push({ accountId, method });
    return pending[calls.length - 1].promise;
  });

  const accountOne = provider.getBag('account-1');
  const accountTwo = provider.getBag('account-2');
  await Promise.resolve();
  assert.equal(calls.length, 2);

  pending[0].reject(new Error('temporary failure'));
  pending[1].resolve({ account: 2 });
  await assert.rejects(accountOne, /temporary failure/);
  await accountTwo;

  const retry = provider.getBag('account-1');
  await Promise.resolve();
  assert.equal(calls.length, 3);
  pending[2].resolve({ account: 1 });
  assert.deepEqual(await retry, { account: 1 });
});

test('getIllustratedSnapshot coalesces concurrent requests for the same account', async () => {
  const calls = [];
  const pending = [deferred(), deferred()];
  const provider = createProvider((accountId, method, ...args) => {
    calls.push({ accountId, method, args });
    return pending[calls.length - 1].promise;
  });

  const cropOne = provider.getIllustratedSnapshot('account-1');
  const cropTwo = provider.getIllustratedSnapshot('account-1');
  const mutant = provider.getIllustratedSnapshot('account-2');
  await Promise.resolve();

  assert.deepEqual(calls, [
    { accountId: 'account-1', method: 'getIllustratedSnapshot', args: [] },
    { accountId: 'account-2', method: 'getIllustratedSnapshot', args: [] },
  ]);
  pending[0].resolve({ crop: {} });
  pending[1].resolve({ crop: {} });
  assert.deepEqual(await cropOne, { crop: {} });
  assert.deepEqual(await cropTwo, { crop: {} });
  assert.deepEqual(await mutant, { crop: {} });
});
