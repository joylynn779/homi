// @vitest-environment jsdom
import { createElement } from "react";
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PushNotificationSettings } from "../src/components/push-notification-settings";
const originalWorker = Object.getOwnPropertyDescriptor(
    navigator,
    "serviceWorker",
);
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (originalWorker)
        Object.defineProperty(navigator, "serviceWorker", originalWorker);
    else Reflect.deleteProperty(navigator, "serviceWorker");
});
async function setup(permission = "granted") {
    let connected = false;
    const json = {
        endpoint: "https://push.example.test/device",
        keys: { p256dh: "test-public-key", auth: "test-auth-key" },
    };
    const subscription = {
        endpoint: json.endpoint,
        toJSON: () => json,
        unsubscribe: vi.fn(async () => {
            connected = false;
            return true;
        }),
    };
    const registration = {
        pushManager: {
            getSubscription: vi.fn(async () =>
                connected ? subscription : null,
            ),
            subscribe: vi.fn(async () => {
                connected = true;
                return subscription;
            }),
        },
    };
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
            register: vi.fn(async () => registration),
            ready: Promise.resolve(registration),
        },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", {
        requestPermission: vi.fn(async () => permission),
    });
    const fetch = vi.fn(async (_url: string, options?: RequestInit) =>
        Response.json(
            options?.method
                ? {}
                : {
                      configured: true,
                      publicKey: "AQID",
                      subscriptionCount: connected ? 1 : 0,
                  },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    render(createElement(PushNotificationSettings));
    await waitFor(() =>
        expect(
            (
                screen.getByRole("button", {
                    name: "Enable on this device",
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false),
    );
    return { fetch, subscription, registration, json };
}
describe("Notification settings push controls", () => {
    it("still subscribes and removes this browser using the existing API", async () => {
        const { fetch, subscription, registration, json } = await setup();
        fireEvent.click(
            screen.getByRole("button", { name: "Enable on this device" }),
        );
        await screen.findByText("This device is connected");
        expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "POST",
                    )![1]!.body,
                ),
            ),
        ).toEqual(json);
        fireEvent.click(
            screen.getByRole("button", { name: "Disable this device" }),
        );
        await screen.findByText("This device is off");
        expect(subscription.unsubscribe).toHaveBeenCalledOnce();
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "DELETE",
                    )![1]!.body,
                ),
            ),
        ).toEqual({ endpoint: json.endpoint });
    });
    it("keeps the device off when notification permission is denied", async () => {
        const { fetch } = await setup("denied");
        fireEvent.click(
            screen.getByRole("button", { name: "Enable on this device" }),
        );
        await screen.findByText(
            "Notification permission was not granted for this browser.",
        );
        expect(
            fetch.mock.calls.some(([, options]) => options?.method === "POST"),
        ).toBe(false);
        expect(screen.getByText("This device is off")).toBeDefined();
    });
});
