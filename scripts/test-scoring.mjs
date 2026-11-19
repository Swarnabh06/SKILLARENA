/**
 * Unit tests for contest scoring and calendar helpers.
 *   node scripts/test-scoring.mjs
 */
import assert from "node:assert/strict";
import { computeStandings, rankBy } from "../lib/contests/scoring.js";
import { dayStart, monthStartKey, weekStartKey } from "../lib/utils/time.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
};

const points = new Map([["A", 100], ["B", 200], ["C", 300]]);

test("score is the sum of solved problems' points", () => {
  const rows = computeStandings(
    [
      { userId: "u1", problemId: "A", status: "accepted", minute: 5 },
      { userId: "u1", problemId: "B", status: "accepted", minute: 20 },
    ],
    points,
  );
  assert.equal(rows[0].score, 300);
  assert.equal(rows[0].solvedCount, 2);
  assert.equal(rows[0].penaltyMinutes, 25);
});

test("wrong attempts add penalty only once the problem is solved", () => {
  const rows = computeStandings(
    [
      { userId: "u1", problemId: "A", status: "wrong_answer", minute: 3 },
      { userId: "u1", problemId: "A", status: "time_limit_exceeded", minute: 6 },
      { userId: "u1", problemId: "A", status: "accepted", minute: 9 },
      { userId: "u1", problemId: "B", status: "wrong_answer", minute: 30 }, // never solved: no penalty
    ],
    points,
  );
  assert.equal(rows[0].score, 100);
  assert.equal(rows[0].penaltyMinutes, 9 + 2 * 10);
  assert.equal(rows[0].submissions, 4);
});

test("compilation errors are not penalised and resubmitting a solved problem changes nothing", () => {
  const rows = computeStandings(
    [
      { userId: "u1", problemId: "A", status: "compilation_error", minute: 1 },
      { userId: "u1", problemId: "A", status: "accepted", minute: 4 },
      { userId: "u1", problemId: "A", status: "accepted", minute: 8 },
      { userId: "u1", problemId: "A", status: "wrong_answer", minute: 9 },
    ],
    points,
  );
  assert.equal(rows[0].score, 100);
  assert.equal(rows[0].penaltyMinutes, 4);
});

test("ranking: score, then penalty, then earlier last accept; ties share a rank", () => {
  const rows = computeStandings(
    [
      { userId: "slow", problemId: "C", status: "accepted", minute: 50 },
      { userId: "fast", problemId: "C", status: "accepted", minute: 10 },
      { userId: "many", problemId: "A", status: "accepted", minute: 1 },
      { userId: "many", problemId: "B", status: "accepted", minute: 2 },
      { userId: "twinA", problemId: "A", status: "accepted", minute: 7 },
      { userId: "twinB", problemId: "A", status: "accepted", minute: 7 },
    ],
    points,
    { participants: ["idle"] },
  );
  // All three 300-point users are ordered by penalty (3, 10, 50); the twins tie; idle is last.
  assert.deepEqual(
    rows.map((r) => `${r.rank}:${r.userId}`),
    ["1:many", "2:fast", "3:slow", "4:twinA", "4:twinB", "6:idle"],
  );
});

test("same score: lower penalty wins even with fewer problems", () => {
  const rows = computeStandings(
    [
      { userId: "fast", problemId: "C", status: "accepted", minute: 10 },
      { userId: "many", problemId: "A", status: "accepted", minute: 1 },
      { userId: "many", problemId: "B", status: "accepted", minute: 2 },
    ],
    points,
  );
  assert.equal(rows[0].userId, "many");
  assert.equal(rows[1].userId, "fast");
});

test("rankBy gives competition ranks", () => {
  const rows = rankBy([{ v: 9 }, { v: 7 }, { v: 7 }, { v: 3 }], (r) => r.v);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 2, 4]);
});

test("week starts on Monday and month on the 1st (platform calendar)", () => {
  assert.equal(weekStartKey("2026-11-20"), "2026-11-16"); // Friday → Monday
  assert.equal(weekStartKey("2026-11-16"), "2026-11-16"); // Monday stays
  assert.equal(weekStartKey("2026-11-22"), "2026-11-16"); // Sunday → previous Monday
  assert.equal(monthStartKey("2026-11-20"), "2026-11-01");
  assert.equal(dayStart("2026-11-20").toISOString(), "2026-11-19T18:30:00.000Z"); // IST midnight
});

console.log(`\n${passed} scoring tests passed.`);
