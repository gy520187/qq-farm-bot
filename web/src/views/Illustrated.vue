<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import IllustratedItemCard from '@/components/illustrated/IllustratedItemCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAccountStore } from '@/stores/account'
import { useIllustratedStore } from '@/stores/illustrated'
import { useToastStore } from '@/stores/toast'
import { formatGoldAmount } from '@/utils/number-format'

const accountStore = useAccountStore()
const illustratedStore = useIllustratedStore()
const toast = useToastStore()

const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { data, loading, buying, claiming, error } = storeToRefs(illustratedStore)

const currentType = ref<'crop' | 'mutant'>('crop')
const currentMutantGroup = ref<'gold' | 'decoration' | 'activity'>('gold')
const filter = ref<'all' | 'unlocked' | 'locked'>('all')

const showConfirm = ref(false)
const confirmTitle = ref('确认购买')
const confirmMessage = ref('')
const confirmLoading = ref(false)
const pendingAction = ref<null | (() => Promise<void>)>(null)

const isConnected = computed(() => !!currentAccount.value?.running)
const book = computed(() => data.value?.[currentType.value] || null)
const collectedCount = computed(() => (Array.isArray(book.value?.items) ? book.value.items : []).filter((item: any) => item.unlocked).length)
const lockedCount = computed(() => Math.max(0, (Array.isArray(book.value?.items) ? book.value.items : []).length - collectedCount.value))
const buyableCount = computed(() => (Array.isArray(book.value?.items) ? book.value.items : []).filter((item: any) => item.shopSeed?.goodsId && !item.shopSeed.locked && !item.shopSeed.soldOut && !item.shopSeed.unknownMeta).length)

const typeTabs = [
  { value: 'crop', label: '作物图鉴' },
  { value: 'mutant', label: '超变图鉴' },
] as const

const filterTabs: Array<{ value: 'all' | 'unlocked' | 'locked', label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'unlocked', label: '已收录' },
  { value: 'locked', label: '未收录' },
]

const mutantGroups = computed(() => {
  const items = Array.isArray(book.value?.items) ? [...book.value.items].sort((a: any, b: any) => Number(a.sort || 0) - Number(b.sort || 0)) : []
  return [
    { key: 'gold', label: '黄金果实', items: items.filter((item: any) => item.group === 'gold') },
    { key: 'decoration', label: '装扮果实', items: items.filter((item: any) => item.group === 'decoration') },
    { key: 'activity', label: '活动果实', items: items.filter((item: any) => item.group === 'activity') },
  ] as const
})

const selectedMutantGroup = computed(() => mutantGroups.value.find(group => group.key === currentMutantGroup.value) || mutantGroups.value[0])

const filteredItems = computed(() => {
  const items = book.value?.items || []
  if (currentType.value === 'mutant')
    return selectedMutantGroup.value.items
  if (filter.value === 'unlocked')
    return items.filter((item: any) => item.unlocked)
  if (filter.value === 'locked')
    return items.filter((item: any) => !item.unlocked)
  return items
})

const buffs = computed(() => (Array.isArray(book.value?.buffs) ? book.value.buffs : []))
const currentBuffs = computed(() => (Array.isArray(book.value?.currentBuffs) ? book.value.currentBuffs : []))
const levelMap = computed(() => new Map(
  (Array.isArray(book.value?.levels) ? book.value.levels : []).map((level: any) => [Number(level?.level) || 0, level]),
))

function segmentedButtonClasses(active: boolean) {
  return active
    ? 'text-white shadow-sm'
    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
}

function progressPercent(value: any, next: any) {
  const current = Math.max(0, Number(value) || 0)
  const target = Math.max(current, Number(next) || 0)
  return target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0
}

function formatBuffValue(bonus: any) {
  const value = Number(bonus?.value) || 0
  return bonus?.valueType === 'probability' ? `触发概率 ${value / 10}%` : `数量 +${value}`
}

function formatBuffLevelState(bonus: any) {
  if (Number(bonus?.level) <= Number(book.value?.level || 0))
    return '已达成'
  const level = levelMap.value.get(Number(bonus?.level) || 0) as any
  return level?.progress ? `${level.progress} 进度` : '未达成'
}

function openConfirm(title: string, message: string, action: () => Promise<void>) {
  confirmTitle.value = title
  confirmMessage.value = message
  pendingAction.value = action
  showConfirm.value = true
}

async function runConfirmedAction() {
  if (!pendingAction.value)
    return
  confirmLoading.value = true
  try {
    await pendingAction.value()
    showConfirm.value = false
  }
  finally {
    confirmLoading.value = false
    pendingAction.value = null
  }
}

