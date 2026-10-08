import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { preferencePatchInput } from "@/src/features/preferences/validation";

export async function GET(request: Request) {
    const id = requestId(request);
    try {
        const session = await requireVerifiedUser();
        const [preferences] = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, session.user.id))
            .limit(1);
        return Response.json({
            preferences: preferences ?? null,
            requestId: id,
        });
    } catch (error) {
        return errorResponse(error, id);
    }
}

export async function PATCH(request: Request) {
    const id = requestId(request);
    try {
        const session = await requireVerifiedUser();
        const input = preferencePatchInput.parse(await request.json());
        const [preferences] = await db
            .insert(notificationPreferences)
            .values({ ...input, userId: session.user.id })
            .onConflictDoUpdate({
                target: notificationPreferences.userId,
                set: { ...input, updatedAt: new Date() },
            })
            .returning();
        return Response.json({ preferences, requestId: id });
    } catch (error) {
        return errorResponse(error, id);
    }
}
