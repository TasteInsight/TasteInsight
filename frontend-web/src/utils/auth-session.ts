import { readonly, ref } from 'vue'

const sessionVersion = ref(0)

export const authSessionVersion = readonly(sessionVersion)

export const getAuthSessionVersion = (): number => sessionVersion.value

export const invalidateAuthSession = (): void => {
  sessionVersion.value += 1
}
