import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";
import { getEnv } from "@/src/server/env";
import { signInMethods } from "@/src/features/auth/methods";

export function configuredSignInProviders() {
    const env = getEnv();
    return [
        {
            id: "google",
            label: "Google",
            enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        },
    ];
}

export async function linkedAccounts(userId: string) {
    return db
        .select({
            providerId: account.providerId,
            accountId: account.accountId,
            hasPassword: sql<boolean>`${account.password} is not null and ${account.password} <> ''`,
        })
        .from(account)
        .where(eq(account.userId, userId));
}

export async function getSignInMethods(userId: string) {
    return signInMethods(
        await linkedAccounts(userId),
        configuredSignInProviders(),
    );
}
