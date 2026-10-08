import { describe, expect, it } from "vitest";
import {
    canUnlinkAccount,
    linkingFeedback,
    signInMethods,
} from "../src/features/auth/methods";

const providers = [{ id: "google", label: "Google", enabled: true }];
const password = {
    providerId: "credential",
    accountId: "user",
    hasPassword: true,
};
const google = {
    providerId: "google",
    accountId: "google-user",
    hasPassword: false,
};
describe("sign-in methods and unlink safety", () => {
    it("shows password and configured providers without leaking account secrets", () => {
        const methods = signInMethods([password], providers);
        expect(methods[0]).toMatchObject({
            connected: true,
            usable: true,
            canDisconnect: false,
        });
        expect(methods[1]).toMatchObject({
            label: "Google",
            connected: false,
            enabled: true,
        });
        expect(JSON.stringify(methods)).not.toMatch(
            /passwordHash|accessToken|refreshToken|idToken|hasPassword/,
        );
    });
    it("supports provider metadata generically", () => {
        expect(
            signInMethods(
                [],
                [
                    ...providers,
                    { id: "another", label: "Another provider", enabled: true },
                ],
            ),
        ).toHaveLength(3);
    });
    it("allows Google unlink only with another usable method", () => {
        expect(
            canUnlinkAccount(
                [password, google],
                providers,
                "google",
                google.accountId,
            ),
        ).toBe(true);
        expect(
            canUnlinkAccount([google], providers, "google", google.accountId),
        ).toBe(false);
        expect(signInMethods([google], providers)[1].canDisconnect).toBe(false);
    });
    it("does not count an empty credential record or a disabled provider", () => {
        expect(
            canUnlinkAccount(
                [{ ...password, hasPassword: false }, google],
                providers,
                "google",
            ),
        ).toBe(false);
        expect(
            canUnlinkAccount(
                [password, google],
                [{ ...providers[0], enabled: false }],
                "credential",
            ),
        ).toBe(false);
        expect(
            canUnlinkAccount(
                [
                    google,
                    {
                        providerId: "legacy",
                        accountId: "old",
                        hasPassword: false,
                    },
                ],
                providers,
                "google",
            ),
        ).toBe(false);
    });
    it("does not unlink another account, and handles multiple accounts for a provider", () => {
        expect(
            canUnlinkAccount(
                [password, google],
                providers,
                "google",
                "someone-else",
            ),
        ).toBe(false);
        const accounts = [google, { ...google, accountId: "second" }];
        expect(canUnlinkAccount(accounts, providers, "google", "second")).toBe(
            true,
        );
        expect(
            signInMethods(accounts, providers).filter(
                (method) => method.canDisconnect,
            ),
        ).toHaveLength(2);
    });
    it("maps cancellation, email mismatch and provider errors to safe messages", () => {
        expect(linkingFeedback("access_denied")).toContain("cancelled");
        expect(linkingFeedback("email_doesn't_match")).toContain("same email");
        expect(linkingFeedback("state_mismatch")).toContain("expired");
        expect(
            linkingFeedback("account_already_linked_to_different_user"),
        ).toContain("another Homi user");
        expect(linkingFeedback("secret-provider-error-message")).not.toContain(
            "secret",
        );
    });
});
