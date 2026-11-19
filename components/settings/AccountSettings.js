"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SaveRow, SectionCard, TextField } from "@/components/profile/fields";
import { authClient } from "@/lib/auth/client";

export default function AccountSettings({ email, providers }) {
  const router = useRouter();
  const hasPassword = providers.includes("credential");
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const bind = (key) => ({
    id: `pw-${key}`,
    type: "password",
    value: form[key],
    onChange: (e) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setError("");
      setStatus("idle");
    },
  });

  async function changePassword() {
    const fail = (msg) => {
      setError(msg);
      setStatus("error");
    };
    if (!form.current) return fail("Enter your current password.");
    if (form.next.length < 8) return fail("Use at least 8 characters for the new password.");
    if (form.next !== form.confirm) return fail("The new passwords don't match.");
    setStatus("saving");
    const { error: err } = await authClient.changePassword({
      currentPassword: form.current,
      newPassword: form.next,
      revokeOtherSessions: true,
    });
    if (err) return fail(err.message || "Couldn't change your password.");
    setForm({ current: "", next: "", confirm: "" });
    setStatus("saved");
  }

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Account" description="How you sign in to SkillArena.">
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="truncate">{email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Sign-in methods</dt>
            <dd>{providers.map((p) => (p === "credential" ? "Email and password" : p === "google" ? "Google" : p)).join(", ")}</dd>
          </div>
        </dl>
      </SectionCard>

      {hasPassword ? (
        <SectionCard
          title="Change password"
          description="Signs you out on your other devices."
          footer={<SaveRow status={status} error={error} label="Change password" onClick={changePassword} />}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            <TextField label="Current password" autoComplete="current-password" {...bind("current")} />
            <TextField label="New password" autoComplete="new-password" {...bind("next")} />
            <TextField label="Confirm new password" autoComplete="new-password" {...bind("confirm")} />
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Password" description="You sign in with Google, so there's no SkillArena password to change." />
      )}

      <SectionCard title="Sign out" description="End your session on this device.">
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-full border border-danger-600 px-4 py-2 text-sm text-danger-600 transition-colors hover:bg-danger-600 hover:text-white"
        >
          <LogOut size={15} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </SectionCard>
    </div>
  );
}
