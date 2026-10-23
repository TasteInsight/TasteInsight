import { logRecommendationFeedback } from '@/api/modules/recommendation';
import type { RecommendationFeedback } from '@/types/api';

/** A delivery/dish/type tuple remains identical across retries. */
export function createRecommendationFeedback(isCurrent: () => boolean) {
  const sent = new Set<string>();
  const pending = new Map<string, ReturnType<typeof setTimeout> | null>();
  let generation = 0;
  function reset() {
    generation += 1;
    pending.forEach(timer => {
      if (timer !== null) clearTimeout(timer);
    });
    pending.clear();
    sent.clear();
  }
  function send(event: RecommendationFeedback) {
    if (!event.deliveryId || !isCurrent()) return;
    const key = `${event.deliveryId}:${event.dishId}:${event.eventType}`;
    if (sent.has(key) || pending.has(key)) return;
    const run = generation;
    async function attempt(retry: number) {
      if (run !== generation || !isCurrent()) {
        pending.delete(key);
        return;
      }
      pending.set(key, null);
      try {
        const result = await logRecommendationFeedback(event);
        if (result.code !== 200 && result.code !== 201) throw new Error(result.message);
        if (run === generation) {
          sent.add(key);
          pending.delete(key);
        }
      } catch {
        if (run !== generation) return;
        if (retry < 2 && isCurrent()) {
          pending.set(
            key,
            setTimeout(() => void attempt(retry + 1), 1000 * 2 ** retry)
          );
        } else pending.delete(key);
      }
    }
    void attempt(0);
  }
  return { send, reset };
}
