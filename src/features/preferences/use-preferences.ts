"use client";
import { useEffect, useState } from "react";
import type { PreferencePatch } from "./validation";

export function usePreferences() {
    const [preferences, setPreferences] = useState<PreferencePatch | null>(
        null,
    );
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void fetch("/api/preferences", { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error();
                const payload = await response.json();
                setPreferences(payload.preferences ?? {});
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setError(
                        "Could not load preferences. Please refresh to try again.",
                    );
            });
        return () => controller.abort();
    }, []);
    async function save(input: PreferencePatch) {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const response = await fetch("/api/preferences", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
            });
            if (!response.ok) throw new Error();
            const payload = await response.json();
            setPreferences(payload.preferences);
            setMessage("Preferences saved.");
        } catch {
            setError("Could not save preferences. Please try again.");
        } finally {
            setSaving(false);
        }
    }
    return { preferences, error, message, saving, save };
}
