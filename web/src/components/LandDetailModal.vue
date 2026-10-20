<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ land: any, player: any, connected: boolean }>()
const emit = defineEmits<{ close: [] }>()
const info = computed(() => props.land?.landInfo)
const metrics = [
  { key: 'yieldBonus', label: '产量加成', unit: '%' },
  { key: 'growthReduction', label: '成长提速', unit: '%' },
  { key: 'expBonus', label: '经验加成', unit: '%' },
  { key: 'mutantMultiplier', label: '变异概率', unit: '倍' },
  { key: 'resonanceBonus', label: '共鸣加成', unit: '%' },
]
function metric(level: any, key: string, unit: string) {
  if (!level)
    return '—'
  const value = Number(level[key]) || 0
  return key === 'mutantMultiplier' && !value ? '无' : `${value}${unit}`
}
function integer(value: unknown): bigint | null {
  const text = String(value ?? '')
  return /^\d+$/.test(text) ? BigInt(text) : null
}
const balances = computed(() => ({ 1001: props.player?.gold, 1002: props.player?.coupon, 1005: props.player?.goldBean }))
const costs = computed(() => (info.value?.costs || []).map((cost: any) => {
  const balance = props.connected ? integer(balances.value[cost.id as keyof typeof balances.value]) : null
  const required = integer(cost.count) ?? 0n
  return { ...cost, available: balance, missing: balance === null ? null : required > balance ? required - balance : 0n }
}))
const levelMet = computed(() => props.connected && Number(props.player?.level) >= Number(info.value?.needLevel))
function format(value: unknown) {
  const parsed = integer(value)
  return parsed === null ? '—' : parsed.toLocaleString('zh-CN')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="land-detail-modal">
      <div
        v-if="!!land"
        class="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="土地详情"
          tabindex="-1"
          class="land-detail-modal max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[20px] bg-[var(--surface-1)] p-4 shadow-2xl"
          @keydown.esc="emit('close')"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="font-display text-base font-bold">
              土地详情 <span class="text-sm opacity-50">#{{ land?.id }}</span>
            </h2>
            <button
              type="button"
              class="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              aria-label="关闭土地详情"
              @click="emit('close')"
            >
              <span class="i-carbon-close text-lg" />
            </button>
          </div>

          <template v-if="info">
            <div class="land-detail-levels" :class="{ 'land-detail-levels--compare': info.next && info.current }">
              <div v-if="info.current" class="land-detail-soil">
                <img :src="info.current.image" :alt="info.current.name" width="64" height="54">
                <strong>{{ info.current.name }}</strong>
              </div>
              <span v-if="info.next && info.current" class="i-carbon-chevron-right text-xl opacity-40" aria-hidden="true" />
              <div v-if="info.next" class="land-detail-soil">
                <img :src="info.next.image" :alt="info.next.name" width="64" height="54">
                <strong>{{ info.next.name }}</strong>
              </div>
            </div>
            <table class="land-detail-metrics">
              <thead>
                <tr>
                  <th>土地加成</th><th>{{ info.current ? '当前' : '解锁后' }}</th><th v-if="info.current && info.next">
                    升级后
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in metrics" :key="row.key">
                  <th>{{ row.label }}</th>
                  <td>{{ metric(info.current || info.next, row.key, row.unit) }}</td>
                  <td v-if="info.current && info.next" :class="{ 'land-detail-improved': info.next[row.key] > info.current[row.key] }">
                    {{ metric(info.next, row.key, row.unit) }}<span v-if="info.next[row.key] > info.current[row.key]" aria-label="提升"> ↑</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="info.mode === 'max'" class="land-detail-max">
              当前已满级
            </div>
            <section v-else class="land-detail-requirements">
              <h3>{{ info.mode === 'unlock' ? '解锁条件' : '升级条件' }}</h3>
              <div v-if="info.needLevel !== null" class="land-detail-condition">
                <span>种植等级达到 {{ info.needLevel }} 级</span>
                <strong :class="levelMet ? 'land-detail-improved' : 'land-detail-missing'">{{ connected ? player?.level ?? '—' : '—' }} / {{ info.needLevel }}</strong>
              </div>
              <div v-if="info.prerequisite" class="land-detail-condition">
                <span>解锁第 {{ info.prerequisite.landId }} 块土地</span>
                <strong :class="info.prerequisite.met ? 'land-detail-improved' : 'land-detail-missing'">{{ info.prerequisite.met ? '已满足' : '未满足' }}</strong>
              </div>
              <div v-if="info.current && info.next" class="land-detail-condition">
                <span>当前地块：{{ info.current.name }}</span>
              </div>
              <div v-for="cost in costs" :key="cost.id" class="land-detail-cost">
                <div class="land-detail-cost-name">
                  <img v-if="cost.image" :src="cost.image" alt="" width="22" height="22"><span>{{ cost.name }}</span>
                </div>
                <div class="land-detail-cost-amount">
                  <strong>{{ format(cost.count) }}</strong><span :class="cost.missing === 0n ? 'land-detail-improved' : 'land-detail-missing'">{{ cost.missing === null ? '余额待同步' : cost.missing > 0n ? `还差 ${format(cost.missing)}` : '余额充足' }}</span>
                </div>
              </div>
              <p v-if="info.unknown" class="land-detail-missing">
                部分条件暂未获取，具体以游戏内为准
              </p>
              <p v-else-if="info.serverAllowed && connected" class="land-detail-improved">
                当前可{{ info.mode === 'unlock' ? '解锁' : '升级' }}
              </p>
            </section>
          </template>
          <p v-else>
            土地详情暂未获取，请刷新农场。
          </p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.land-detail-modal {
  width: min(420px, calc(100vw - 24px));
  border: 1px solid rgba(102, 187, 106, 0.2);
}
.land-detail-levels {
  display: grid;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 0 0 12px;
}
.land-detail-levels--compare {
  grid-template-columns: 1fr auto 1fr;
}
.land-detail-soil {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.land-detail-soil img {
  object-fit: contain;
}
.land-detail-metrics {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.land-detail-metrics th,
.land-detail-metrics td {
  padding: 6px 4px;
  text-align: right;
}
.land-detail-metrics th:first-child {
  text-align: left;
  font-weight: 500;
  opacity: 0.7;
}
.land-detail-metrics thead {
  font-size: 12px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.25);
  opacity: 0.65;
}
.land-detail-requirements {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(100, 116, 139, 0.25);
}
.land-detail-requirements h3 {
  margin: 0 0 8px;
  font-weight: 700;
}
.land-detail-condition {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 5px 0;
  font-size: 13px;
}
.land-detail-cost {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}
.land-detail-cost-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.land-detail-cost-name img {
  object-fit: contain;
}
.land-detail-cost-amount {
  display: flex;
  flex-direction: column;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.land-detail-cost-amount strong {
  font-size: 15px;
}
.land-detail-cost-amount span {
  font-size: 11px;
}
.land-detail-improved {
  color: #278452;
}
.land-detail-missing {
  color: #c87138;
}
.land-detail-max {
  margin-top: 12px;
  padding: 8px;
  text-align: center;
  border-radius: 12px;
  background: rgba(69, 155, 93, 0.12);
  color: #278452;
  font-weight: 600;
  font-size: 13px;
}
.land-detail-modal-enter-active,
.land-detail-modal-leave-active {
  transition: opacity 0.18s ease;
}
.land-detail-modal-enter-active .land-detail-modal,
.land-detail-modal-leave-active .land-detail-modal {
  transition: transform 0.18s ease;
}
.land-detail-modal-enter-from,
.land-detail-modal-leave-to {
  opacity: 0;
}
.land-detail-modal-enter-from .land-detail-modal,
.land-detail-modal-leave-to .land-detail-modal {
  transform: scale(0.96);
}
@media (max-width: 360px) {
  .land-detail-metrics th,
  .land-detail-metrics td {
    padding: 5px 2px;
  }
  .land-detail-modal {
    font-size: 13px;
  }
}
</style>