<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MilkTeaRewardIcon from './MilkTeaRewardIcon.vue'

const props = defineProps<{ kind: string, state: any, records: any, busy: boolean, error: string }>()
const emit = defineEmits<{ close: [], action: [action: string] }>()
const preview = ref(false)
const notice = ref('')
watch(() => props.kind, () => {
  preview.value = false
  notice.value = ''
})
const img = (name: string) => `/activity/milk-tea/${name}.png`
const current = computed(() => props.state.levels?.find((level: any) => level.level === Number(props.state.shop?.level)))
const next = computed(() => props.state.levels?.find((level: any) => level.level === Number(props.state.shop?.level) + 1))
const progress = computed(() => Math.min(100, Number(props.state.shop?.total_revenue || 0) / Math.max(1, Number(props.state.shop?.next_level_revenue || 1)) * 100))
const titles: Record<string, string> = { upgrade: '店铺升级', sales: '营业记录', rank: '排行榜' }
const title = computed(() => preview.value ? '等级预览' : titles[props.kind])
const score = computed(() => Number(props.state.share?.current_score || 0))
const milestones = computed(() => props.state.share?.milestones || [])
const shareProgress = computed(() => Math.min(100, score.value / Math.max(1, ...milestones.value.map((tier: any) => Number(tier.threshold))) * 100))
const remaining = computed(() => {
  const seconds = Math.max(0, Number(props.state.endTime) - Number(props.state.serverTime))
  return `${Math.floor(seconds / 86400)}天${Math.floor(seconds % 86400 / 3600)}时`
})
function short(value: string | number) {
  const n = Number(value)
  return n >= 10000 ? `${Number((n / 10000).toFixed(1))}万` : String(value ?? 0)
}
function time(sec: string | number, dateOnly = false) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...(dateOnly ? { year: 'numeric', month: '2-digit', day: '2-digit' } as const : { hour: '2-digit', minute: '2-digit', hour12: false } as const) }).format(new Date(Number(sec) * 1000))
}
function effects(level: any, previous?: any) {
  if (!level)
    return []
  const list = [{ name: '热卖值', icon: '', text: `${level.base_popularity}杯/小时` }]
  if (!previous || level.employee_slot_count !== previous.employee_slot_count)
    list.push({ name: '招员工', icon: '', text: `员工雇佣位${level.employee_slot_count}个` })
  const recipes = (level.recipe_names || []).filter((name: string) => !(previous?.recipe_names || []).includes(name))
  if (recipes.length)
    list.push({ name: '新配方', icon: '', text: `解锁${recipes.join('、')}` })
  if (level.shop_item_string)
    list.push({ name: '商品解锁', icon: '', text: `解锁${level.shop_item_string}` })
  if (previous && level.advanced_price_percent !== previous.advanced_price_percent)
    list.push({ name: '售价提升', icon: '', text: `特殊奶茶售价+${level.advanced_price_percent / 100}%` })
  return list
}
const salesDate = computed(() => {
  const day = String(props.records?.day || '')
  if (/^\d{8}$/.test(day))
    return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`
  return props.records?.day ? time(props.records.day, true) : ''
})
const avatar = (value: string) => /^https?:\/\//.test(value || '') ? value : ''
function nativeOnly() {
  notice.value = '请在 QQ 游戏内使用此功能'
}
</script>

<template>
  <div class="dialog-shade" @click.self="emit('close')">
    <section class="shop-dialog" role="dialog" aria-modal="true" :aria-label="title || (kind === 'share' ? '快乐不独享' : '成长基金')">
      <header class="dialog-header">
        <h2 v-if="title">
          {{ title }}
        </h2>
        <h2 v-else-if="kind === 'share'">
          快乐不独享
        </h2>
        <h2 v-else>
          成长基金
        </h2>
        <button class="dialog-close" aria-label="关闭" @click="preview ? preview = false : emit('close')">
          ×
        </button>
      </header>
      <p v-if="error" class="dialog-error" role="alert">
        {{ error }}
      </p>
      <div class="dialog-body">
        <template v-if="kind === 'upgrade'">
          <div v-if="!preview" class="upgrade-view">
            <div class="upgrade-head">
              <div class="level-box current-level">
                <span>当前等级</span><b>{{ state.shop.level }}</b>
              </div>
              <span class="level-arrow">➜</span>
              <div class="level-box next-level">
                <span>下一等级</span><b>{{ next ? next.level : '满级' }}</b>
              </div>
            </div>
            <div class="revenue-progress">
              <div><span>营业额</span><b>{{ short(state.shop.total_revenue) }}/{{ short(state.shop.next_level_revenue) }}</b></div>
              <div class="progress-track"><i :style="{ width: `${progress}%` }" /></div>
            </div>
            <h3 class="section-title">升级效果</h3>
            <div class="effect-list">
              <div v-for="effect in effects(next, current)" :key="effect.name" class="effect-row">
                <b>{{ effect.name }}</b>
                <span v-if="effect.name === '热卖值'">{{ current?.base_popularity }}杯/小时 <em>➜ {{ effect.text }}</em></span>
                <span v-else>{{ effect.text }}</span>
              </div>
              <p v-if="!next" class="empty-inline">店铺已满级</p>
            </div>
            <h3 class="section-title">升级奖励</h3>
            <div class="rewards upgrade-rewards">
              <MilkTeaRewardIcon v-for="item in next?.rewards || []" :key="item.id" :item="item" named />
            </div>
            <button class="primary-btn full" :disabled="busy || !state.summary.can_upgrade" @click="emit('action', 'upgrade')">
              立即升级
            </button>
            <button class="ghost-btn full" @click="preview = true">
              查看全部等级
            </button>
          </div>
          <div v-else class="preview-list">
            <article v-for="(level, index) in state.levels" :key="level.level" class="level-card" :class="{ current: level.level === Number(state.shop.level), next: level.level === Number(state.shop.level) + 1 }">
              <h3><small v-if="level.level === Number(state.shop.level) + 1">下一级</small>{{ level.level }}级</h3>
              <p class="revenue-required">营业额需：{{ level.revenue_required }}</p>
              <div class="level-effects">
                <div v-for="effect in effects(level, state.levels[Number(index) - 1])" :key="effect.name">
                  <b>{{ effect.name }}</b><p>{{ effect.text }}</p>
                </div>
              </div>
              <h4 class="section-title">等级奖励</h4>
              <div class="rewards">
                <MilkTeaRewardIcon v-for="item in level.rewards" :key="item.id" :item="item" />
              </div>
            </article>
          </div>
        </template>

        <template v-else-if="kind === 'sales'">
          <p v-if="!records" class="empty-inline">
            {{ busy ? '加载中…' : error ? '营业记录读取失败' : '暂无营业记录' }}
          </p>
          <template v-else>
            <h3 class="sales-date">{{ salesDate }}</h3>
            <div class="sales-drinks">
              <div v-for="drink in records.drinks || []" :key="drink.recipe_id">
                <img :src="drink.image" :alt="drink.name"><span><b>{{ drink.name }}</b><em>{{ drink.cups }}杯</em></span>
              </div>
            </div>
            <section class="sales-income">
              <h3>营业收益</h3>
              <div class="rewards">
                <MilkTeaRewardIcon v-for="item in records.rewards || []" :key="item.id" :item="{ ...item, count: short(item.count) }" />
              </div>
              <p v-if="!records.rewards?.length" class="empty-inline">暂无收益</p>
            </section>
            <h3 class="section-title">雇员记录</h3>
            <p v-if="!records.hires?.length" class="empty-inline">暂无雇员记录</p>
            <article v-for="hire in records.hires || []" :key="hire.shift_id" class="hire-record">
              <header>
                <img v-if="avatar(hire.friend?.avatar)" :src="avatar(hire.friend.avatar)" alt=""><span v-else class="avatar-fallback">{{ hire.friend?.name?.slice(0, 1) }}</span>
                <b>{{ hire.friend?.name }}</b><small>{{ hire.talent_name }}</small>
              </header>
              <dl>
                <div><dt>工作时长</dt><dd>{{ Number(hire.duration_sec) / 3600 }}小时</dd></div>
                <div><dt>支付工资</dt><dd><img :src="img('img_s4TeaUI_rewardpng')" alt="奶茶券"> +{{ hire.wages?.final_wage || 0 }}</dd></div>
                <div><dt>互动收益</dt><dd>{{ hire.interact ? hire.interact.success ? '互动成功' : '互动未成功' : '无互动' }}</dd></div>
              </dl>
            </article>
          </template>
        </template>

        <template v-else-if="kind === 'rank'">
          <div class="rank-list">
            <p v-if="!records?.ranks?.length" class="empty-inline">
              {{ busy ? '加载中…' : error ? '排行榜读取失败' : '暂无排行' }}
            </p>
            <article v-for="rank in records?.ranks || []" :key="rank.owner.gid" class="rank-row">
              <b class="rank-number" :class="`place-${rank.rank}`">{{ rank.rank }}</b>
              <div class="rank-avatar">
                <img v-if="avatar(rank.owner.avatar)" :src="avatar(rank.owner.avatar)" alt=""><span v-else>{{ rank.owner.name?.slice(0, 1) }}</span><b>{{ rank.owner.level }}</b>
              </div>
              <div class="rank-player">
                <strong>{{ rank.owner.name }}</strong>
                <p>▰ {{ rank.shop_name }}</p>
                <p>营业额：<em>{{ rank.total_revenue }}</em></p>
              </div>
              <button v-if="rank.can_show_off" class="native-btn" @click="nativeOnly">炫耀</button>
            </article>
          </div>
        </template>

        <template v-else-if="kind === 'share' && state.share">
          <div class="share-score">
            我的快乐值：<strong>☀ {{ score }}</strong>
          </div>
          <p class="share-time">◷ 剩余：{{ remaining }}</p>
          <div class="share-milestones">
            <div v-for="tier in milestones" :key="tier.tier_id" class="milestone">
              <div class="milestone-rewards">
                <MilkTeaRewardIcon v-for="item in tier.rewards" :key="item.id" :item="item" />
              </div>
              <b>{{ tier.threshold }}</b>
              <span class="tier-state">{{ Number(tier.state) === 3 ? '已领取' : Number(tier.state) === 2 ? '可领取' : '未达成' }}</span>
            </div>
          </div>
          <div class="progress-track"><i :style="{ width: `${shareProgress}%` }" /></div>
          <p class="share-pool">快乐包已被领 {{ state.share?.my_pool?.claimed_count || 0 }}/{{ state.share?.my_pool?.claim_limit ?? '—' }}</p>
          <div class="share-buttons">
            <button class="ghost-btn" @click="nativeOnly">分享快乐</button>
            <button class="primary-btn" :disabled="busy || state.share?.daily?.daily_reward_claimed" @click="emit('action', 'shareDaily')">
              {{ state.share?.daily?.daily_reward_claimed ? '今日已领取' : '每日领取' }}
            </button>
          </div>
          <button v-if="milestones.some((tier: any) => Number(tier.state) === 2)" class="primary-btn full" :disabled="busy" @click="emit('action', 'shareRewards')">
            领取快乐值奖励
          </button>
        </template>

        <template v-else-if="kind === 'fund' && state.fund">
          <p class="fund-hint">解锁基金且店铺等级达标后可领取奖励</p>
          <div class="fund-tiers">
            <article v-for="tier in state.fund?.tiers || []" :key="tier.tier_id" :class="{ reached: Number(state.shop?.level) >= Number(tier.conditions?.[0]?.target_value || tier.tier_id) }">
              <b class="fund-level">{{ tier.conditions?.[0]?.target_value || tier.tier_id }}<small>等级</small></b>
              <div class="fund-rewards">
                <div class="rewards" :style="{ '--reward-columns': Math.min(4, tier.reward.length) }">
                  <MilkTeaRewardIcon v-for="item in tier.reward" :key="item.id" :item="item" />
                </div>
                <img v-if="!state.fund?.unlocked || Number(tier.state) !== 2" class="tier-state" :src="img(Number(tier.state) === 3 ? 'icon_s4_upLvReward_got' : 'icon_s4_upLvReward_lock')" :alt="Number(tier.state) === 3 ? '已领取' : '未解锁'">
                <button v-else class="primary-btn" :disabled="busy" @click="emit('action', 'fundRewards')">领取</button>
              </div>
            </article>
          </div>
          <button v-if="state.fund?.unlocked" class="primary-btn full" :disabled="busy || !state.fund?.tiers?.some((tier: any) => Number(tier.state) === 2)" @click="emit('action', 'fundRewards')">
            {{ state.fund?.tiers?.some((tier: any) => Number(tier.state) === 2) ? '领取奖励' : '暂无可领取奖励' }}
          </button>
          <button v-else class="primary-btn full" disabled title="不支持钻石购买">
            未购买 · 💎 {{ state.fund?.unlock_cost?.find((item: any) => String(item.id) === '1004')?.count ?? '—' }}
          </button>
        </template>

        <p v-else class="empty-inline">暂无活动数据</p>
      </div>
      <p v-if="notice" class="native-notice" role="status">{{ notice }}</p>
    </section>
  </div>
</template>

<style scoped>
.dialog-shade {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #39261899;
}
.shop-dialog {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid #f0e2d0;
  background: #fff;
  color: #5b4632;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  box-shadow: 0 12px 40px rgba(60, 30, 10, 0.25);
}
.dialog-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 48px 10px 18px;
  border-bottom: 1px solid #f3e7d8;
  flex-shrink: 0;
}
.dialog-header h2 {
  margin: 0;
  font-size: 17px;
}
.dialog-close {
  position: absolute;
  right: 10px;
  top: 8px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: #fdf7ef;
  color: #8a6a4f;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.dialog-error {
  margin: 10px 18px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff1e8;
  color: #a33f27;
  font-size: 13px;
}
.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 18px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0 10px;
  font-size: 14px;
  color: #8a6a4f;
}
.section-title::before,
.section-title::after {
  content: '';
  flex: 1;
  border-top: 1px dashed #ead9c6;
}
.rewards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: start;
  gap: 12px;
}
.rewards > * {
  width: 56px;
}
.empty-inline {
  margin: 10px 0;
  color: #b09a80;
  font-size: 13px;
  text-align: center;
}
.upgrade-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 14px;
}
.level-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 18px;
  border-radius: 14px;
  background: #fdf7ef;
}
.level-box span {
  font-size: 12px;
  color: #b09a80;
}
.level-box b {
  font-size: 24px;
  color: #b06a2e;
}
.next-level b {
  color: #2e8b47;
}
.level-arrow {
  font-size: 20px;
  color: #b09a80;
}
.revenue-progress > div:first-child {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.revenue-progress b {
  color: #b06a2e;
}
.progress-track {
  height: 8px;
  margin: 8px 0;
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
.effect-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.effect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fdf7ef;
  font-size: 13px;
}
.effect-row b {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fdeedb;
  color: #a9744f;
  font-size: 12px;
}
.effect-row em {
  color: #db7436;
  font-style: normal;
}
.upgrade-rewards {
  margin-bottom: 12px;
}
.upgrade-rewards :deep(.reward-name) {
  font-size: 11px;
  line-height: 1.2;
}
.preview-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.level-card {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #f3e7d8;
  background: #fdfaf5;
  text-align: center;
}
.level-card.current {
  border-color: #ed9121;
  background: #fff7ea;
}
.level-card.next {
  border-color: #2e8b47;
  background: #f2faf3;
}
.level-card h3 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 0 4px;
  font-size: 16px;
}
.level-card h3 small {
  padding: 2px 8px;
  border-radius: 999px;
  background: #2e8b47;
  color: #fff;
  font-size: 11px;
}
.revenue-required {
  margin: 0 0 8px;
  color: #b09a80;
  font-size: 12px;
}
.level-effects {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 6px;
}
.level-effects > div {
  padding: 6px;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
}
.level-effects p {
  margin: 2px 0 0;
  color: #8a6a4f;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.sales-date {
  margin: 0 0 12px;
  text-align: center;
  font-size: 16px;
  color: #b06a2e;
}
.sales-drinks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.sales-drinks > div {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  background: #fdf7ef;
  min-width: 0;
}
.sales-drinks img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
}
.sales-drinks span {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  min-width: 0;
}
.sales-drinks em {
  color: #db7436;
  font-style: normal;
}
.sales-income {
  padding: 10px;
  border-radius: 12px;
  background: #fdf7ef;
  text-align: center;
  margin-bottom: 6px;
}
.sales-income h3 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #8a6a4f;
}
.hire-record {
  margin-bottom: 10px;
  border-radius: 12px;
  border: 1px solid #f3e7d8;
  overflow: hidden;
}
.hire-record header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fdf7ef;
}
.hire-record header > img,
.avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: #fdeedb;
  color: #a9744f;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.hire-record small {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fdeedb;
  color: #a9744f;
  font-size: 11px;
}
.hire-record dl {
  margin: 0;
  padding: 8px 12px;
}
.hire-record dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  line-height: 1.8;
}
.hire-record dt {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  color: #b09a80;
}
.hire-record dt::after {
  content: '';
  flex: 1;
  border-top: 1px dotted #ead9c6;
}
.hire-record dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
}
.hire-record dd img {
  width: 16px;
  height: 14px;
  object-fit: contain;
}
.rank-list {
  display: flex;
  flex-direction: column;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px dashed #f0e2d0;
}
.rank-number {
  width: 28px;
  text-align: center;
  font-size: 15px;
  flex-shrink: 0;
}
.place-1,
.place-2,
.place-3 {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ffdc47;
  color: #7a5a1e;
  font-size: 13px;
}
.place-2 {
  background: #b9d9e4;
  color: #31586a;
}
.place-3 {
  background: #d88c59;
  color: #fff;
}
.rank-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fdeedb;
  color: #a9744f;
  display: grid;
  place-items: center;
  font-weight: 800;
}
.rank-avatar > img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
.rank-avatar > b {
  position: absolute;
  bottom: -4px;
  right: -4px;
  padding: 1px 5px;
  border-radius: 6px;
  background: #ffc93f;
  color: #fff;
  font-size: 10px;
}
.rank-player {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.rank-player strong {
  font-size: 14px;
}
.rank-player p {
  margin: 1px 0;
  font-size: 12px;
  color: #b09a80;
}
.rank-player em {
  color: #db7436;
  font-style: normal;
}
.native-btn {
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: #f6c33b;
  color: #7a5a1e;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.share-score {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
}
.share-score strong {
  color: #ed9121;
}
.share-time {
  margin: 4px 0 12px;
  text-align: center;
  color: #b09a80;
  font-size: 12px;
}
.share-milestones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.milestone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  background: #fdf7ef;
}
.milestone-rewards {
  display: flex;
  justify-content: center;
  width: 100%;
}
.milestone-rewards > * {
  width: 40px;
}
.milestone b {
  font-size: 13px;
  color: #b06a2e;
}
.tier-state {
  font-size: 11px;
  color: #b09a80;
}
.share-pool {
  margin: 8px 0;
  text-align: center;
  font-size: 12px;
  color: #b09a80;
}
.share-buttons {
  display: flex;
  gap: 10px;
}
.share-buttons > * {
  flex: 1;
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
  padding: 9px 14px;
  border: 1px solid #ead9c6;
  border-radius: 10px;
  background: #fff;
  color: #8a6a4f;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ghost-btn.full {
  width: 100%;
  margin-top: 8px;
}
.fund-hint {
  margin: 0 0 10px;
  text-align: center;
  color: #b09a80;
  font-size: 12px;
}
.fund-tiers {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fund-tiers article {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid #f3e7d8;
  background: #fdfaf5;
}
.fund-tiers article.reached {
  border-color: #ed9121;
  background: #fff7ea;
}
.fund-level {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #f6ece0;
  color: #8a6a4f;
  font-size: 18px;
}
.fund-level small {
  font-size: 11px;
}
.reached .fund-level {
  background: linear-gradient(135deg, #f6b352, #ed9121);
  color: #fff;
}
.fund-rewards {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.fund-rewards .rewards {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(var(--reward-columns, 3), minmax(0, 1fr));
  gap: 6px;
}
.fund-rewards .rewards > * {
  width: 100%;
  max-width: 52px;
  justify-self: center;
}
.fund-rewards .tier-state {
  width: 24px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}
.fund-rewards .primary-btn {
  padding: 8px 12px;
  font-size: 12px;
}
.native-notice {
  margin: 0;
  padding: 10px;
  border-top: 1px solid #f3e7d8;
  background: #fffaf3;
  color: #8a6a4f;
  text-align: center;
  font-size: 13px;
}
button:disabled {
  cursor: default;
}
</style>