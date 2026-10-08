"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Download, KeyRound, LogOut, Monitor, RefreshCcw } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import { ActionFeedback } from "./action-feedback";
import { SignInMethods } from "./sign-in-methods";

type ActiveSession = {
    id: string;
    token: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    expiresAt: Date | string;
};
export function SecurityWorkspace() {
    const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
    const [hasPassword, setHasPassword] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function loadSessions() {
        const result = await authClient.listSessions();
        if (result.error) {
            setError(
                "Could not load sessions. Sign in again if your session has expired.",
            );
            return;
        }
        setSessions((result.data ?? []) as ActiveSession[]);
    }
    useEffect(() => {
        void authClient
            .listSessions()
            .then((result) => {
                if (result.error)
                    setError(
                        "Could not load sessions. Sign in again if your session has expired.",
                    );
                else setSessions((result.data ?? []) as ActiveSession[]);
            })
            .catch(() =>
                setError("Could not load sessions. Please try again."),
            );
    }, []);
    async function changePassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const result = await authClient.changePassword({
                currentPassword: String(form.get("currentPassword") ?? ""),
                newPassword: String(form.get("newPassword") ?? ""),
                revokeOtherSessions: true,
            });
            if (result.error) {
                setError(
                    "Could not change the password. Check the current password and try again.",
                );
                return;
            }
            element.reset();
            setMessage("Password changed. Other sessions were revoked.");
            await loadSessions();
        } catch {
            setError("Could not change the password. Please try again.");
        } finally {
            setBusy(false);
        }
    }
    async function revoke(token?: string) {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const result = token
                ? await authClient.revokeSession({ token })
                : await authClient.revokeOtherSessions();
            if (result.error) {
                setError("Could not revoke sessions. Please try again.");
                return;
            }
            setMessage(token ? "Session revoked." : "Other sessions revoked.");
            await loadSessions();
        } catch {
            setError("Could not revoke sessions. Please try again.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <SignInMethods onCredentialChange={setHasPassword} />
            <ActionFeedback error={error} message={message} />
            {hasPassword && (
                <section className="settings-section">
                    <h2>Change password</h2>
                    <form className="auth-form" onSubmit={changePassword}>
                        <div className="field">
                            <label htmlFor="current-password">
                                Current password
                            </label>
                            <input
                                id="current-password"
                                name="currentPassword"
                                type="password"
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="new-password">New password</label>
                            <input
                                id="new-password"
                                name="newPassword"
                                type="password"
                                autoComplete="new-password"
                                minLength={10}
                                maxLength={128}
                                required
                            />
                        </div>
                        <button
                            className="button button-small"
                            type="submit"
                            disabled={busy}
                        >
                            <KeyRound size={16} />
                            {busy ? "Saving…" : "Update password"}
                        </button>
                    </form>
                </section>
            )}
            <section className="settings-section">
                <h2>Sessions</h2>
                <p className="muted-copy">
                    Review your signed-in devices and revoke access when needed.
                </p>
                {!sessions && !error && <p role="status">Loading sessions…</p>}
                {sessions?.map((session) => (
                    <div className="settings-sessions" key={session.id}>
                        <Monitor size={20} aria-hidden="true" />
                        <div>
                            <strong>
                                {session.userAgent?.slice(0, 70) ||
                                    "Unknown device"}
                            </strong>
                            <small>
                                {session.ipAddress || "IP unavailable"} ·
                                expires{" "}
                                {new Intl.DateTimeFormat("en", {
                                    dateStyle: "medium",
                                }).format(new Date(session.expiresAt))}
                            </small>
                        </div>
                        <button
                            className="icon-action"
                            aria-label="Revoke session"
                            title="Revoke session"
                            disabled={busy}
                            onClick={() => void revoke(session.token)}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ))}
                <button
                    className="button button-secondary button-small"
                    disabled={busy}
                    onClick={() => void revoke()}
                >
                    <RefreshCcw size={16} />
                    Revoke all other sessions
                </button>
            </section>
            <section className="settings-section">
                <h2>Account & privacy</h2>
                <p className="muted-copy">
                    Homi ships without advertising trackers or third-party
                    analytics. Export your account data at any time.
                </p>
                <div className="inline-actions">
                    <a
                        className="button button-secondary button-small"
                        href="/api/export/account"
                    >
                        <Download size={16} />
                        Export JSON
                    </a>
                    <button
                        className="button button-secondary button-small"
                        onClick={() =>
                            void authClient.signOut({
                                fetchOptions: {
                                    onSuccess: () =>
                                        window.location.assign("/"),
                                },
                            })
                        }
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            </section>
        </>
    );
}
