"use client";
import { usePreferences } from "@/src/features/preferences/use-preferences";
import { ActionFeedback } from "./action-feedback";

export function TimezoneSettings() {
    const { preferences, error, message, saving, save } = usePreferences();
    return (
        <section className="settings-section">
            <h2>Timezone</h2>
            <p className="muted-copy">
                Choose the timezone used for your reminders.
            </p>
            <ActionFeedback error={error} message={message} />
            {preferences ? (
                <form
                    className="auth-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save({
                            timezone: String(
                                new FormData(event.currentTarget).get(
                                    "timezone",
                                ),
                            ),
                        });
                    }}
                >
                    <div className="field">
                        <label htmlFor="preference-timezone">Timezone</label>
                        <input
                            id="preference-timezone"
                            name="timezone"
                            defaultValue={preferences.timezone ?? "UTC"}
                            required
                            maxLength={80}
                            placeholder="America/New_York"
                        />
                    </div>
                    <button
                        className="button button-small"
                        type="submit"
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save timezone"}
                    </button>
                </form>
            ) : (
                !error && <p role="status">Loading timezone…</p>
            )}
        </section>
    );
}
