"use client";
import { usePreferences } from "@/src/features/preferences/use-preferences";
import { ActionFeedback } from "./action-feedback";

const channels = [
    { name: "emailEnabled", label: "Email reminders" },
    { name: "inAppEnabled", label: "In-app reminders" },
    { name: "weeklySummaryEnabled", label: "Weekly summary" },
] as const;
const reminders = [
    {
        name: "maintenanceReminderDays",
        id: "maintenance-days",
        label: "Maintenance notice (days)",
        max: 90,
        defaultValue: 7,
    },
    {
        name: "warrantyReminderDays",
        id: "warranty-days",
        label: "Warranty notice (days)",
        max: 365,
        defaultValue: 30,
    },
    {
        name: "documentExpiryReminderDays",
        id: "document-days",
        label: "Document notice (days)",
        max: 365,
        defaultValue: 30,
    },
] as const;

export function NotificationPreferences() {
    const { preferences, error, message, saving, save } = usePreferences();
    return (
        <section className="settings-section">
            <h2>Reminder preferences</h2>
            <p className="muted-copy">
                Choose how and when Homi reminds you about your home.
            </p>
            <ActionFeedback error={error} message={message} />
            {preferences ? (
                <form
                    className="auth-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void save({
                            emailEnabled: form.get("emailEnabled") === "on",
                            inAppEnabled: form.get("inAppEnabled") === "on",
                            weeklySummaryEnabled:
                                form.get("weeklySummaryEnabled") === "on",
                            maintenanceReminderDays: Number(
                                form.get("maintenanceReminderDays"),
                            ),
                            warrantyReminderDays: Number(
                                form.get("warrantyReminderDays"),
                            ),
                            documentExpiryReminderDays: Number(
                                form.get("documentExpiryReminderDays"),
                            ),
                        });
                    }}
                >
                    {channels.map((channel) => (
                        <label className="check-row" key={channel.name}>
                            <input
                                name={channel.name}
                                type="checkbox"
                                defaultChecked={
                                    preferences[channel.name] !== false
                                }
                            />
                            {channel.label}
                        </label>
                    ))}
                    <div className="settings-fields">
                        {reminders.map((reminder) => (
                            <div className="field" key={reminder.name}>
                                <label htmlFor={reminder.id}>
                                    {reminder.label}
                                </label>
                                <input
                                    id={reminder.id}
                                    name={reminder.name}
                                    type="number"
                                    min={0}
                                    max={reminder.max}
                                    required
                                    defaultValue={
                                        preferences[reminder.name] ??
                                        reminder.defaultValue
                                    }
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        className="button button-small"
                        type="submit"
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save reminders"}
                    </button>
                </form>
            ) : (
                !error && <p role="status">Loading reminders…</p>
            )}
        </section>
    );
}
