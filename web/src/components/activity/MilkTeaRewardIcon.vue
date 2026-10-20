<script setup lang="ts">
defineProps<{ item: any, named?: boolean }>()
</script>

<template>
  <div class="tea-reward" :title="`${item.name || ''} ×${item.count}`">
    <span v-if="named" class="reward-name">{{ item.name }}</span>
    <div class="reward-frame" :class="`rarity-${item.rarity || 0}`">
      <img v-if="item.image" :src="item.image" :alt="item.name || ''">
      <span v-else class="reward-fallback">{{ item.name || '奖励' }}</span>
      <b>{{ item.count }}</b>
    </div>
  </div>
</template>

<style scoped>
.tea-reward {
  min-width: 0;
  text-align: center;
}
.reward-name {
  display: block;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.3;
  margin-bottom: 3px;
  overflow-wrap: anywhere;
}
.reward-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid #fff6dd;
  border-radius: 10px;
  background: #f6d477;
  box-shadow: 0 1px 3px rgba(156, 123, 74, 0.3);
  box-sizing: border-box;
}
.rarity-1 {
  background: #96ddee;
}
.rarity-2 {
  background: #d4a0f6;
}
.reward-frame img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  margin: 6%;
}
.reward-frame b {
  position: absolute;
  right: 2px;
  bottom: 0;
  font-size: 11px;
  line-height: 1.1;
  color: #68482f;
  text-shadow: 0 0 2px #fff;
}
.reward-fallback {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #68482f;
  overflow: hidden;
  padding: 2px;
  box-sizing: border-box;
}
</style>