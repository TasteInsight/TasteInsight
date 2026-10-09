import { afterEach, beforeEach, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { addIcon, setCustomIconLoader } from '@iconify/vue'
import AppIcon from '@/components/Common/AppIcon.vue'

config.global.components.AppIcon = AppIcon

// Render the real icon component with local fixtures; unit tests never need the icon API.
const templates = import.meta.glob('../**/*.vue', { query: '?raw', import: 'default', eager: true })
const fixture = { body: '<path d="M1 1h1" />', width: 24, height: 24 }
const prefixes = new Set<string>()
for (const source of Object.values(templates)) {
  for (const binding of String(source).matchAll(/(?:^|\s):?icon="([^"]*)"/g)) {
    for (const match of binding[1].matchAll(/[a-z0-9-]+:[a-z0-9-]+/g)) {
      addIcon(match[0], fixture)
      prefixes.add(match[0].split(':')[0])
    }
  }
}
for (const prefix of prefixes) setCustomIconLoader(async () => fixture, prefix)

beforeEach(() => {
  // Keep each test isolated
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
