const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const protobuf = require('protobufjs');
const root = new protobuf.Root().loadSync(path.join(__dirname, '../src/proto/illustratedpb.proto'), { keepCase: true });
const types = Object.fromEntries(['GetIllustratedListV2Request', 'GetIllustratedListV2Reply', 'GetIllustratedLevelListV2Request', 'GetIllustratedLevelListV2Reply'].map(n => [n, root.lookupType(`gamepb.illustratedpb.${n}`)]));
const mock = (name, exports) => {
  const id = require.resolve(`../src/${name}`);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
mock('utils/proto', { types });
mock('utils/utils', { toNum: Number });
mock('config/gameConfig', {
  getItemById: id => ({ name: `物品${id}` }),
  getItemImageById: () => '',
  getPlantBySeedId: () => null,
  getPlantByFruitId: () => null,
  getPlantNameBySeedId: () => '',
  getIllustratedTypeByParam: () => '',
  getIllustratedSortByParam: () => 1,
  getIllustratedBuffsByLevel: () => [],
  getIllustratedBuffs: () => [],
  getAllSeeds: () => [],
});
mock('services/farm', { getAvailableSeeds: async () => [] });
mock('utils/network', { sendMsgAsync: async (_service, method, body) => {
  const req = types[`${method}Request`].decode(body);
  const reply = method === 'GetIllustratedLevelListV2'
    ? { current_level: 1, total_progress: 100, level_list: [] }
    : {
        type: req.type,
        current_level: 1,
        total_progress: 100,
        next_level_progress: 200,
        list: [{ fruit_id: 204009, rarity: 4, layer: 2, unlocked: true, progress: 60, is_new: false, attributes: [{ type: 1, param: 14, value: 60 }] }],
      };
  return { body: types[`${method}Reply`].encode(types[`${method}Reply`].fromObject(reply)).finish() };
} });
const id = require.resolve('../src/services/illustrated');
delete require.cache[id];
const service = require(id);

test('illustrated snapshot maps mutant fruit progress', async () => {
  const mutant = (await service.getIllustratedSnapshot()).mutant;
  assert.equal(mutant.items[0].seedId, 204009);
  assert.equal(mutant.items[0].unlocked, true);
  assert.equal(mutant.items[0].progress, 60);
  assert.equal(mutant.items[0].isNew, false);
  assert.equal(mutant.items[0].rewardCategory, 4);
  assert.equal(mutant.progress, 100);
  assert.equal(mutant.nextLevelProgress, 200);
});