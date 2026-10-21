<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAccountStore } from '@/stores/account'
import { useToastStore } from '@/stores/toast'

const { currentAccountId, currentAccount } = storeToRefs(useAccountStore())
const connected = computed(() => !!currentAccount.value?.running)
const toast = useToastStore()

const data = ref<any>(null)
const busy = ref(false)
const error = ref('')
const seasonId = ref(0)
const questionId = ref(0)
const answer = ref<number | null>(null)
const receivedAt = ref(Date.now())
const tick = ref(Date.now())
let sequence = 0
let refreshedBoundary = 0

useIntervalFn(() => {
  tick.value = Date.now()
}, 1000)

const now = computed(() => Number(data.value?.serverTime || 0) + (tick.value - receivedAt.value) / 1000)
const season = computed(() => (data.value?.seasons || []).find((v: any) => v.id === seasonId.value))
const events = computed<any[]>(() => (data.value?.events || []).filter((v: any) => !season.value || season.value.eventIds.includes(v.id)))
const question = computed(() => data.value?.events.find((v: any) => v.id === questionId.value))

const nextBoundary = computed(() => {
  const snapshotTime = Number(data.value?.serverTime || 0)
  const times = (data.value?.events || []).flatMap((event: any) => [event.startTime, event.endTime + 1])
  if ((data.value?.events || []).some((event: any) => event.quizWrongToday))
    times.push((Math.floor((snapshotTime + 28800) / 86400) + 1) * 86400 - 28800)
  return Math.min(...times.filter((time: number) => time > snapshotTime))
})

const dayFormat = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' })

function leaf(event: any) {
  const part = (value: number) => {
    const parts = dayFormat.formatToParts(new Date(value * 1000))
    return {
      month: parts.find((v: any) => v.type === 'month')?.value || '',
      day: parts.find((v: any) => v.type === 'day')?.value || '',
    }
  }
  const start = part(event.startTime)
  const end = part(event.endTime)
  return {
    month: `${start.month}月`,
    day: start.day,
    until: end.month === start.month ? `至 ${end.day}日` : `至 ${end.month}月${end.day}日`,
  }
}

function lunarOf(event: any) {
  const first = String(event.description || '').split('\n')[0] || ''
  return first.startsWith('农历') ? first : ''
}

function poemOf(event: any) {
  const lines = String(event.description || '').split('\n').filter(Boolean)
  return lunarOf(event) ? lines.slice(1) : lines
}

function distance(seconds: number) {
  return seconds >= 86400
    ? `${Math.ceil(seconds / 86400)}天`
    : seconds >= 3600
      ? `${Math.ceil(seconds / 3600)}小时`
      : `${Math.max(1, Math.ceil(seconds / 60))}分钟`
}

function phase(event: any) {
  if (event.directClaimed && (!event.question || event.quizClaimed))
    return 'done'
  if (now.value > event.endTime || event.status === 3)
    return 'expired'
  return now.value < event.startTime ? 'upcoming' : 'open'
}

function phaseText(event: any) {
  const current = phase(event)
  if (current === 'done')
    return '已完成'
  if (current === 'expired')
    return '已结束'
  if (current === 'upcoming')
    return `${distance(Math.ceil(event.startTime - now.value))}后开始`
  return `进行中 · 剩 ${distance(Math.ceil(event.endTime - now.value))}`
}

function optionParts(option: string, index: number | string) {
  const match = /^([A-Z])[.．、](.*)$/.exec(option)
  return match
    ? { letter: match[1], text: (match[2] || '').trim() }
    : { letter: String.fromCharCode(65 + Number(index)), text: option }
}

function stateText(event: any, quiz = false) {
  if (quiz ? event.quizClaimed : event.directClaimed)
    return '已领取'
  if (now.value > event.endTime || event.status === 3)
    return '已过期'
  const seconds = Math.ceil(event.startTime - now.value)
  if (seconds > 0)
    return `${distance(seconds)}后${quiz ? '开启' : '可领取'}`
  return quiz ? (event.quizWrongToday ? '明日再来' : '答题') : '领取'
}

function available(event: any, quiz = false) {
  return connected.value && !busy.value
    && (quiz ? event.canAnswer : event.canClaim)
    && now.value >= event.startTime && now.value <= event.endTime
}

function openQuestion(event: any) {
  answer.value = null
  questionId.value = event.id
}

function closeQuestion() {
  if (busy.value)
    return
  questionId.value = 0
  answer.value = null
}

function getErrorMessage(cause: any, fallback: string) {
  return String(cause?.response?.data?.error || cause?.response?.data?.message || cause?.message || fallback)
}

