import { computed, ref } from 'vue';
import { locale, t } from '@/i18n';
import request from '@/utils/request';

export interface AllergenEntry {
  value: string;
  nameZh: string;
  nameEn?: string | null;
  aliases: string[];
}
const fallback = [
  ['花生', 'food.peanuts'],
  ['牛奶', 'food.milk'],
  ['鸡蛋', 'food.eggs'],
  ['海鲜', 'food.seafood'],
  ['大豆', 'food.soy'],
  ['小麦', 'food.wheat'],
  ['坚果', 'food.treeNuts'],
  ['芝麻', 'food.sesame'],
  ['芒果', 'food.mango'],
  ['菠萝', 'food.pineapple'],
  ['猕猴桃', 'food.kiwi'],
  ['桃子', 'food.peach'],
  ['蚕豆', 'food.broadBeans'],
].map(([value, key]) => ({
  value,
  get label() {
    return t(key);
  },
}));
const entries = ref<AllergenEntry[]>([]);
let pending: Promise<void> | undefined;
export function parseAllergenList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,，;；、\n\r]+/)
        .map(value => value.trim())
        .filter(Boolean)
    ),
  ];
}
function findEntry(value: string) {
  const key = value.trim().toLowerCase();
  return entries.value.find(entry =>
    [entry.value, entry.nameZh, entry.nameEn, ...entry.aliases].some(
      name => name?.toLowerCase() === key
    )
  );
}
export function allergenLabel(value: string): string {
  const entry = findEntry(value);
  if (entry) return (locale.value === 'en' ? entry.nameEn : entry.nameZh) || entry.nameZh || value;
  return fallback.find(entry => entry.value === value)?.label || value;
}
export function allergenValue(value: string): string {
  return (
    findEntry(value)?.value ||
    fallback.find(
      entry => entry.value === value || entry.label.toLowerCase() === value.trim().toLowerCase()
    )?.value ||
    value.trim()
  );
}
export const allergenOptions = computed(() =>
  entries.value.length
    ? entries.value.map(entry => ({ value: entry.value, label: allergenLabel(entry.value) }))
    : fallback
);
export function loadAllergenCatalog(): Promise<void> {
  if (pending) return pending;
  pending = request<AllergenEntry[]>({ url: '/allergens', method: 'GET', auth: 'none' })
    .then(response => {
      if (Array.isArray(response.data) && response.data.length) entries.value = response.data;
    })
    .catch(() => {})
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
