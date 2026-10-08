import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

vi.mock("server-only", () => ({}));
const run = process.env.RUN_INTEGRATION_TESTS === "true";
const baseURL = "http://localhost:3001";

describe.runIf(run)("Better Auth sign-in method management", () => {
    let database: typeof import("../../db");
    let methods: typeof import("../../src/server/auth/methods");
    let guard: typeof import("../../src/server/auth/unlink");
    let auth: ReturnType<typeof betterAuth>;
    let identity = { id: "", email: "" };
    let verificationToken = "";
    let resetToken = "";
    beforeAll(async () => {
        const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
        if (!url)
            throw new Error(
                "Configure TEST_DATABASE_URL or DATABASE_URL for database-backed auth tests.",
            );
        vi.stubEnv("DATABASE_URL", url);
        vi.stubEnv("GOOGLE_CLIENT_ID", "settings-test-client");
        vi.stubEnv("GOOGLE_CLIENT_SECRET", "settings-test-secret");
        database = await import("../../db");
        const schema = await import("../../db/schema");
        methods = await import("../../src/server/auth/methods");
        guard = await import("../../src/server/auth/unlink");
        const options: BetterAuthOptions = {
            baseURL,
            secret: "settings-integration-secret-long-enough",
            trustedOrigins: [baseURL],
            database: drizzleAdapter(database.db, {
                provider: "pg",
                schema: {
                    user: schema.user,
                    session: schema.session,
                    account: schema.account,
                    verification: schema.verification,
                },
            }),
            advanced: {
                database: { generateId: () => crypto.randomUUID() },
                cookiePrefix: "settings-tests",
            },
            emailAndPassword: {
                enabled: true,
                minPasswordLength: 10,
                revokeSessionsOnPasswordReset: true,
                sendResetPassword: async ({ token }) => {
                    resetToken = token;
                },
            },
            emailVerification: {
                sendOnSignUp: true,
                sendVerificationEmail: async ({ token }) => {
                    verificationToken = token;
                },
            },
            account: {
                accountLinking: { enabled: true, allowUnlinkingAll: false },
            },
            // Controlled provider responses exercise Better Auth without real Google identities.
            socialProviders: {
                google: {
                    clientId: "settings-test-client",
                    clientSecret: "settings-test-secret",
                    verifyIdToken: async () => true,
                    getUserInfo: async () => ({
                        user: {
                            ...identity,
                            name: "Settings auth test",
                            emailVerified: true,
                        },
                        data: {
                            sub: identity.id,
                            email: identity.email,
                            email_verified: true,
                        },
                    }),
                },
            },
            rateLimit: { enabled: false },
        };
        auth = betterAuth(options);
    });
    afterAll(async () => {
        const lockPool = (
            globalThis as unknown as {
                homiAuthLockPool?: { end(): Promise<void> };
            }
        ).homiAuthLockPool;
        await lockPool?.end();
        await database?.pool.end();
        vi.unstubAllEnvs();
    });
    function cookie(response: Response) {
        return response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; ");
    }
    async function passwordUser() {
        const email = `settings-${crypto.randomUUID()}@example.test`;
        const response = await auth.api.signUpEmail({
            body: {
                name: "Settings test",
                email,
                password: "SettingsTest!2026",
            },
            asResponse: true,
        });
        expect(response.status).toBe(200);
        const user = (await response.json()).user;
        await auth.api.verifyEmail({ query: { token: verificationToken } });
        return {
            id: user.id as string,
            email,
            headers: new Headers({ cookie: cookie(response), origin: baseURL }),
        };
    }
    async function link(user: Awaited<ReturnType<typeof passwordUser>>) {
        identity = { id: crypto.randomUUID(), email: user.email };
        await auth.api.linkSocialAccount({
            headers: user.headers,
            body: {
                provider: "google",
                idToken: { token: "controlled-provider-token" },
                callbackURL: "/settings/security",
            },
        });
    }
    function unlinkRequest(
        headers: Headers,
        providerId: string,
        accountId?: string,
    ) {
        const requestHeaders = new Headers(headers);
        requestHeaders.set("content-type", "application/json");
        return new Request(`${baseURL}/api/auth/unlink-account`, {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({ providerId, accountId }),
        });
    }
    it("explicitly links Google to the existing user, lists safe metadata and unlinks through Better Auth", async () => {
        const user = await passwordUser();
        await link(user);
        const accounts = await methods.linkedAccounts(user.id);
        expect(accounts.map((account) => account.providerId).sort()).toEqual([
            "credential",
            "google",
        ]);
        const summary = await methods.getSignInMethods(user.id);
        expect(
            summary.find((method) => method.providerId === "google"),
        ).toMatchObject({ connected: true, canDisconnect: true });
        expect(JSON.stringify(summary)).not.toMatch(
            /accessToken|refreshToken|idToken|passwordHash/,
        );
        const account = accounts.find(
            (account) => account.providerId === "google",
        )!;
        const response = await guard.withSafeAccountUnlink(
            unlinkRequest(user.headers, "google", account.accountId),
            user.id,
            auth.handler,
        );
        expect(response.status).toBe(200);
        expect(
            (await methods.linkedAccounts(user.id)).map(
                (account) => account.providerId,
            ),
        ).toEqual(["credential"]);
        expect(
            (await auth.api.getSession({ headers: user.headers }))?.user.id,
        ).toBe(user.id);
    });
    it("preserves implicit verified-email linking without creating another Homi user", async () => {
        const user = await passwordUser();
        identity = { id: crypto.randomUUID(), email: user.email };
        const response = await auth.api.signInSocial({
            body: {
                provider: "google",
                idToken: { token: "controlled-provider-token" },
            },
            asResponse: true,
        });
        expect(response.status).toBe(200);
        const current = await auth.api.getSession({
            headers: new Headers({ cookie: cookie(response) }),
        });
        expect(current?.user.id).toBe(user.id);
        expect(await methods.linkedAccounts(user.id)).toHaveLength(2);
    });
    it("blocks the final account at both the app guard and Better Auth endpoint", async () => {
        const user = await passwordUser();
        const request = unlinkRequest(user.headers, "credential");
        const response = await guard.withSafeAccountUnlink(
            request,
            user.id,
            auth.handler,
        );
        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe("LAST_USABLE_SIGN_IN_METHOD");
        expect(
            (await auth.handler(unlinkRequest(user.headers, "credential")))
                .status,
        ).toBe(400);
        expect(await methods.linkedAccounts(user.id)).toHaveLength(1);
    });
    it("serializes concurrent unlink requests so one usable method remains", async () => {
        const user = await passwordUser();
        await link(user);
        const responses = await Promise.all(
            ["google", "credential"].map((provider) =>
                guard.withSafeAccountUnlink(
                    unlinkRequest(user.headers, provider),
                    user.id,
                    auth.handler,
                ),
            ),
        );
        expect(responses.map((response) => response.status).sort()).toEqual([
            200, 400,
        ]);
        expect(await methods.linkedAccounts(user.id)).toHaveLength(1);
        expect(
            (await methods.getSignInMethods(user.id)).some(
                (method) => method.usable,
            ),
        ).toBe(true);
    });
    it("protects a Google-only user until the existing password-reset flow adds credentials", async () => {
        identity = {
            id: crypto.randomUUID(),
            email: `social-${crypto.randomUUID()}@example.test`,
        };
        const response = await auth.api.signInSocial({
            body: {
                provider: "google",
                idToken: { token: "controlled-provider-token" },
            },
            asResponse: true,
        });
        expect(response.status).toBe(200);
        const headers = new Headers({
            cookie: cookie(response),
            origin: baseURL,
        });
        const current = (await auth.api.getSession({ headers }))!;
        expect(
            (await methods.getSignInMethods(current.user.id)).find(
                (method) => method.providerId === "google",
            )?.canDisconnect,
        ).toBe(false);
        expect(
            (
                await guard.withSafeAccountUnlink(
                    unlinkRequest(headers, "google"),
                    current.user.id,
                    auth.handler,
                )
            ).status,
        ).toBe(400);
        await auth.api.requestPasswordReset({
            body: { email: identity.email },
        });
        await auth.api.resetPassword({
            body: { token: resetToken, newPassword: "SettingsTest!2026" },
        });
        expect(
            (await methods.getSignInMethods(current.user.id)).find(
                (method) => method.providerId === "credential",
            )?.connected,
        ).toBe(true);
        expect(await auth.api.getSession({ headers })).toBeNull();
        const signedIn = await auth.api.signInEmail({
            body: { email: identity.email, password: "SettingsTest!2026" },
            asResponse: true,
        });
        expect(signedIn.status).toBe(200);
        const freshHeaders = new Headers({
            cookie: cookie(signedIn),
            origin: baseURL,
        });
        expect(
            (
                await guard.withSafeAccountUnlink(
                    unlinkRequest(freshHeaders, "google"),
                    current.user.id,
                    auth.handler,
                )
            ).status,
        ).toBe(200);
    });
});
