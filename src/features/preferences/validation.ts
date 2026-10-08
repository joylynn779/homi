import { z } from "zod";

export const preferencePatchInput = z
    .object({
        emailEnabled: z.boolean(),
        inAppEnabled: z.boolean(),
        maintenanceReminderDays: z.number().int().min(0).max(90),
        warrantyReminderDays: z.number().int().min(0).max(365),
        documentExpiryReminderDays: z.number().int().min(0).max(365),
        weeklySummaryEnabled: z.boolean(),
        timezone: z.string().trim().min(1).max(80),
    })
    .partial()
    .refine(
        (input) => Object.keys(input).length > 0,
        "Provide at least one preference to update.",
    );
export type PreferencePatch = z.infer<typeof preferencePatchInput>;
