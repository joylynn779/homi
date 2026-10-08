import "server-only";
import { Pool } from "pg";
import { pool } from "@/db";
import { canUnlinkAccount } from "@/src/features/auth/methods";
import { configuredSignInProviders, linkedAccounts } from "./methods";

// Keep lock connections separate so waiting unlink requests cannot exhaust
// the application's pool needed by Better Auth itself.
const globalForLocks = globalThis as unknown as { homiAuthLockPool?: Pool };
const lockPool = (globalForLocks.homiAuthLockPool ??= new Pool({
    ...pool.options,
    max: 2,
}));

export async function withSafeAccountUnlink(
    request: Request,
    userId: string,
    handler: (request: Request) => Promise<Response>,
) {
    const body = (await request
        .clone()
        .json()
        .catch(() => null)) as {
        providerId?: string;
        accountId?: string;
    } | null;
    if (
        !body ||
        typeof body.providerId !== "string" ||
        (body.accountId !== undefined && typeof body.accountId !== "string")
    )
        return handler(request);
    const client = await lockPool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [`homi:auth-unlink:${userId}`],
        );
        if (
            !canUnlinkAccount(
                await linkedAccounts(userId),
                configuredSignInProviders(),
                body.providerId,
                body.accountId,
            )
        ) {
            return Response.json(
                {
                    code: "LAST_USABLE_SIGN_IN_METHOD",
                    message:
                        "Keep another usable sign-in method connected before disconnecting this account.",
                },
                { status: 400 },
            );
        }
        // Better Auth still authenticates, checks freshness and origin, and owns deletion.
        return await handler(request);
    } finally {
        try {
            await client.query("ROLLBACK");
        } finally {
            client.release();
        }
    }
}
