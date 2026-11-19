import { ObjectId, Schema, USER_REF, baseOptions, model } from "./_shared.js";

/*
 * external_profiles — last good GitHub / Codeforces summary per user. Pages
 * show this copy, refresh it in the background when it's stale, and keep it
 * when the service is down, so a third-party outage never breaks a profile.
 */
const externalProfileSchema = new Schema(
  {
    userId: { type: ObjectId, ref: USER_REF, required: true },
    provider: { type: String, enum: ["github", "codeforces"], required: true },
    handle: { type: String, required: true, maxlength: 40 },
    data: { type: Schema.Types.Mixed, default: null }, // last successful summary
    fetchedAt: { type: Date, default: null }, // when `data` was fetched
    status: { type: String, enum: ["ok", "not_found", "error", "pending"], default: "pending" },
    error: { type: String, maxlength: 300, default: null },
    attemptedAt: { type: Date, default: null }, // last try, successful or not
  },
  baseOptions,
);
externalProfileSchema.index({ userId: 1, provider: 1 }, { unique: true });
export const ExternalProfile = model("ExternalProfile", externalProfileSchema, "external_profiles");

/* integrations — one row per job board sync, for scheduling, locking and the admin status page. */
const integrationSchema = new Schema(
  {
    key: { type: String, enum: ["remotive", "arbeitnow"], required: true, unique: true },
    lockedUntil: { type: Date, default: null }, // a sync is running
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, maxlength: 500, default: null },
    lastStats: {
      fetched: { type: Number, default: 0 },
      kept: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      closed: { type: Number, default: 0 },
    },
    trigger: { type: String, enum: ["auto", "admin", "cron"], default: null },
  },
  baseOptions,
);
export const Integration = model("Integration", integrationSchema, "integrations");
