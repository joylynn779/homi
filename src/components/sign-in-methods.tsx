"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Link2 } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import {
    linkingFeedback,
    type SignInMethod,
} from "@/src/features/auth/methods";
import { ActionFeedback } from "./action-feedback";

export function SignInMethods({
    onCredentialChange,
}: {
    onCredentialChange?: (connected: boolean) => void;
}) {
    const router = useRouter();
    const [methods, setMethods] = useState<SignInMethod[] | null>(null);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    async function load() {
        try {
            const response = await fetch("/api/auth-methods", {
                cache: "no-store",
            });
            if (!response.ok) throw new Error();
            const payload = (await response.json()) as {
                methods: SignInMethod[];
                email: string;
            };
            setMethods(payload.methods);
            setEmail(payload.email);
            onCredentialChange?.(
                payload.methods.some(
                    (method) =>
                        method.providerId === "credential" && method.connected,
                ),
            );
            return payload.methods;
        } catch {
            setError("Could not load sign-in methods. Please try again.");
            return null;
        }
    }
    useEffect(() => {
        let active = true;
        void Promise.resolve()
            .then(load)
            .then((next) => {
                if (!active || !next) return;
                const query = new URLSearchParams(window.location.search);
                const provider = query.get("linked");
                const callbackError = query.get("error");
                if (callbackError || query.has("link_error"))
                    setError(linkingFeedback(callbackError ?? "unknown"));
                else if (provider) {
                    const method = next.find(
                        (method) =>
                            method.providerId === provider && method.connected,
                    );
                    if (method)
                        setMessage(
                            `${method.label} connected to your Homi account.`,
                        );
                    else
                        setError(
                            "The connection could not be confirmed. Please try again.",
                        );
                }
                if (provider || callbackError || query.has("link_error"))
                    router.replace("/settings/security", { scroll: false });
            });
        const restore = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setBusy("");
                void load();
            }
        };
        window.addEventListener("pageshow", restore);
        return () => {
            active = false;
            window.removeEventListener("pageshow", restore);
        };
        // OAuth return loads this page afresh; browser restoration reloads server state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function connect(method: SignInMethod) {
        setBusy(method.providerId);
        setError("");
        setMessage("");
        try {
            const result = await authClient.linkSocial({
                provider: method.providerId as Parameters<
                    typeof authClient.linkSocial
                >[0]["provider"],
                callbackURL: `/settings/security?linked=${encodeURIComponent(method.providerId)}`,
                errorCallbackURL: "/settings/security?link_error=1",
            });
            if (result.error) {
                setError("Could not start the connection. Please try again.");
                setBusy("");
            } else if (!result.data?.redirect) {
                await load();
                setBusy("");
            }
        } catch {
            setError("Could not start the connection. Please try again.");
            setBusy("");
        }
    }
    async function disconnect(method: SignInMethod) {
        if (
            !window.confirm(
                `Disconnect ${method.label}? Your other sign-in methods will remain available.`,
            )
        )
            return;
        setBusy(method.providerId);
        setError("");
        setMessage("");
        try {
            const result = await authClient.unlinkAccount({
                providerId: method.providerId,
                accountId: method.accountId,
            });
            if (result.error)
                setError(
                    result.error.code === "SESSION_NOT_FRESH"
                        ? "Sign in again, then return to Security to disconnect this account."
                        : "Could not disconnect the account. Keep another usable sign-in method connected and try again.",
                );
            else {
                setMessage(`${method.label} disconnected.`);
                await load();
            }
        } catch {
            setError("Could not disconnect the account. Please try again.");
        } finally {
            setBusy("");
        }
    }
    return (
        <section className="settings-section">
            <h2>Sign-in methods</h2>
            <p className="muted-copy">
                Connect sign-in methods to this Homi account. Provider accounts
                must use the same email address.
            </p>
            <ActionFeedback error={error} message={message} />
            {!methods && !error && (
                <p role="status">Loading sign-in methods…</p>
            )}
            {!methods && error && (
                <button
                    className="button button-secondary button-small"
                    onClick={() => {
                        setError("");
                        void load();
                    }}
                >
                    Try again
                </button>
            )}
            {methods?.map((method) => (
                <div
                    className="sign-in-method"
                    key={`${method.providerId}:${method.accountId ?? "unlinked"}`}
                >
                    {method.providerId === "credential" ? (
                        <KeyRound size={20} aria-hidden="true" />
                    ) : (
                        <Link2 size={20} aria-hidden="true" />
                    )}
                    <div>
                        <strong>{method.label}</strong>
                        <small>
                            {method.connected
                                ? `Homi account: ${email}`
                                : method.providerId === "credential"
                                  ? "No password has been set."
                                  : `Sign in with your ${method.label} account.`}
                        </small>
                        {method.connected && !method.enabled && (
                            <small>
                                This provider is not currently configured for
                                sign-in.
                            </small>
                        )}
                        {method.connected &&
                            method.providerId !== "credential" &&
                            !method.canDisconnect && (
                                <small>
                                    Keep another usable sign-in method connected
                                    before disconnecting this account.
                                </small>
                            )}
                    </div>
                    <span className="sign-in-method-status">
                        {method.connected ? "Connected" : "Not connected"}
                    </span>
                    {method.providerId === "credential" ? (
                        !method.connected && (
                            <Link
                                className="button button-secondary button-small"
                                href="/forgot-password"
                            >
                                Set a password
                            </Link>
                        )
                    ) : method.connected ? (
                        <button
                            className="button button-secondary button-small"
                            disabled={Boolean(busy) || !method.canDisconnect}
                            aria-label={`Disconnect ${method.label}`}
                            title={`Disconnect ${method.label}`}
                            onClick={() => void disconnect(method)}
                        >
                            {busy === method.providerId
                                ? "Disconnecting…"
                                : "Disconnect"}
                        </button>
                    ) : (
                        method.enabled && (
                            <button
                                className="button button-secondary button-small"
                                disabled={Boolean(busy)}
                                aria-label={`Connect ${method.label}`}
                                title={`Connect ${method.label}`}
                                onClick={() => void connect(method)}
                            >
                                {busy === method.providerId
                                    ? "Connecting…"
                                    : "Connect"}
                            </button>
                        )
                    )}
                </div>
            ))}
        </section>
    );
}
