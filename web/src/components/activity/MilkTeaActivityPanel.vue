<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import api from '@/api'
import { isWithinActivityWindowMs, MILK_TEA_ACTIVITY_WINDOW } from '@/constants/activity-windows'
import { useAccountStore } from '@/stores/account'
import MilkTeaCraftDialog from './MilkTeaCraftDialog.vue'
import MilkTeaShopDialogs from './MilkTeaShopDialogs.vue'

const emit = defineEmits<{ back: [] }>()
const accounts = useAccountStore()

const state = ref<any>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const tab = ref<'shop' | 'exchange' | 'work'>('shop')
const filter = ref('全部')
const modal = ref('')
const purchaseCount = ref(1)
const selectedGoods = computed(() => state.value?.goods?.find((good: any) => `goods:${good.id}` === modal.value))
const purchaseMax = computed(() => Math.max(0, Number(selectedGoods.value?.maxPurchasable || 0)))
const validPurchase = computed(() => Number.isSafeInteger(purchaseCount.value) && purchaseCount.value >= 1 && purchaseCount.value <= purchaseMax.value)
watch(modal, () => {
  purchaseCount.value = 1
})
watch(purchaseMax, (maximum) => {
  if (purchaseCount.value > maximum)
    purchaseCount.value = Math.max(1, maximum)
})
function clampPurchase() {
  purchaseCount.value = Math.min(Math.max(1, purchaseMax.value), Math.max(1, Math.floor(Number(purchaseCount.value) || 1)))
}
function totalCost(cost: any) {
  return (BigInt(cost.count || 0) * BigInt(Number.isSafeInteger(purchaseCount.value) && purchaseCount.value >= 1 ? purchaseCount.value : 0)).toString()
}
const records = ref<any>(null)
const shopName = ref('奶茶冲鸭')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>
let generation = 0
const img = (name: string) => `/activity/milk-tea/${name}.png`
const currencyIcon = (item: any) => ({ 1001: '/game-config/resource-icons/gold.png', 1004: '/game-config/resource-icons/diamond.png', 1041: img('icon_s4_ticket') } as Record<string, string>)[String(item.id ?? item.itemId)] || item.image || ''
const money = (id: string) => state.value?.balances?.find((x: any) => String(x.itemId ?? x.id) === id)?.count || '0'
const goods = computed(() => (state.value?.goods || []).filter((g: any) => filter.value === '全部' || (filter.value === '种子' ? g.category_tag === 'seed' : g.category_tag !== 'seed')))
const recipes = computed(() => (state.value?.recipes || []).filter((x: any) => x.unlocked).sort((a: any, b: any) => Number(a.recipe_id) - Number(b.recipe_id)))
const shelfRecipes = computed(() => [...recipes.value].sort((a: any, b: any) => Number(b.stock_cups === '-1') - Number(a.stock_cups === '-1') || Number(b.recipe_id) - Number(a.recipe_id)))
const remaining = computed(() => {
  const seconds = Math.max(0, (Number(state.value?.endTime || 0) * 1000 - now.value) / 1000)
  return `${Math.floor(seconds / 86400)}天${Math.floor(seconds % 86400 / 3600)}时`
})
const date = (sec: number) => new Date(sec * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
const duration = (sec: number) => `${Math.floor(Math.max(0, sec) / 3600).toString().padStart(2, '0')}:${Math.floor(Math.max(0, sec) % 3600 / 60).toString().padStart(2, '0')}`
const revenueProgress = computed(() => Math.min(100, Number(state.value?.shop?.total_revenue || 0) / Math.max(1, Number(state.value?.shop?.next_level_revenue || 1)) * 100))
const pendingTicket = computed(() => state.value?.shop?.pending_rewards?.find((x: any) => String(x.id) === '1041')?.count || '0')
const hasPending = computed(() => (state.value?.shop?.pending_rewards || []).some((x: any) => Number(x.count) > 0))
const lockedSlots = computed(() => Math.max(0, 6 - shelfRecipes.value.length))
const restrictionLabel = (type: any) => ({ 1: '每日', 2: '每周', 4: '永久' } as Record<number, string>)[Number(type)] || ''
const formatCount = (value: any) => {
  const n = Number(value || 0)
  return n >= 10000 ? `${Number((n / 10000).toFixed(1))}万` : String(value ?? 0)
}

async function refresh() {
  if (loading.value || busy.value || !accounts.currentAccountId || !isWithinActivityWindowMs(MILK_TEA_ACTIVITY_WINDOW))
    return
  const token = generation
  const accountId = accounts.currentAccountId
  loading.value = true
  try {
    const { data } = await api.get('/api/activity/milk-tea', { headers: { 'x-account-id': accountId }, timeout: 100000 })
    if (token !== generation)
      return
    if (!data.ok || !data.activity)
      throw new Error(data.error || '活动数据读取失败')
    state.value = data.activity
    error.value = ''
  }
  catch (e: any) {
    if (token === generation)
      error.value = e.response?.data?.error || e.message
  }
  finally {
    if (token === generation)
      loading.value = false
  }
}
async function act(action: string, params: any = {}) {
  if (busy.value || loading.value || !accounts.currentAccountId)
    return
  const token = generation
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post('/api/activity/milk-tea/operate', { accountId: accounts.currentAccountId, action, params }, { headers: { 'x-account-id': accounts.currentAccountId }, timeout: 190000 })
    if (token !== generation)
      return
    if (!data.ok)
      throw new Error(data.error || '操作失败')
    state.value = data.activity
    if (!['shareDaily', 'shareRewards', 'fundRewards', 'upgrade'].includes(action))
      modal.value = ''
  }
  catch (e: any) {
    if (token === generation) {
      const message = e.response?.data?.error || e.message
      error.value = action === 'buy' && (e.code === 'ECONNABORTED' || /timeout/i.test(message || ''))
        ? '兑换结果暂未确认，请等待数据刷新后核对库存和限购，勿重复提交'
        : message
    }
  }
  finally {
    if (token === generation)
      busy.value = false
  }
}
async function open(kind: string) {
  if (busy.value)
    return
  modal.value = kind
  error.value = ''
  records.value = null
  if (!['sales', 'rank', 'hireList'].includes(kind))
    return
  busy.value = true
  const token = generation
  try {
    const { data } = await api.post('/api/activity/milk-tea/records', { accountId: accounts.currentAccountId, kind }, { headers: { 'x-account-id': accounts.currentAccountId }, timeout: 100000 })
    if (!data.ok)
      throw new Error(data.error || '记录读取失败')
    if (token === generation && modal.value === kind)
      records.value = data
  }
  catch (e: any) {
    if (token === generation)
      error.value = e.response?.data?.error || e.message
  }
  finally {
    if (token === generation)
      busy.value = false
  }
}
function visible() {
  if (!document.hidden)
    void refresh()
}
watch(() => accounts.currentAccountId, () => {
  generation++
  state.value = null
  loading.value = false
  busy.value = false
  modal.value = ''
  void refresh()
})
onMounted(() => {
  void refresh()
  document.addEventListener('visibilitychange', visible)
  timer = setInterval(() => {
    now.value = Date.now()
    if (!isWithinActivityWindowMs(MILK_TEA_ACTIVITY_WINDOW)) {
      clearInterval(timer)
      emit('back')
      return
    }
    if (!document.hidden)
      void refresh()
  }, 15000)
})
onUnmounted(() => {
  generation++
  clearInterval(timer)
  document.removeEventListener('visibilitychange', visible)
})
</script>

