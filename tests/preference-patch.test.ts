import { describe, expect, it } from "vitest";
import { preferencePatchInput } from "../src/features/preferences/validation";
describe("partial preference validation", () => {
    it("keeps timezone saves independent of notification fields", () => {
        expect(
            preferencePatchInput.parse({ timezone: " America/Chicago " }),
        ).toEqual({ timezone: "America/Chicago" });
    });
    it("does not inject timezone or defaults into notification saves", () => {
        expect(
            preferencePatchInput.parse({
                emailEnabled: false,
                maintenanceReminderDays: 0,
            }),
        ).toEqual({ emailEnabled: false, maintenanceReminderDays: 0 });
    });
    it("keeps complete older client submissions compatible", () => {
        const input = {
            emailEnabled: true,
            inAppEnabled: true,
            weeklySummaryEnabled: false,
            maintenanceReminderDays: 7,
            warrantyReminderDays: 30,
            documentExpiryReminderDays: 30,
            timezone: "UTC",
        };
        expect(preferencePatchInput.parse(input)).toEqual(input);
    });
    it.each([
        {},
        { unrelated: true },
        { emailEnabled: null },
        { timezone: "" },
        { maintenanceReminderDays: 91 },
        { warrantyReminderDays: -1 },
        { documentExpiryReminderDays: 1.5 },
    ])("rejects invalid patch %j", (input) => {
        expect(preferencePatchInput.safeParse(input).success).toBe(false);
    });
});
