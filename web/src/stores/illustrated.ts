import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'
import { useAccountStore } from '@/stores/account'

export interface IllustratedReward {
  itemId: number
  count: number
  name: string
  image?: string
}

export interface IllustratedLevel {
  level: number
  progress: number
  claimed: boolean
  canClaim: boolean
  rewards: IllustratedReward[]
}

export interface IllustratedItem {
  seedId: number
  name: string
  image?: string
  rewardCategory: number
  group: 'gold' | 'decoration' | 'activity'
  sort: number
  cropCategory: number
  unlocked: boolean
  progress: number
  isNew: boolean
  reward: any
  attributes: any[]
  shopSeed?: {
    goodsId: number
    price: number | null
    locked: boolean
    soldOut: boolean
    unknownMeta: boolean
    requiresUnlockCard: boolean
    requiredLevel?: number
    remainingPurchaseCount?: number
    itemCount?: number
  } | null
}

export interface IllustratedBook {
  type: number
  level: number
  progress: number
  nextLevelProgress: number
  claimable: boolean
  rewards: IllustratedReward[]
  buffs: any[]
  currentBuffs: any[]
  items: IllustratedItem[]
  levels: IllustratedLevel[]
}

export interface IllustratedSnapshot {
  crop: IllustratedBook
  mutant: IllustratedBook
  updatedAt: number
}

export const useIllustratedStore = defineStore('illustrated', () => {
  const data = ref<IllustratedSnapshot | null>(null)
  const loading = ref(false)
  const buying = ref(false)
  const claiming = ref(false)
  const error = ref('')
  let fetchRequestId = 0

  function clearIllustratedData() {
    data.value = null
    loading.value = false
    buying.value = false
    claiming.value = false
    error.value = ''
  }

  function isCurrentAccount(accountId: string) {
    const accountStore = useAccountStore()
    const currentId = String((accountStore.currentAccountId as { value?: string })?.value ?? accountStore.currentAccountId ?? '')
    return currentId === String(accountId)
  }

  async function fetchList(accountId: string) {
    if (!accountId)
      return
    const requestedId = String(accountId)
    const requestId = ++fetchRequestId
    loading.value = true
    error.value = ''
    try {
      const { data: response } = await api.get('/api/illustrated', {
        headers: { 'x-account-id': accountId },
      })
      if (requestId !== fetchRequestId || !isCurrentAccount(requestedId))
        return
      if (response.ok) {
        data.value = response.data || null
      }
      else {
        error.value = response.error || '获取图鉴失败'
      }
    }
    catch (err: any) {
      if (requestId === fetchRequestId && isCurrentAccount(requestedId))
        error.value = err.message || '获取图鉴失败'
    }
    finally {
      if (requestId === fetchRequestId)
        loading.value = false
    }
  }

  async function buySeed(accountId: string, goodsId: number, price: number) {
    buying.value = true
    try {
      const { data } = await api.post('/api/illustrated/buy', {
        goodsId,
        price,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return data
    }
    finally {
      buying.value = false
    }
  }

  async function buyAllSeeds(accountId: string, illustratedType = 1) {
    buying.value = true
    try {
      const { data } = await api.post('/api/illustrated/buy-all', {
        illustrated_type: illustratedType,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return data
    }
    finally {
      buying.value = false
    }
  }

  async function claimRewards(accountId: string, type: number) {
    claiming.value = true
    try {
      const { data } = await api.post('/api/illustrated/claim', {
        type,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return data
    }
    finally {
      claiming.value = false
    }
  }

  return {
    data,
    loading,
    buying,
    claiming,
    error,
    clearIllustratedData,
    fetchList,
    buySeed,
    buyAllSeeds,
    claimRewards,
  }
})