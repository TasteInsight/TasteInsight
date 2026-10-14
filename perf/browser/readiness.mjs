// k6 logs can split a readiness message across stream chunks.
export function readinessReader(executionId, onReady) {
  let tail = "",
    seen = false;
  const marker = `__PERF_READY__${executionId}:`;
  return (chunk) => {
    if (seen) return;
    tail = (tail + chunk.toString()).slice(-8192);
    const start = tail.indexOf(marker);
    if (start < 0) return;
    const match = /^(\d{13})!/.exec(tail.slice(start + marker.length));
    if (!match) return;
    seen = true;
    onReady({ startedAt: Date.now(), scheduledEndAt: Number(match[1]) });
  };
}
