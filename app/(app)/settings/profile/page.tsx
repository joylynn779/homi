import { ProfileSettings } from "@/src/components/profile-settings";
import { TimezoneSettings } from "@/src/components/timezone-settings";

export const metadata = { title: "Profile settings" };
export default function Page() {
    return (
        <>
            <ProfileSettings />
            <TimezoneSettings />
        </>
    );
}
