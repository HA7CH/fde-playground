export const BEST_SCORE_KEY = "fde-best-score-v1";
export const GAME_SPEED = 60;
export const GH = 3_600_000;
export const DAY_START = 9;
export const DAY_END = 21;
export const DAY_LEN = DAY_END - DAY_START;

export function gameClock(gameMs) {
  const totalH = gameMs / GH;
  return { day: Math.floor(totalH / DAY_LEN) + 1, hod: DAY_START + (totalH % DAY_LEN) };
}

export function elapsedForRun({ nowTs, startedAt, skipMs }) {
  if (typeof startedAt !== "number") return 0;
  return Math.max(0, nowTs - startedAt) + (skipMs || 0) / GAME_SPEED;
}

export function gameMsForRun({ nowTs, startedAt, chatMs, skipMs }) {
  if (typeof startedAt !== "number") return 0;
  return Math.max(0, nowTs - startedAt - (chatMs || 0)) * GAME_SPEED + (skipMs || 0);
}

export function maybeCompleteRun({ completion, foundCount, total, nowTs, startedAt, chatMs, skipMs }) {
  if (completion) return completion;
  if (foundCount < total || typeof startedAt !== "number") return null;

  const finalGameMs = gameMsForRun({ nowTs, startedAt, chatMs, skipMs });
  return {
    completedAt: nowTs,
    finalElapsedMs: elapsedForRun({ nowTs, startedAt, skipMs }),
    finalGameMs,
    finalDay: gameClock(finalGameMs).day,
  };
}

export function pickDisplayedTiming({ completion, elapsedMs, gameMs }) {
  if (!completion) return { elapsedMs, gameMs, isComplete: false };
  return {
    elapsedMs: completion.finalElapsedMs,
    gameMs: completion.finalGameMs,
    isComplete: true,
  };
}

export function updateBestScore(existing, candidate) {
  if (!candidate || !Number.isFinite(candidate.elapsedMs) || candidate.elapsedMs <= 0) return existing ?? null;
  if (!existing || candidate.elapsedMs < existing.elapsedMs) return candidate;
  return existing;
}

export function buildRestartSnapshot({ currentRunKey, bestScoreKey = BEST_SCORE_KEY }) {
  return {
    removeKeys: [currentRunKey],
    preserveKeys: [bestScoreKey],
    reload: true,
  };
}
