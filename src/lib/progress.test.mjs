import assert from "node:assert/strict";
import test from "node:test";

import {
  BEST_SCORE_KEY,
  buildRestartSnapshot,
  maybeCompleteRun,
  pickDisplayedTiming,
  updateBestScore,
} from "./progress.js";

test("maybeCompleteRun locks timing exactly once when all clues are found", () => {
  const first = maybeCompleteRun({
    completion: null,
    foundCount: 16,
    total: 16,
    nowTs: 20_000,
    startedAt: 5_000,
    chatMs: 2_000,
    skipMs: 3_600_000,
  });

  assert.equal(first.completedAt, 20_000);
  assert.equal(first.finalElapsedMs, 75_000);
  assert.equal(first.finalGameMs, 4_380_000);
  assert.equal(first.finalDay, 1);

  const unchanged = maybeCompleteRun({
    completion: first,
    foundCount: 16,
    total: 16,
    nowTs: 99_000,
    startedAt: 5_000,
    chatMs: 0,
    skipMs: 0,
  });

  assert.deepEqual(unchanged, first);
});

test("pickDisplayedTiming uses frozen completion values after the run is complete", () => {
  const timing = pickDisplayedTiming({
    completion: {
      completedAt: 20_000,
      finalElapsedMs: 75_000,
      finalGameMs: 4_380_000,
      finalDay: 1,
    },
    elapsedMs: 500_000,
    gameMs: 10_000_000,
  });

  assert.deepEqual(timing, {
    elapsedMs: 75_000,
    gameMs: 4_380_000,
    isComplete: true,
  });
});

test("updateBestScore keeps the fastest historical score", () => {
  const existing = { elapsedMs: 90_000, completedAt: 10_000, finalDay: 1 };

  assert.deepEqual(updateBestScore(existing, { elapsedMs: 120_000, completedAt: 20_000, finalDay: 2 }), existing);
  assert.deepEqual(updateBestScore(existing, { elapsedMs: 80_000, completedAt: 30_000, finalDay: 1 }), {
    elapsedMs: 80_000,
    completedAt: 30_000,
    finalDay: 1,
  });
});

test("buildRestartSnapshot clears only current-run state and preserves historical best", () => {
  const snapshot = buildRestartSnapshot({
    currentRunKey: "fde-play-v1",
    bestScoreKey: BEST_SCORE_KEY,
  });

  assert.deepEqual(snapshot.removeKeys, ["fde-play-v1"]);
  assert.equal(snapshot.preserveKeys.includes(BEST_SCORE_KEY), true);
  assert.equal(snapshot.reload, true);
});
