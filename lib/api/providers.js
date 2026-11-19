import "server-only";
import { fetchJson, ExternalApiError } from "./http";
import { mapArbeitnowJob, mapRemotiveJob } from "./jobs/map";
import { mapCodeforces, mapGithub } from "./profiles/map";

/* ── GitHub ─────────────────────────────────────────────────────── */
const GITHUB = "https://api.github.com";
const githubHeaders = () => ({
  "X-GitHub-Api-Version": "2022-11-28",
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

export const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Public GitHub profile summary. Uses GITHUB_TOKEN when set (5,000 requests/hour instead of 60). */
export async function fetchGithubSummary(username) {
  if (!GITHUB_USERNAME.test(username)) throw new ExternalApiError("GitHub", "not_found", "That isn't a valid GitHub username.");
  const name = encodeURIComponent(username);
  const user = await fetchJson(`${GITHUB}/users/${name}`, { source: "GitHub", headers: githubHeaders() });
  if (user?.type && user.type !== "User") throw new ExternalApiError("GitHub", "not_found", "That GitHub account isn't a personal account.");
  const repos = await fetchJson(`${GITHUB}/users/${name}/repos?type=owner&sort=pushed&per_page=50`, { source: "GitHub", headers: githubHeaders() });
  return mapGithub(user, Array.isArray(repos) ? repos : []);
}

/* ── Codeforces ─────────────────────────────────────────────────── */
const CODEFORCES = "https://codeforces.com/api";
export const CODEFORCES_HANDLE = /^[A-Za-z0-9_.-]{3,24}$/;

async function codeforces(method, params) {
  const data = await fetchJson(`${CODEFORCES}/${method}?${new URLSearchParams(params)}`, { source: "Codeforces", retries: 1 });
  if (data?.status !== "OK") {
    const notFound = /not found/i.test(data?.comment ?? "");
    throw new ExternalApiError("Codeforces", notFound ? "not_found" : "bad_response", notFound ? "Codeforces handle not found." : "Codeforces sent an unexpected response.");
  }
  return data.result;
}

/** Codeforces rating summary: user.info plus the rated-contest history. */
export async function fetchCodeforcesSummary(handle) {
  if (!CODEFORCES_HANDLE.test(handle)) throw new ExternalApiError("Codeforces", "not_found", "That isn't a valid Codeforces handle.");
  let info;
  try {
    [info] = await codeforces("user.info", { handles: handle });
  } catch (error) {
    // Unknown handles come back as HTTP 400, which fetchJson reports as "unavailable".
    if (error instanceof ExternalApiError && error.status === 400) throw new ExternalApiError("Codeforces", "not_found", "Codeforces handle not found.", 400);
    throw error;
  }
  const history = await codeforces("user.rating", { handle: info.handle });
  return mapCodeforces(info, history);
}

/* ── Job boards ─────────────────────────────────────────────────── */
/**
 * Remotive's terms: link back to the listing, credit Remotive as the source,
 * and fetch at most a few times a day (we sync at most every 6 hours).
 */
export async function fetchRemotiveJobs(catalogue) {
  const data = await fetchJson("https://remotive.com/api/remote-jobs?category=software-dev", { source: "Remotive", timeoutMs: 15_000 });
  const jobs = Array.isArray(data?.jobs) ? data.jobs : null;
  if (!jobs) throw new ExternalApiError("Remotive", "bad_response", "Remotive sent an unexpected response.");
  return { fetched: jobs.length, items: jobs.map((j) => mapRemotiveJob(j, catalogue)).filter(Boolean) };
}

/** Arbeitnow's free API (updated hourly): the newest 300 jobs, one request per sync. */
export async function fetchArbeitnowJobs(catalogue) {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api", { source: "Arbeitnow", timeoutMs: 25_000, retries: 1 });
  if (!Array.isArray(data?.data)) throw new ExternalApiError("Arbeitnow", "bad_response", "Arbeitnow sent an unexpected response.");
  return { fetched: data.data.length, items: data.data.map((j) => mapArbeitnowJob(j, catalogue)).filter(Boolean) };
}

/* ── Judge0 ─────────────────────────────────────────────────────── */
/** Reachability check for the code runner (GET /about). */
export async function checkJudge0() {
  const base = process.env.JUDGE0_URL?.replace(/\/$/, "");
  if (!base) return { configured: false };
  const headers = {};
  const key = process.env.JUDGE0_API_KEY;
  const host = process.env.JUDGE0_API_HOST;
  if (key && host) Object.assign(headers, { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host });
  else if (key) headers["X-Auth-Token"] = key;
  const started = Date.now();
  try {
    const about = await fetchJson(`${base}/about`, { source: "Judge0", headers, timeoutMs: 6000, retries: 0 });
    return { configured: true, ok: true, version: about?.version ?? null, latencyMs: Date.now() - started };
  } catch (error) {
    return { configured: true, ok: false, error: error.message, latencyMs: Date.now() - started };
  }
}
