export function canSubmitScore({ elapsedMs, foundCount, total }) {
  return Number.isFinite(elapsedMs) && elapsedMs > 0 && foundCount >= total;
}

export function scoreBeatsExisting(existing, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return false;
  if (!existing) return true;
  return elapsedMs < existing.best_elapsed_ms;
}