<template>
  <div class="milk-page">
    <p v-if="!accounts.currentAccountId" class="milk-message">
      请先选择账号
    </p>
    <p v-else-if="!state && loading" class="milk-message">
      正在加载活动数据…
    </p>
    <p v-else-if="!state && !error" class="milk-message">
      暂无活动数据
    </p>
    <p v-if="error" class="milk-error" role="alert">
      {{ error }}
    </p>
    <template v-if="state">
      <header class="milk-topbar">
        <button class="milk-back" aria-label="返回活动列表" @click="emit('back')">
          ←
        </button>
        <div class="milk-heading">
          <h1>奶茶热销中</h1>
          <div class="milk-meta">
            <span class="countdown">⏱ {{ remaining }}</span>
            <button class="rules-btn" aria-label="活动规则" @click="open('rules')">
              规则
            </button>
          </div>
        </div>
      </header>

      <div class="milk-balances">
        <div v-if="tab === 'exchange'" class="balance">
          <img :src="currencyIcon({ id: '1001' })" alt="金币"><b>{{ formatCount(money('1001')) }}</b>
        </div>
        <div class="balance">
          <img :src="img('img_s4TeaUI_rewardpng')" alt="奶茶券"><b>{{ formatCount(money('1041')) }}</b>
        </div>
        <div v-if="tab === 'exchange'" class="balance">
          <img :src="currencyIcon({ id: '1004' })" alt="钻石"><b>{{ formatCount(money('1004')) }}</b>
        </div>
        <div v-if="tab !== 'exchange'" class="balance">
          <img :src="currencyIcon({ id: '1004' })" alt="钻石"><b>{{ formatCount(money('1004')) }}</b>
        </div>
      </div>

      <nav class="milk-tabs" aria-label="奶茶活动分页">
        <button :class="{ active: tab === 'shop' }" @click="tab = 'shop'">
          我的店铺
        </button>
        <button :class="{ active: tab === 'exchange' }" @click="tab = 'exchange'">
          兑换商店
        </button>
        <button :class="{ active: tab === 'work' }" @click="tab = 'work'">
          我的工作
        </button>
      </nav>

      <main v-if="tab === 'shop'" class="milk-content">
        <template v-if="!Number(state.summary.shop_open_at)">
          <section class="milk-card empty-store">
            <p>你的奶茶小铺还未开业，快开启营业之旅吧。</p>
            <button class="primary-btn" :disabled="busy" @click="open('create')">
              开店营业
            </button>
          </section>
        </template>
        <template v-else>
          <section class="milk-card">
            <div class="shop-head">
              <div class="shop-title">
                <span class="level-badge">Lv.{{ state.shop.level }}</span>
                <h2>{{ state.summary.shop_name || '奶茶小铺' }}</h2>
              </div>
              <button class="ghost-btn" @click="open('rename')">
                改名
              </button>
            </div>
            <div class="revenue-row">
              <span>营业额</span><b>{{ formatCount(state.shop.total_revenue) }}</b><span class="revenue-target">/ {{ formatCount(state.shop.next_level_revenue) }}</span>
            </div>
            <div class="progress-track"><i :style="{ width: `${revenueProgress}%` }" /></div>
            <div class="shop-stats">
              <div><span>热卖速度</span><b>{{ state.shop.effective_cups_per_hour }}杯/时</b></div>
              <div><span>状态</span><b>{{ state.phase === 'settling' ? '结算期' : '营业中' }}</b></div>
            </div>
          </section>

          <section class="milk-card cashier-card">
            <div class="cashier-info">
              <img :src="img('img_s4TeaUI_rewardpng')" alt="奶茶券"><div><span>待领取收益</span><b>{{ pendingTicket }} 奶茶券</b></div>
            </div>
            <button class="primary-btn" :disabled="busy || !hasPending" @click="act('cashier')">
              领取收益
            </button>
          </section>

          <section class="milk-card">
            <h3 class="card-title">上架饮品</h3>
            <div class="shelf-grid">
              <div v-for="recipe in shelfRecipes" :key="recipe.recipe_id" class="shelf-item">
                <img :src="recipe.config?.image || img('img_s4TeaUI_tea')" :alt="recipe.recipe_name">
                <span>{{ recipe.recipe_name }}</span>
                <b>{{ recipe.stock_cups === '-1' ? '不限量' : `${recipe.stock_cups}杯` }}</b>
              </div>
              <div v-for="i in lockedSlots" :key="`locked-${i}`" class="shelf-item locked">
                <span>🔒</span><span>未解锁</span>
              </div>
            </div>
          </section>

          <section class="milk-card">
            <div class="card-head">
              <h3 class="card-title">员工</h3>
              <button class="ghost-btn" @click="open('hireList')">
                雇佣
              </button>
            </div>
            <p v-if="!state.shop.slots.length" class="empty-inline">
              还没有员工，去雇佣一位吧
            </p>
            <div v-for="slot in state.shop.slots" :key="slot.slot_index" class="employee-row">
              <div class="employee-avatar">🐹</div>
              <div class="employee-info">
                <b>{{ slot.employee.name }}</b><span>{{ slot.talent_name }}</span>
              </div>
              <span class="shift-end">{{ duration(Number(slot.end_at) - now / 1000) }}后下班</span>
            </div>
            <div v-if="Number(state.shop.level) < 3" class="locked-hint">
              🔒 店铺 3 级解锁更多员工位
            </div>
          </section>

          <section class="action-grid">
            <button class="action-card" @click="open('sales')">
              <span>📊</span>营业记录
            </button>
            <button class="action-card" @click="open('rank')">
              <span>🏆</span>排行榜
            </button>
            <button class="action-card" @click="open('share')">
              <span>🎁</span>快乐不独享
            </button>
            <button class="action-card" @click="open('fund')">
              <span>💰</span>成长基金
            </button>
          </section>

          <button class="make-btn primary-btn" :disabled="busy || state.phase !== 'business'" @click="open('craft')">
            🥤 制作奶茶
          </button>
        </template>
      </main>

      <main v-else-if="tab === 'exchange'" class="milk-content">
        <div class="shop-filters">
          <button v-for="name in ['全部', '种子', '装扮']" :key="name" :class="{ selected: filter === name }" @click="filter = name">
            {{ name }}
          </button>
        </div>
        <div class="goods-grid">
          <button v-for="g in goods" :key="g.id" class="goods-card" :class="{ unavailable: !g.unlocked || !g.remaining }" @click="open(`goods:${g.id}`)">
            <span class="goods-name">{{ g.name }}</span>
            <img :src="g.image || g.items[0]?.image || g.items[0]?.imageUrl || img('img_exchange_item1')" :alt="g.name">
            <small>{{ restrictionLabel(g.restriction_type) }}限购 {{ g.remaining }}/{{ g.purchase_limit }}</small>
            <b v-if="!g.remaining">已售罄</b>
            <span v-else class="goods-costs">
              <span v-for="cost in g.costs" :key="cost.id"><img v-if="currencyIcon(cost)" :src="currencyIcon(cost)" :alt="cost.name"><span v-else>{{ cost.name }}</span>{{ cost.count }}</span>
            </span>
            <span v-if="!g.unlocked" class="goods-lock">🔒 {{ g.cond_hints.find((x: any) => !x.satisfied)?.target }}级解锁</span>
          </button>
        </div>
      </main>

      <main v-else class="milk-content">
        <section class="milk-card">
          <h3 class="card-title">工作状态</h3>
          <template v-if="state.work.my_shift">
            <div class="shift-card working">
              <div>
                <span class="status-pill">工作中</span>
                <h4>{{ state.work.my_shift.shop_name }}</h4>
              </div>
              <p>{{ state.work.my_shift.talent_name }} · {{ duration(Number(state.work.my_shift.end_at) - now / 1000) }}后下班</p>
            </div>
            <div class="interactions">
              <button v-for="interaction in state.interactions" :key="interaction.interaction_id" class="primary-btn" :disabled="busy || state.work.interact_done || state.phase !== 'business'" @click="act('interact', { interactionType: interaction.interaction_id })">
                {{ interaction.name }}
              </button>
            </div>
          </template>
          <template v-else>
            <div class="shift-card idle">
              <span class="status-pill">空闲中</span>
              <p>接受好友雇佣，去别人的奶茶店打工赚奶茶券</p>
            </div>
            <button class="primary-btn full" @click="open('invite')">
              ➤ 邀请好友雇佣我
            </button>
          </template>
        </section>

        <section class="milk-card">
          <h3 class="card-title">兼职记录</h3>
          <p v-if="!state.work.slips.length" class="empty-inline">
            暂无工作记录
          </p>
          <div v-for="slip in state.work.slips" :key="slip.shift_id" class="work-record">
            <div>
              <b>{{ slip.shop_name }}</b><p class="muted">{{ date(Number(slip.begin_at)) }} — {{ date(Number(slip.end_at)) }}</p>
            </div>
          </div>
          <button v-if="state.summary.has_unclaimed_wage" class="primary-btn full" :disabled="busy" @click="act('wages')">
            领取工资
          </button>
        </section>
      </main>
    </template>

    <MilkTeaShopDialogs v-if="['upgrade', 'sales', 'rank', 'share', 'fund'].includes(modal)" :kind="modal" :state="state" :records="records" :busy="busy" :error="error" @close="modal = ''" @action="act" />
    <MilkTeaCraftDialog v-else-if="modal === 'craft'" :state="state" :busy="busy" :loading="loading" :error="error" @close="modal = ''" @craft="act('craft', $event)" />
    <div v-else-if="modal" class="modal-mask">
      <section class="milk-modal">
        <button class="modal-close" aria-label="关闭" @click="modal = ''">
          ×
        </button>
        <template v-if="modal === 'create' || modal === 'rename'">
          <h2>{{ modal === 'create' ? '开店营业' : '修改店名' }}</h2>
          <input v-model="shopName" maxlength="8" aria-label="店名"><button class="primary-btn" :disabled="busy" @click="act(modal, { shopName })">
            确认
          </button>
        </template>

        <template v-else-if="modal.startsWith('goods:')">
          <template v-for="g in state.goods.filter((x: any) => `goods:${x.id}` === modal)" :key="g.id">
            <h2>兑换</h2>
            <div class="purchase-product">
              <img v-if="g.image || g.items[0]?.image" :src="g.image || g.items[0].image" :alt="g.name">
              <div><strong>{{ g.name }}</strong><p v-if="g.desc">{{ g.desc }}</p></div>
            </div>
            <div class="purchase-controls">
              <button aria-label="减少兑换数量" :disabled="busy || purchaseCount <= 1 || !purchaseMax" @click="purchaseCount = Math.max(1, Number(purchaseCount) - 1)">
                −
              </button>
              <input v-model.number="purchaseCount" type="number" min="1" :max="Math.max(1, purchaseMax)" step="1" aria-label="兑换数量" :disabled="busy || !purchaseMax" @change="clampPurchase">
              <button aria-label="增加兑换数量" :disabled="busy || purchaseCount >= purchaseMax || !purchaseMax" @click="purchaseCount = Math.min(purchaseMax, Number(purchaseCount) + 1)">
                ＋
              </button>
              <button :disabled="busy || !purchaseMax" @click="purchaseCount = purchaseMax">
                最大
              </button>
            </div>
            <input v-model.number="purchaseCount" class="purchase-range" type="range" min="1" :max="Math.max(1, purchaseMax)" step="1" aria-label="滑动选择兑换数量" :disabled="busy || purchaseMax <= 1">
            <p class="purchase-limit">
              {{ restrictionLabel(g.restriction_type) }}剩余限购 {{ g.remaining }} · 当前最多可兑换 {{ purchaseMax }}
            </p>
            <div class="purchase-costs">
              <span v-for="cost in g.costs" :key="cost.id"><img v-if="currencyIcon(cost)" :src="currencyIcon(cost)" :alt="cost.name"><span v-else>{{ cost.name }}</span>{{ totalCost(cost) }}</span>
            </div>
            <button class="primary-btn" :disabled="busy || loading || !validPurchase || !g.unlocked || g.paid" @click="act('buy', { goodsId: g.id, count: purchaseCount })">
              {{ g.paid ? '不支持钻石购买' : `兑换 ×${validPurchase ? purchaseCount : 0}` }}
            </button>
          </template>
        </template>

        <template v-else-if="modal === 'hireList'">
          <h2>雇佣员工</h2>
          <p v-if="!records" class="empty-inline">
            {{ busy ? '加载中…' : '暂无可雇佣员工' }}
          </p>
          <button v-for="worker in [...(records?.friends || []), ...(records?.robots || [])]" :key="worker.friend.gid" class="recipe-row" :disabled="busy || Number(worker.state) !== 0" @click="act('hire', { targetGid: worker.friend.gid, durationId: 1, slotIndex: 0 })">
            <span>{{ worker.friend.name }} · {{ worker.talent_name }} · 4小时 🎟{{ records.wage_total }}</span>
          </button>
        </template>

        <template v-else-if="modal === 'rules'">
          <h2>活动说明</h2>
          <p>营业期结束：{{ date(state.settleTime) }}</p>
          <p>结算期结束：{{ date(state.endTime) }}</p>
        </template>

        <template v-else>
          <h2>{{ ({ invite: '邀请好友雇佣我', share: '快乐不独享', fund: '成长基金' } as any)[modal] }}</h2>
          <p>{{ modal === 'fund' ? '付费基金暂不支持在网页购买' : '此功能需要 QQ 原生分享' }}</p>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.milk-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 8px 10px 24px;
  color: #5b4632;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