function closeConfirm() {
  if (confirmLoading.value)
    return
  showConfirm.value = false
  pendingAction.value = null
}

async function refreshList() {
  if (!currentAccountId.value || !isConnected.value)
    return
  await illustratedStore.fetchList(currentAccountId.value)
}

function buySeed(item: any) {
  const seed = item?.shopSeed
  if (!currentAccountId.value || !seed?.goodsId)
    return
  openConfirm(
    '确认购买',
    `确定购买 ${item.name} 吗？\n价格：${formatGoldAmount(seed.price || 0)} 金币`,
    async () => {
      const result = await illustratedStore.buySeed(currentAccountId.value, seed.goodsId, seed.price || 0)
      if (result?.ok) {
        toast.success(`已购买 ${item.name}`)
        await refreshList()
      }
      else {
        toast.error(result?.error || '购买失败')
      }
    },
  )
}

function buyAll() {
  openConfirm(
    '确认一键购买',
    `将尝试购买当前图鉴中所有可购买项目。\n可购买数量：${buyableCount.value}`,
    async () => {
      const result = await illustratedStore.buyAllSeeds(currentAccountId.value, currentType.value === 'crop' ? 1 : 2)
      if (result?.ok) {
        const payload = result.data || {}
        toast.success(`一键购买完成：成功 ${payload.successCount || 0}，失败 ${payload.failCount || 0}`)
        await refreshList()
      }
      else {
        toast.error(result?.error || '一键购买失败')
      }
    },
  )
}

function confirmBuySeed(item: any) {
  buySeed(item)
}

function confirmBuyAll() {
  buyAll()
}

function claimRewards() {
  if (!currentAccountId.value || !book.value?.claimable)
    return
  const type = currentType.value === 'crop' ? 1 : 2
  openConfirm(
    '确认领取',
    '将领取当前图鉴所有可领取的收藏奖励。',
    async () => {
      const result = await illustratedStore.claimRewards(currentAccountId.value, type)
      if (result?.ok) {
        const payload = result.data || {}
        const message = (payload.rewards || []).map((item: any) => `${item.name} ×${item.count}`).join('、') || '领取成功'
        if (payload.snapshot) {
          data.value = payload.snapshot
          toast.success(message)
        }
        else if (payload.refreshRequired) {
          toast.warning(`${message}。请刷新确认最新进度`)
          await refreshList()
        }
        else {
          toast.success(message)
          await refreshList()
        }
      }
      else {
        toast.error(result?.error || '领取失败')
      }
    },
  )
}

watch([currentAccountId, currentType], () => {
  if (currentType.value === 'mutant') {
    const firstGroup = mutantGroups.value.find(group => group.items.length > 0)
    currentMutantGroup.value = (firstGroup?.key as any) || 'gold'
  }
})

watch([currentAccountId], () => {
  illustratedStore.clearIllustratedData()
  refreshList()
})

onMounted(() => {
  refreshList()
})
</script>

