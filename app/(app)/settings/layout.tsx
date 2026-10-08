import { SettingsNavigation } from "@/src/components/settings-navigation";
import "./settings.css";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main id="main" className="app-main settings-workspace">
            <div className="dashboard-head">
                <div>
                    <small>Personal controls</small>
                    <h1>Settings</h1>
                    <p>
                        Manage your profile, notifications, security, and
                        integrations.
                    </p>
                </div>
            </div>
            <SettingsNavigation />
            <div className="settings-content">{children}</div>
        </main>
    );
}
