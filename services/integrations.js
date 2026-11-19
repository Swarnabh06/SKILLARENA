import "server-only";
import { checkJudge0 } from "@/lib/api/providers";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ExternalProfile, Integration, Opportunity } from "@/lib/db/models";
import { SOURCES, nextAllowedAt } from "./jobSync";

const plain = (v) => JSON.parse(JSON.stringify(v));

/** Everything the admin integrations page shows. Checks Judge0 live; the rest comes from the database. */
export async function integrationsStatus() {
  await connectToDatabase();
  const [rows, listingCounts, profileCounts, judge0] = await Promise.all([
    Integration.find({}).lean(),
    Opportunity.aggregate([{ $match: { source: { $in: Object.keys(SOURCES) } } }, { $group: { _id: { s: "$source", st: "$status" }, n: { $sum: 1 } } }]),
    ExternalProfile.aggregate([{ $group: { _id: { p: "$provider", st: "$status" }, n: { $sum: 1 }, last: { $max: "$fetchedAt" } } }]),
    checkJudge0(),
  ]);
  const count = (source, status) => listingCounts.find((c) => c._id.s === source && c._id.st === status)?.n ?? 0;
  const profiles = (provider) => {
    const mine = profileCounts.filter((c) => c._id.p === provider);
    return {
      ok: mine.find((c) => c._id.st === "ok")?.n ?? 0,
      notFound: mine.find((c) => c._id.st === "not_found")?.n ?? 0,
      failing: mine.find((c) => c._id.st === "error")?.n ?? 0,
      lastFetchAt: mine.reduce((l, c) => (c.last && (!l || c.last > l) ? c.last : l), null),
    };
  };
  return plain({
    boards: Object.entries(SOURCES).map(([key, s]) => {
      const row = rows.find((r) => r.key === key) ?? null;
      return {
        key,
        label: s.label,
        site: s.site,
        intervalHours: s.minIntervalMs / 3_600_000,
        autoHours: s.autoIntervalMs / 3_600_000,
        running: Boolean(row?.lockedUntil && new Date(row.lockedUntil) > new Date()),
        lastRunAt: row?.lastRunAt ?? null,
        lastSuccessAt: row?.lastSuccessAt ?? null,
        lastError: row?.lastError ?? null,
        lastStats: row?.lastStats ?? null,
        trigger: row?.trigger ?? null,
        nextAt: nextAllowedAt(key, row),
        live: count(key, "published"),
        closed: count(key, "closed"),
        takenDown: count(key, "rejected"),
      };
    }),
    github: { tokenConfigured: Boolean(process.env.GITHUB_TOKEN), ...profiles("github") },
    codeforces: profiles("codeforces"),
    judge0,
    cronConfigured: Boolean(process.env.CRON_SECRET),
  });
}
