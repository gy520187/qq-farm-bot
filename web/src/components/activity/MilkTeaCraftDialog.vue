<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ state: any, busy: boolean, loading: boolean, error: string }>()
const emit = defineEmits<{ close: [], craft: [params: { fruitUids: string[] }] }>()
const img = (name: string) => `/activity/milk-tea/${name}.png`
const selected = ref<string[]>([])
const recipes = computed(() => (props.state.recipes || []).filter((r: any) => r.is_advanced).sort((a: any, b: any) => Number(b.unlocked) - Number(a.unlocked) || Number(a.recipe_id) - Number(b.recipe_id)))
const fruits = (r: any) => r.unlocked ? (r.fruits || []).filter((f: any) => /^\d+$/.test(String(f.uid)) && BigInt(f.uid) > 0n && BigInt(f.count || 0) > 0n) : []
const available = computed<string[]>(() => [...new Set<string>(recipes.value.flatMap((r: any) => fruits(r).map((f: any) => String(f.uid))))])
const allSelected = computed(() => available.value.length > 0 && available.value.every(uid => selected.value.includes(uid)))
const blocked = computed(() => props.busy || props.loading || props.state.phase !== 'business')
watch(available, (uids) => {
  selected.value = selected.value.filter(uid => uids.includes(uid))
}, { immediate: true })
function toggle(uid: string) {
  if (!blocked.value)
    selected.value = selected.value.includes(uid) ? selected.value.filter(x => x !== uid) : [...selected.value, uid]
}
function hasSelection(r: any) {
  return fruits(r).some((f: any) => selected.value.includes(String(f.uid)))
}
function unlockLevel(r: any) {
  return props.state.levels?.find((l: any) => l.recipe_names?.includes(r.recipe_name))?.level
}
</script>

<template>
  <div class="craft-shade" @click.self="!busy && emit('close')">
    <section class="craft-dialog" role="dialog" aria-modal="true" aria-labelledby="craft-title">
      <header class="craft-header">
        <h2 id="craft-title">奶茶工坊</h2>
        <button class="craft-close" aria-label="关闭奶茶工坊" :disabled="busy" @click="emit('close')">
          ×
        </button>
      </header>
      <p v-if="error" class="craft-error" role="alert">
        {{ error }}
      </p>
      <div class="recipe-list">
        <article v-for="r in recipes" :key="r.recipe_id" class="recipe-card" :class="{ locked: !r.unlocked }">
          <div class="recipe-head">
            <img class="drink-image" :src="r.config?.image || img(`icon_s4_milktea_${r.recipe_id}`)" :alt="r.recipe_name">
            <div class="recipe-info">
              <h3>{{ r.recipe_name }}</h3>
              <div class="recipe-price">
                <span>售出单价</span>
                <b><img :src="img('img_s4TeaUI_rewardpng')" alt="奶茶券">{{ r.token_price }}</b>
                <b><span class="coin">金</span>{{ r.coin_price }}</b>
              </div>
            </div>
            <div class="recipe-estimate">
              <span>预计制作</span>
              <strong>{{ hasSelection(r) ? '待结算' : '0' }}<small v-if="!hasSelection(r)">杯</small></strong>
            </div>
          </div>
          <div v-if="!r.unlocked" class="recipe-empty">
            {{ unlockLevel(r) ? `店铺达到${unlockLevel(r)}级即可解锁` : '暂未解锁' }}
          </div>
          <div v-else-if="!fruits(r).length" class="recipe-empty">
            暂无材料，收获果实后再来制作吧
          </div>
          <div v-else class="fruit-list">
            <button v-for="f in fruits(r)" :key="f.uid" class="fruit-choice" :class="{ selected: selected.includes(String(f.uid)) }" :aria-pressed="selected.includes(String(f.uid))" :aria-label="`${f.name}，${f.count}个`" :disabled="blocked" @click="toggle(String(f.uid))">
              <img v-if="f.image" :src="f.image" :alt="f.name"><span v-else>{{ f.name }}</span><b>×{{ f.count }}</b>
            </button>
          </div>
        </article>
        <p v-if="!recipes.length" class="recipe-empty">暂无配方数据</p>
      </div>
      <footer class="craft-footer">
        <label class="select-all">
          <input type="checkbox" :checked="allSelected" :disabled="blocked || !available.length" @change="selected = allSelected ? [] : [...available]"><span>全选</span>
        </label>
        <span class="selected-count">已选：{{ selected.length }}</span>
        <button class="craft-confirm" :disabled="blocked || !selected.length" @click="emit('craft', { fruitUids: [...selected] })">
          {{ busy ? '制作中…' : '确认制作' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.craft-shade {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #39261899;
}
.craft-dialog {
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
.craft-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 48px 10px 18px;
  border-bottom: 1px solid #f3e7d8;
  flex-shrink: 0;
}
.craft-header h2 {
  margin: 0;
  font-size: 17px;
}
.craft-close {
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
.craft-error {
  margin: 10px 18px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff1e8;
  color: #a33f27;
  font-size: 13px;
  flex-shrink: 0;
}
.recipe-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.recipe-card {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #f3e7d8;
  background: #fdfaf5;
}
.recipe-card.locked {
  opacity: 0.7;
}
.recipe-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.drink-image {
  width: 64px;
  height: 64px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fff;
}
.recipe-info {
  flex: 1;
  min-width: 0;
}
.recipe-info h3 {
  margin: 0 0 4px;
  font-size: 15px;
}
.recipe-price {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 13px;
  color: #8a6a4f;
}
.recipe-price span {
  font-size: 11px;
  color: #b09a80;
}
.recipe-price b {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #b06a2e;
}
.recipe-price img {
  width: 16px;
  height: 14px;
  object-fit: contain;
}
.coin {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffc52e;
  color: #b87616;
  font-size: 9px;
  font-weight: 900;
}
.recipe-estimate {
  text-align: center;
  flex-shrink: 0;
}
.recipe-estimate span {
  display: block;
  font-size: 11px;
  color: #b09a80;
}
.recipe-estimate strong {
  font-size: 20px;
  color: #db7436;
}
.recipe-estimate small {
  font-size: 11px;
  margin-left: 2px;
}
.recipe-empty {
  margin: 10px 0 4px;
  padding: 14px;
  border-radius: 10px;
  background: #fdf7ef;
  color: #b09a80;
  font-size: 13px;
  text-align: center;
}
.fruit-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.fruit-choice {
  position: relative;
  width: 64px;
  height: 64px;
  padding: 4px;
  border: 2px solid #f0e2d0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #5b4632;
  font-size: 11px;
}
.fruit-choice img {
  width: 42px;
  height: 36px;
  object-fit: contain;
}
.fruit-choice b {
  color: #b06a2e;
}
.fruit-choice.selected {
  border-color: #ed9121;
  background: #fff7ea;
  box-shadow: 0 0 0 2px #f6b35255;
}
.craft-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #f3e7d8;
  background: #fffaf3;
}
.select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.select-all input {
  accent-color: #ed9121;
  width: 16px;
  height: 16px;
}
.selected-count {
  margin-left: auto;
  font-size: 13px;
  color: #8a6a4f;
}
.craft-confirm {
  padding: 9px 18px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6b352, #ed9121);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(240, 151, 46, 0.3);
}
.craft-confirm:disabled {
  cursor: default;
  opacity: 0.5;
  box-shadow: none;
}
</style>