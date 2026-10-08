// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { SettingsNavigation } from "../src/components/settings-navigation";
import { NotificationPreferences } from "../src/components/preference-workspace";
import { TimezoneSettings } from "../src/components/timezone-settings";
import { SignInMethods } from "../src/components/sign-in-methods";
import { SecurityWorkspace } from "../src/components/security-workspace";
import { signInMethods } from "../src/features/auth/methods";

const mocks = vi.hoisted(() => ({
    path: "/settings/profile",
    replace: vi.fn(),
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    listSessions: vi.fn(),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
    signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
    usePathname: () => mocks.path,
    useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("../src/lib/auth-client", () => ({ authClient: mocks }));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
});
const preferences = {
    emailEnabled: false,
    inAppEnabled: true,
    weeklySummaryEnabled: false,
    maintenanceReminderDays: 5,
    warrantyReminderDays: 12,
    documentExpiryReminderDays: 20,
    timezone: "America/Chicago",
};
const providers = [{ id: "google", label: "Google", enabled: true }];
const password = {
    providerId: "credential",
    accountId: "user",
    hasPassword: true,
};
const google = {
    providerId: "google",
    accountId: "google-id",
    hasPassword: false,
};
function mockPreferences() {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) =>
        Response.json({
            preferences:
                options?.method === "PATCH"
                    ? { ...preferences, ...JSON.parse(String(options.body)) }
                    : preferences,
        }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
}
async function renderMethods(
    accounts = [password],
    url = "/settings/security",
) {
    window.history.replaceState({}, "", url);
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            Response.json({
                email: "user@example.com",
                methods: signInMethods(accounts, providers),
            }),
        ),
    );
    await act(async () => {
        render(createElement(SignInMethods));
    });
}
describe("Settings section navigation and independent saves", () => {
    it.each(["profile", "notifications", "security", "integrations"])(
        "uses real links and marks %s active",
        (section) => {
            mocks.path = `/settings/${section}`;
            render(createElement(SettingsNavigation));
            const links = screen.getAllByRole("link");
            expect(links).toHaveLength(4);
            expect(
                links.filter(
                    (link) => link.getAttribute("aria-current") === "page",
                ),
            ).toHaveLength(1);
            expect(
                links
                    .find((link) => link.getAttribute("aria-current"))
                    ?.getAttribute("href"),
            ).toBe(mocks.path);
            expect(screen.queryByRole("tab")).toBeNull();
        },
    );
    it("loads and saves timezone without submitting notification fields", async () => {
        const fetch = mockPreferences();
        await act(async () => {
            render(createElement(TimezoneSettings));
        });
        expect(
            (screen.getByLabelText("Timezone") as HTMLInputElement).value,
        ).toBe(preferences.timezone);
        fireEvent.change(screen.getByLabelText("Timezone"), {
            target: { value: "America/New_York" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));
        await screen.findByText("Preferences saved.");
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "PATCH",
                    )![1]!.body,
                ),
            ),
        ).toEqual({ timezone: "America/New_York" });
    });
    it("loads reminders and saves their fields without timezone", async () => {
        const fetch = mockPreferences();
        await act(async () => {
            render(createElement(NotificationPreferences));
        });
        expect(
            (screen.getByLabelText("Email reminders") as HTMLInputElement)
                .checked,
        ).toBe(false);
        expect(
            (screen.getByLabelText("Weekly summary") as HTMLInputElement)
                .checked,
        ).toBe(false);
        expect(
            (
                screen.getByLabelText(
                    "Maintenance notice (days)",
                ) as HTMLInputElement
            ).value,
        ).toBe("5");
        expect(screen.queryByLabelText("Timezone")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Save reminders" }));
        await screen.findByText("Preferences saved.");
        const reminders = Object.fromEntries(
            Object.entries(preferences).filter(([key]) => key !== "timezone"),
        );
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "PATCH",
                    )![1]!.body,
                ),
            ),
        ).toEqual(reminders);
    });
    it("shows a load failure instead of editable fallback values", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({}, { status: 500 })),
        );
        await act(async () => {
            render(createElement(TimezoneSettings));
        });
        expect(screen.getByRole("alert").textContent).toContain(
            "Could not load",
        );
        expect(screen.queryByLabelText("Timezone")).toBeNull();
    });
});
describe("sign-in method controls", () => {
    it("shows a connected credential and initiates supported explicit linking", async () => {
        mocks.linkSocial.mockResolvedValue({
            data: { redirect: true },
            error: null,
        });
        await renderMethods();
        expect(screen.getByText("Email & password")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
        await waitFor(() =>
            expect(mocks.linkSocial).toHaveBeenCalledWith({
                provider: "google",
                callbackURL: "/settings/security?linked=google",
                errorCallbackURL: "/settings/security?link_error=1",
            }),
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Connect Google",
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });
    it("shows successful return only when the server confirms the link", async () => {
        await renderMethods(
            [password, google],
            "/settings/security?linked=google",
        );
        expect(screen.getByRole("status").textContent).toContain(
            "Google connected",
        );
        expect(mocks.replace).toHaveBeenCalledWith("/settings/security", {
            scroll: false,
        });
    });
    it("does not trust a success parameter when no linked account exists", async () => {
        await renderMethods([password], "/settings/security?linked=google");
        expect(screen.getByRole("alert").textContent).toContain(
            "could not be confirmed",
        );
    });
    it("handles cancelled and failed OAuth callbacks", async () => {
        await renderMethods(
            [password],
            "/settings/security?link_error=1&error=access_denied",
        );
        expect(screen.getByRole("alert").textContent).toContain("cancelled");
    });
    it("blocks disconnecting the only usable method and offers password setup", async () => {
        await renderMethods([google]);
        expect(
            (
                screen.getByRole("button", {
                    name: "Disconnect Google",
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen
                .getByRole("link", { name: "Set a password" })
                .getAttribute("href"),
        ).toBe("/forgot-password");
    });
    it("uses the installed unlink API with the provider account identifier", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        mocks.unlinkAccount.mockResolvedValue({
            data: { status: true },
            error: null,
        });
        await renderMethods([password, google]);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    email: "user@example.com",
                    methods: signInMethods([password], providers),
                }),
            ),
        );
        fireEvent.click(
            screen.getByRole("button", { name: "Disconnect Google" }),
        );
        await screen.findByText("Google disconnected.");
        expect(mocks.unlinkAccount).toHaveBeenCalledWith({
            providerId: "google",
            accountId: "google-id",
        });
        expect(
            screen.getByRole("button", { name: "Connect Google" }),
        ).toBeDefined();
    });
    it("maps link initiation errors without rendering raw provider messages", async () => {
        mocks.linkSocial.mockResolvedValue({
            error: { message: "raw secret error" },
        });
        await renderMethods();
        fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
        expect((await screen.findByRole("alert")).textContent).toContain(
            "Could not start",
        );
        expect(screen.queryByText("raw secret error")).toBeNull();
    });
    it("preserves password changes and captures the form before asynchronous work", async () => {
        mocks.listSessions.mockResolvedValue({ data: [], error: null });
        mocks.changePassword.mockResolvedValue({
            data: { status: true },
            error: null,
        });
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    email: "user@example.com",
                    methods: signInMethods([password], providers),
                }),
            ),
        );
        await act(async () => {
            render(createElement(SecurityWorkspace));
        });
        fireEvent.change(screen.getByLabelText("Current password"), {
            target: { value: "old-password" },
        });
        fireEvent.change(screen.getByLabelText("New password"), {
            target: { value: "new-password-long" },
        });
        fireEvent.click(
            screen.getByRole("button", { name: "Update password" }),
        );
        await screen.findByText(
            "Password changed. Other sessions were revoked.",
        );
        expect(mocks.changePassword).toHaveBeenCalledWith({
            currentPassword: "old-password",
            newPassword: "new-password-long",
            revokeOtherSessions: true,
        });
        expect(
            (screen.getByLabelText("Current password") as HTMLInputElement)
                .value,
        ).toBe("");
        expect(screen.queryByLabelText("Display name")).toBeNull();
        expect(
            screen
                .getByRole("link", { name: "Export JSON" })
                .getAttribute("href"),
        ).toBe("/api/export/account");
    });
});
