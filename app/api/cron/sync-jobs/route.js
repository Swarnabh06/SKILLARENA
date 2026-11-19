import { timingSafeEqual } from "node:crypto";
import { NextResponse, connection } from "next/server";
import { apiError } from "@/lib/auth/guards";
import { syncDueSources } from "@/services/jobSync";

export const maxDuration = 60;

/**
 * For a scheduler (e.g. Vercel Cron): syncs the job boards that are due.
 * Needs "Authorization: Bearer <CRON_SECRET>"; disabled when CRON_SECRET isn't set.
 */
export async function GET(request) {
  await connection(); // always run at request time, never prerendered at build
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(404, "Not found.");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return apiError(401, "Unauthorized.");
  return NextResponse.json(await syncDueSources({ trigger: "cron" }));
}