.milk-message,
.milk-error {
  padding: 18px;
  text-align: center;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #f3e7d8;
}
.milk-error {
  color: #b42318;
  background: #fff1e8;
  border-color: #f6d4c8;
}
.milk-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.milk-back {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #ead9c6;
  background: #fff;
  color: #8a6a4f;
  font-size: 17px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(120, 80, 40, 0.06);
}
.milk-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.milk-heading h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
  white-space: nowrap;
}
.milk-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.countdown {
  padding: 4px 10px;
  border-radius: 999px;
  background: #fdeedb;
  color: #a9744f;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.rules-btn {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid #ead9c6;
  background: #fff;
  color: #8a6a4f;
  font-size: 12px;
  cursor: pointer;
}
.milk-balances {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.balance {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #f3e7d8;
  background: #fff;
  box-shadow: 0 1px 2px rgba(120, 80, 40, 0.05);
}
.balance img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}
.balance b {
  margin-left: auto;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.milk-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  padding: 4px;
  border-radius: 14px;
  border: 1px solid #f3e7d8;
  background: #fff;
  box-shadow: 0 1px 2px rgba(120, 80, 40, 0.05);
}
.milk-tabs button {
  flex: 1;
  padding: 10px 4px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #9c836a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.milk-tabs button.active {
  background: linear-gradient(135deg, #f6b352, #ed9121);
  color: #fff;
  box-shadow: 0 2px 6px rgba(240, 151, 46, 0.35);
}
.milk-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.milk-card {
  padding: 14px;
  border-radius: 14px;
  border: 1px solid #f3e7d8;
  background: #fff;
  box-shadow: 0 1px 3px rgba(120, 80, 40, 0.05);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.4;
}
.card-head .card-title {
  margin-bottom: 0;
}
.empty-store {
  text-align: center;
  padding: 32px 16px;
}
.empty-store p {
  margin: 0 0 14px;
  color: #9c836a;
}
.empty-inline {
  margin: 8px 0;
  color: #b09a80;
  font-size: 13px;
  text-align: center;
}
.shop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.shop-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.shop-title h2 {
  margin: 0;
  font-size: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.level-badge {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fdeedb;
  color: #b06a2e;
  font-size: 12px;
  font-weight: 800;
}
.revenue-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
}
.revenue-row b {
  font-size: 15px;
}
.revenue-target {
  color: #b09a80;
}
.progress-track {
  height: 8px;
  margin: 8px 0 10px;
  border-radius: 999px;
  background: #f6ece0;
  overflow: hidden;
}
.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f6b352, #ed9121);
}
.shop-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.shop-stats > div {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fdf7ef;
}
.shop-stats span {
  font-size: 11px;
  color: #b09a80;
}
.shop-stats b {
  font-size: 13px;
}
.cashier-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: linear-gradient(135deg, #fff7ea, #fdeedb);
}
.cashier-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cashier-info img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  flex-shrink: 0;
}
.cashier-info span {
  display: block;
  font-size: 12px;
  color: #b08a5f;
}
.cashier-info b {
  font-size: 16px;
}
.shelf-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.shelf-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  background: #fdf7ef;
  text-align: center;
  min-width: 0;
}
.shelf-item img {
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.shelf-item span {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.shelf-item b {
  font-size: 11px;
  color: #b06a2e;
}
.shelf-item.locked {
  justify-content: center;
  color: #c9b8a2;
  font-size: 12px;
}
.employee-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0e2d0;
}
.employee-row:last-of-type {
  border-bottom: 0;
}
.employee-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fdeedb;
  font-size: 20px;
}
.employee-info {
  flex: 1;
  min-width: 0;
}
.employee-info b {
  display: block;
  font-size: 14px;
}
.employee-info span {
  display: inline-block;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fdf0e0;
  color: #a9744f;
  font-size: 11px;
}
.shift-end {
  flex-shrink: 0;
  font-size: 11px;
  color: #b06a2e;
  white-space: nowrap;
}
.locked-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #b09a80;
  text-align: center;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border-radius: 12px;
  border: 1px solid #f3e7d8;
  background: #fff;
  color: #8a6a4f;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(120, 80, 40, 0.04);
  transition: transform 0.12s, box-shadow 0.12s;
}
.action-card span {
  font-size: 20px;
}
.action-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(120, 80, 40, 0.1);
}
.primary-btn {
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6b352, #ed9121);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(240, 151, 46, 0.3);
}
.primary-btn:disabled {
  cursor: default;
  opacity: 0.5;
  box-shadow: none;
}
.primary-btn.full {
  width: 100%;
  margin-top: 10px;
}
.ghost-btn {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid #ead9c6;
  background: #fff;
  color: #8a6a4f;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}
.make-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}
.shop-filters {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #f3e7d8;
  background: #fff;
}
.shop-filters button {
  flex: 1;
  padding: 8px 4px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #9c836a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.shop-filters button.selected {
  background: #fdf0e0;
  color: #b06a2e;
}
.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.goods-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 14px;
  border: 1px solid #f3e7d8;
  background: #fff;
  color: #5b4632;
  font: inherit;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(120, 80, 40, 0.05);
  min-width: 0;
}
.goods-card img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  margin: 4px 0;
}
.goods-name {
  font-weight: 800;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.goods-card small {
  font-size: 11px;
  color: #b09a80;
}
.goods-costs,
.goods-costs > span {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.goods-costs {
  flex-wrap: wrap;
  font-size: 12px;
  font-weight: 800;
  color: #b06a2e;
}
.goods-costs img {
  width: 16px;
  height: 16px;
  margin: 0;
}
.goods-card.unavailable {
  filter: saturate(0.45);
  opacity: 0.65;
}
.goods-lock {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #5b4632d9;
  color: #fff;
  font-size: 10px;
}
.shift-card {
  padding: 12px;
  border-radius: 12px;
  background: #fdf7ef;
}
.shift-card h4 {
  margin: 6px 0 0;
  font-size: 16px;
}
.shift-card p {
  margin: 4px 0 0;
  color: #8a6a4f;
  font-size: 13px;
}
.status-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}
.working .status-pill {
  background: #e2f5e3;
  color: #2e8b47;
}
.idle .status-pill {
  background: #fdeedb;
  color: #b06a2e;
}
.interactions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.interactions .primary-btn {
  flex: 1;
  min-width: 90px;
}
.work-record {
  padding: 10px 0;
  border-bottom: 1px dashed #f0e2d0;
}
.work-record:last-child {
  border-bottom: 0;
}
.work-record b {
  font-size: 14px;
}
.muted {
  margin: 2px 0 0;
  color: #b09a80;
  font-size: 12px;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #39261899;
}
.milk-modal {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 86vh;
  overflow: auto;
  padding: 22px;
  border-radius: 16px;
  border: 1px solid #f0e2d0;
  background: #fff;
  text-align: center;
  font-size: 14px;
  box-shadow: 0 12px 40px rgba(60, 30, 10, 0.25);
}
.milk-modal h2 {
  margin: 0 0 14px;
  font-size: 17px;
  color: #5b4632;
}
.modal-close {
  position: absolute;
  right: 10px;
  top: 6px;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: #b09a80;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.milk-modal input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  margin: 4px 0 14px;
  border: 1px solid #ead9c6;
  border-radius: 10px;
  background: #fffaf3;
  color: #5b4632;
  font: inherit;
}
.milk-modal .primary-btn {
  margin-top: 4px;
}
.purchase-product {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  margin-bottom: 12px;
}
.purchase-product > img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  flex-shrink: 0;
}
.purchase-product > div {
  flex: 1;
  min-width: 0;
}
.purchase-product strong {
  font-size: 15px;
}
.purchase-product p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #b09a80;
  line-height: 1.5;
}
.purchase-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.purchase-controls button {
  min-width: 38px;
  min-height: 38px;
  border: 1px solid #ead9c6;
  border-radius: 10px;
  background: #fdf7ef;
  color: #5b4632;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.purchase-controls input {
  flex: 1;
  min-width: 0;
  width: 0;
  margin: 0;
  text-align: center;
  font-size: 15px;
}
.purchase-range {
  accent-color: #ed9121;
}
.purchase-limit {
  margin: 8px 0;
  font-size: 12px;
  color: #b09a80;
}
.purchase-costs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 4px 0 10px;
  font-weight: 800;
  color: #b06a2e;
}
.purchase-costs span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.purchase-costs img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.recipe-row {
  display: block;
  width: 100%;
  padding: 10px 12px;
  margin: 6px 0;
  border: 1px solid #f3e7d8;
  border-radius: 10px;
  background: #fdf7ef;
  color: #5b4632;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
@media (min-width: 520px) {
  .goods-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .shelf-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .action-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>