async function request(action = '', input: any = {}) {
  if (!currentAccountId.value || !connected.value || busy.value)
    return
  const revision = ++sequence
  busy.value = true
  error.value = ''
  try {
    const options = {
      headers: { 'x-account-id': currentAccountId.value },
      skipErrorToast: true,
    } as any
    const response = action
      ? await api.post(`/api/solar-calendar/${action}`, input, options)
      : await api.get('/api/solar-calendar', options)
    if (revision !== sequence)
      return
    if (!response.data?.ok)
      throw new Error(getErrorMessage(response.data, '节令日历请求失败'))
    const result = response.data.data
    if (action) {
      questionId.value = 0
      answer.value = null
      const text = result.rewards?.map((v: any) => `${v.name} ×${v.count}`).join('、')
        || (action === 'answer' && !result.correct ? '明日再来' : '领取成功')
      if (result.refreshRequired)
        toast.warning(`${text}。请刷新确认最新进度`)
      else
        toast.success(text)
    }
    data.value = action ? result.calendar : result
    receivedAt.value = Date.now()
    tick.value = receivedAt.value
    if (!data.value?.seasons.some((v: any) => v.id === seasonId.value)) {
      const target = data.value?.events.find((v: any) => !v.directClaimed && v.endTime >= now.value)?.id || data.value?.defaultEventId
      seasonId.value = data.value?.seasons.find((v: any) => v.eventIds.includes(target))?.id
        || data.value?.seasons.at(-1)?.id
        || 0
    }
  }
  catch (cause) {
    if (revision === sequence) {
      error.value = getErrorMessage(cause, '节令日历请求失败')
      if (action) {
        toast.error(error.value)
        data.value = null
        questionId.value = 0
        answer.value = null
      }
    }
  }
  finally {
    if (revision === sequence)
      busy.value = false
  }
}

function submitAnswer() {
  if (!question.value || answer.value === null)
    return
  void request('answer', {
    id: question.value.id,
    optionIndex: answer.value,
    expectedQuestion: question.value.question,
  })
}

watch([now, busy], () => {
  const boundary = nextBoundary.value
  if (connected.value && !busy.value && now.value >= boundary && refreshedBoundary !== boundary) {
    refreshedBoundary = boundary
    void request()
  }
})

watch([currentAccountId, connected], () => {
  sequence++
  data.value = null
  busy.value = false
  questionId.value = 0
  answer.value = null
  seasonId.value = 0
  error.value = ''
  refreshedBoundary = 0
  void request()
}, { immediate: true, flush: 'sync' })

onUnmounted(() => {
  sequence++
})
</script>

