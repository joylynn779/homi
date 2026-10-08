import { NotificationPreferences } from "@/src/components/preference-workspace";
import { PushNotificationSettings } from "@/src/components/push-notification-settings";

export const metadata = { title: "Notification settings" };
export default function Page() {
    return (
        <>
            <NotificationPreferences />
            <PushNotificationSettings />
        </>
    );
}