<template>
  <section class="space-y-4">
    <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <div class="i-carbon-book text-2xl text-emerald-500" />
            <h1 class="text-xl font-bold">
              图鉴
            </h1>
          </div>
          <div v-if="book" class="flex flex-wrap items-center gap-2 text-sm">
            <span class="h-8 flex items-center rounded-lg bg-emerald-50 px-3 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {{ collectedCount }}/{{ book.items.length }} 已收录
            </span>
            <span class="h-8 flex items-center rounded-lg bg-gray-50 px-3 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
              {{ lockedCount }} 未收录
            </span>
            <span v-if="currentType === 'crop'" class="h-8 flex items-center rounded-lg bg-blue-50 px-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {{ buyableCount }} 可购买
            </span>
            <span class="h-8 flex items-center rounded-lg bg-amber-50 px-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Lv.{{ book.level }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <div class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
            <button
              v-for="item in typeTabs"
              :key="item.value"
              class="min-w-20 rounded-md px-3 text-sm font-medium transition"
              :class="segmentedButtonClasses(currentType === item.value)"
              :style="currentType === item.value ? { backgroundColor: 'var(--theme-primary)' } : {}"
              @click="currentType = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <div v-if="currentType === 'crop'" class="h-9 inline-flex overflow-hidden border border-gray-200 rounded-lg bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
            <button
              v-for="item in filterTabs"
              :key="item.value"
              class="min-w-16 rounded-md px-3 text-sm font-medium transition"
              :class="segmentedButtonClasses(filter === item.value)"
              :style="filter === item.value ? { backgroundColor: 'var(--theme-primary)' } : {}"
              @click="filter = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <BaseButton
            v-if="currentType === 'crop'"
            class="w-28"
            variant="primary"
            :loading="buying"
            :disabled="buyableCount <= 0"
            @click="confirmBuyAll"
          >
            一键购买
          </BaseButton>
          <BaseButton
            class="w-28"
            variant="primary"
            :loading="claiming"
            :disabled="!book?.claimable"
            @click="claimRewards"
          >
            领取奖励
          </BaseButton>
          <BaseButton class="w-24" variant="primary" :loading="loading" :disabled="!isConnected" @click="refreshList">
            刷新
          </BaseButton>
        </div>
      </div>

      <div v-if="error" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        {{ error }}
      </div>

      <div v-if="!currentAccountId" class="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
        请先选择账号，再查看图鉴。
      </div>

      <div v-else-if="!book" class="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
        {{ loading ? '正在加载图鉴数据...' : '暂无图鉴数据' }}
      </div>

      <div v-else class="space-y-4">
        <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div class="flex items-center justify-between text-sm">
            <div class="text-gray-600 dark:text-gray-300">
              当前等级 <span class="font-semibold text-gray-900 dark:text-gray-100">Lv.{{ book.level }}</span>
              <span class="mx-2 text-gray-300 dark:text-gray-600">·</span>
              <span>进度 {{ book.progress || 0 }} / {{ book.nextLevelProgress || '—' }}</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ progressPercent(book.progress, book.nextLevelProgress) }}%
            </div>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${progressPercent(book.progress, book.nextLevelProgress)}%` }" />
          </div>
          <div v-if="book.rewards?.length" class="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span class="text-gray-500 dark:text-gray-400">
              已领取奖励
            </span>
            <span
              v-for="reward in book.rewards"
              :key="reward.itemId"
              class="h-7 flex items-center gap-1 rounded-lg bg-white px-2 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {{ reward.name }} ×{{ reward.count }}
            </span>
          </div>
        </div>

        <div v-if="currentType === 'mutant' && (buffs.length || currentBuffs.length)" class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 class="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            超变属性加成
          </h2>
          <div class="flex flex-wrap gap-2 text-xs">
            <span
              v-for="bonus in currentBuffs"
              :key="`${bonus.id}`"
              class="h-7 flex items-center rounded-lg bg-white px-2 text-amber-700 dark:bg-gray-800 dark:text-amber-300"
              :title="`${bonus.name}：${formatBuffValue(bonus)}`"
            >
              {{ bonus.name }} {{ formatBuffValue(bonus) }} · 已达成
            </span>
            <span
              v-for="bonus in buffs.filter(b => !currentBuffs.some(c => c.id === b.id))"
              :key="`${bonus.id}`"
              class="h-7 flex items-center rounded-lg bg-white/60 px-2 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"
              :title="`${bonus.name}：${formatBuffValue(bonus)}`"
            >
              {{ bonus.name }} {{ formatBuffValue(bonus) }} · {{ formatBuffLevelState(bonus) }}
            </span>
          </div>
        </div>

        <div v-if="book.levels?.length" class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <h2 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            收藏奖励
          </h2>
          <div class="flex flex-wrap gap-2 text-xs">
            <span
              v-for="level in book.levels"
              :key="level.level"
              class="h-7 flex items-center gap-1 rounded-lg px-2"
              :class="level.claimed
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                : level.canClaim
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'bg-white text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
            >
              <span class="font-semibold">Lv.{{ level.level }}</span>
              <span
                v-for="reward in level.rewards"
                :key="reward.itemId"
              >
                {{ reward.name }}×{{ reward.count }}
              </span>
              <span v-if="level.claimed">已领取</span>
              <span v-else-if="level.canClaim">可领取</span>
            </span>
          </div>
        </div>

        <div v-if="currentType === 'mutant'" class="flex flex-wrap gap-2">
          <button
            v-for="group in mutantGroups"
            :key="group.key"
            class="h-8 rounded-lg px-3 text-sm font-medium transition"
            :class="currentMutantGroup === group.key
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
            @click="currentMutantGroup = group.key"
          >
            {{ group.label }}（{{ group.items.length }}）
          </button>
        </div>

        <div v-if="filteredItems.length === 0" class="border border-gray-200 rounded-lg border-dashed bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          暂无图鉴项目
        </div>

        <div class="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-3">
          <IllustratedItemCard
            v-for="item in filteredItems"
            :key="item.seedId"
            :item="item"
            :buying="buying"
            :book-level="book.level"
            @buy="confirmBuySeed"
          />
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="showConfirm"
      :title="confirmTitle"
      :message="confirmMessage"
      :loading="confirmLoading"
      @confirm="runConfirmedAction"
      @close="closeConfirm"
      @cancel="closeConfirm"
    />
  </section>
</template>