<template>
  <section class="space-y-4">
    <div class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0 flex items-center gap-2">
          <div class="i-carbon-calendar text-2xl text-emerald-500" />
          <h1 class="text-xl font-bold">
            节令日历
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span class="hidden sm:inline">
            按当前账号读取节令进度
          </span>
          <BaseButton
            class="w-24"
            variant="primary"
            :loading="busy"
            :disabled="!currentAccountId || !connected"
            @click="request()"
          >
            刷新
          </BaseButton>
        </div>
      </div>

      <div v-if="!currentAccountId || !connected" class="rounded-lg bg-gray-50 p-8 text-center dark:bg-gray-900/40">
        <div class="i-carbon-calendar mx-auto mb-2 text-3xl text-gray-400" />
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ !currentAccountId ? '请先选择账号' : '请先启动账号' }}
        </p>
        <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
          节令进度按当前账号读取
        </p>
      </div>

      <div v-else-if="error || !data" class="rounded-lg bg-gray-50 p-8 text-center dark:bg-gray-900/40">
        <div :class="busy ? 'i-carbon-renew animate-spin mx-auto mb-2 text-3xl text-gray-400' : 'i-carbon-calendar mx-auto mb-2 text-3xl text-gray-400'" />
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ error || (busy ? '正在读取节令日历' : '暂未获取到节令日历') }}
        </p>
      </div>

      <template v-else>
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="entry in data.seasons"
            :key="entry.id"
            class="h-9 rounded-full border px-4 text-sm font-medium transition"
            :class="seasonId === entry.id
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'border-transparent text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'"
            :disabled="busy"
            @click="seasonId = entry.id"
          >
            {{ entry.name }}
            <span class="ml-1 text-xs opacity-70">{{ entry.litCount }}/{{ entry.totalCount }}</span>
          </button>
        </div>

        <div v-if="season" class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-600 dark:text-gray-300">
              {{ season.name }}已点亮
            </span>
            <span class="flex gap-1.5">
              <i
                v-for="index in season.totalCount"
                :key="index"
                class="h-2.5 w-2.5 rounded-full"
                :class="index <= season.litCount ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'"
              />
            </span>
            <b class="text-emerald-600 dark:text-emerald-400">{{ season.litCount }}/{{ season.totalCount }}</b>
          </div>
          <div v-if="season.rewards.length" class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              集齐奖励
            </span>
            <span
              v-for="item in season.rewards"
              :key="item.id"
              class="h-7 flex items-center gap-1 rounded-lg bg-white px-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              :title="`${item.name} ×${item.count}`"
            >
              {{ item.name }} ×{{ item.count }}
            </span>
            <BaseButton
              class="w-20"
              size="sm"
              :variant="season.canClaim ? 'primary' : 'secondary'"
              :loading="busy"
              :disabled="busy || !season.canClaim"
              @click="request('season', { id: season.id })"
            >
              {{ season.claimed ? '已领取' : season.canClaim ? '领取' : '集齐后可领' }}
            </BaseButton>
          </div>
        </div>

        <ol v-if="events.length" class="space-y-3">
          <li
            v-for="event in events"
            :key="event.id"
            class="flex gap-3 rounded-xl border p-4"
            :class="phase(event) === 'done'
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              : phase(event) === 'expired'
                ? 'border-gray-200 opacity-70 dark:border-gray-700'
                : phase(event) === 'upcoming'
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-emerald-200 dark:border-emerald-900/40'"
          >
            <div class="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100 py-2 text-center dark:bg-gray-800">
              <span class="text-[10px] text-gray-500 dark:text-gray-400">{{ leaf(event).month }}</span>
              <b class="text-lg text-gray-800 dark:text-gray-200">{{ leaf(event).day }}</b>
              <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ leaf(event).until }}</span>
              <span v-if="phase(event) === 'done'" class="i-carbon-checkmark mt-1 text-emerald-500" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ event.name }}
                </h3>
                <span v-if="lunarOf(event)" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ lunarOf(event) }}
                </span>
                <span
                  class="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                  :class="phase(event) === 'done'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : phase(event) === 'expired'
                      ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      : phase(event) === 'upcoming'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'"
                >
                  {{ phaseText(event) }}
                </span>
              </div>
              <p v-if="poemOf(event).length" class="mt-1 space-y-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                <span v-for="line in poemOf(event)" :key="line" class="block">
                  {{ line }}
                </span>
              </p>

              <div class="mt-3 space-y-2">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="text-gray-500 dark:text-gray-400">
                    节令奖励
                  </span>
                  <span
                    v-for="item in event.rewards"
                    :key="item.id"
                    class="h-7 flex items-center gap-1 rounded-lg bg-white px-2 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    :title="`${item.name} ×${item.count}`"
                  >
                    {{ item.name }} ×{{ item.count }}
                  </span>
                  <BaseButton
                    class="ml-auto"
                    size="sm"
                    :variant="available(event) ? 'primary' : 'secondary'"
                    :loading="busy"
                    :disabled="!available(event)"
                    @click="request('claim', { id: event.id })"
                  >
                    {{ stateText(event) }}
                  </BaseButton>
                </div>
                <div v-if="event.question" class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="text-gray-500 dark:text-gray-400">
                    答题奖励
                  </span>
                  <span
                    v-for="item in event.questionRewards"
                    :key="item.id"
                    class="h-7 flex items-center gap-1 rounded-lg bg-white px-2 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    :title="`${item.name} ×${item.count}`"
                  >
                    {{ item.name }} ×{{ item.count }}
                  </span>
                  <BaseButton
                    class="ml-auto"
                    size="sm"
                    :variant="available(event, true) ? 'primary' : 'secondary'"
                    :loading="busy"
                    :disabled="!available(event, true)"
                    @click="openQuestion(event)"
                  >
                    {{ stateText(event, true) }}
                  </BaseButton>
                </div>
                <p v-if="event.quizWrongToday && event.errorTips" class="flex items-start gap-1 text-xs text-red-500">
                  <span class="i-carbon-information mt-0.5" />
                  {{ event.errorTips }}
                </p>
              </div>
            </div>
          </li>
        </ol>

        <div v-else class="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          本季度暂无节令活动
        </div>
      </template>
    </div>

    <div
      v-if="question"
      class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      @click.self="closeQuestion"
    >
      <div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-800">
        <h3 class="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">
          {{ question.name }} · 节令问答
        </h3>
        <p class="mb-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ question.question }}
        </p>
        <div class="space-y-2">
          <label
            v-for="(option, index) in question.options"
            :key="index"
            class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm"
            :class="answer === index
              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
              : question.wrongOptions.includes(index)
                ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
          >
            <input
              v-model="answer"
              type="radio"
              name="solar-answer"
              class="h-4 w-4 accent-emerald-500"
              :value="index"
              :disabled="busy || question.wrongOptions.includes(index)"
            >
            <b class="text-gray-700 dark:text-gray-200">{{ optionParts(option, index).letter }}</b>
            <span class="text-gray-700 dark:text-gray-200">{{ optionParts(option, index).text }}</span>
            <span v-if="question.answerIndex === index" class="ml-auto shrink-0 text-xs font-semibold text-emerald-600">
              正确答案
            </span>
            <span v-else-if="question.wrongOptions.includes(index)" class="ml-auto shrink-0 text-xs font-semibold text-red-500">
              已答错
            </span>
          </label>
        </div>
        <div class="mt-4 flex gap-2">
          <BaseButton
            class="flex-1"
            variant="secondary"
            :disabled="busy"
            @click="closeQuestion"
          >
            取消
          </BaseButton>
          <BaseButton
            class="flex-1"
            variant="primary"
            :loading="busy"
            :disabled="answer === null || !available(question, true)"
            @click="submitAnswer"
          >
            提交答案
          </BaseButton>
        </div>
      </div>
    </div>
  </section>
</template>