import assert from "node:assert/strict";
import test from "node:test";

import { canSubmitScore, scoreBeatsExisting } from "./leaderboard.js";

test("canSubmitScore accepts only completed all-clue runs with finite timing", () => {
  assert.equal(canSubmitScore({ elapsedMs: 60_000, foundCount: 16, total: 16 }), true);
  assert.equal(canSubmitScore({ elapsedMs: 60_000, foundCount: 15, total: 16 }), false);
  assert.equal(canSubmitScore({ elapsedMs: Number.NaN, foundCount: 16, total: 16 }), false);
  assert.equal(canSubmitScore({ elapsedMs: 0, foundCount: 16, total: 16 }), false);
});

test("scoreBeatsExisting only replaces missing or slower scores", () => {
  assert.equal(scoreBeatsExisting(null, 80_000), true);
  assert.equal(scoreBeatsExisting({ best_elapsed_ms: 90_000 }, 80_000), true);
  assert.equal(scoreBeatsExisting({ best_elapsed_ms: 90_000 }, 90_000), false);
  assert.equal(scoreBeatsExisting({ best_elapsed_ms: 90_000 }, 120_000), false);
});
