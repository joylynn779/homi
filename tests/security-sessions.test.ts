// @vitest-environment jsdom
import { createElement } from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityWorkspace } from "../src/components/security-workspace";
const client = vi.hoisted(() => ({
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../src/lib/auth-client", () => ({ authClient: client }));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
});
async function setup() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
            Response.json({
                email: "user@example.com",
                methods: [
                    {
                        providerId: "credential",
                        label: "Email & password",
                        connected: true,
                        enabled: true,
                        usable: true,
                        canDisconnect: false,
                    },
                ],
            }),
        ),
    );
    await act(async () => {
        render(createElement(SecurityWorkspace));
    });
}
describe("Settings session management", () => {
    it("revokes a session through Better Auth and refreshes the list", async () => {
        client.listSessions
            .mockResolvedValueOnce({
                data: [
                    {
                        id: "session",
                        token: "session-token",
                        userAgent: "Test browser",
                        ipAddress: "IP",
                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                    },
                ],
            })
            .mockResolvedValue({ data: [] });
        client.revokeSession.mockResolvedValue({ error: null });
        await setup();
        fireEvent.click(screen.getByRole("button", { name: "Revoke session" }));
        await screen.findByText("Session revoked.");
        expect(client.revokeSession).toHaveBeenCalledWith({
            token: "session-token",
        });
        expect(screen.queryByText("Test browser")).toBeNull();
    });
    it("retains the revoke-other-sessions control", async () => {
        client.listSessions.mockResolvedValue({ data: [] });
        client.revokeOtherSessions.mockResolvedValue({ error: null });
        await setup();
        fireEvent.click(
            screen.getByRole("button", { name: "Revoke all other sessions" }),
        );
        await screen.findByText("Other sessions revoked.");
        expect(client.revokeOtherSessions).toHaveBeenCalledOnce();
    });
    it("reports errors without claiming a session was revoked", async () => {
        client.listSessions.mockResolvedValue({ data: [] });
        client.revokeOtherSessions.mockResolvedValue({
            error: { message: "raw auth detail" },
        });
        await setup();
        fireEvent.click(
            screen.getByRole("button", { name: "Revoke all other sessions" }),
        );
        await screen.findByText("Could not revoke sessions. Please try again.");
        expect(screen.queryByText("Other sessions revoked.")).toBeNull();
        expect(screen.queryByText("raw auth detail")).toBeNull();
    });
});
