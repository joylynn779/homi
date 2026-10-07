// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { HomeSwitcher } from "../src/components/home-switcher";
import { HomeWorkspace } from "../src/components/home-workspace";
import { AcceptInvitation } from "../src/components/accept-invitation";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const first = {
    id: "first",
    name: "First home",
    type: "HOUSE",
    city: "Portland",
    role: "OWNER",
    timezone: "UTC",
};
const second = { ...first, id: "second", name: "Second home", city: "Seattle" };

beforeEach(() => {
    vi.clearAllMocks();
    // Radix scrolls keyboard-highlighted items into view in real browsers.
    Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function switcher(
    homes = [first, second],
    selectedHomeId = first.id,
    onSelect = vi.fn(async () => {}),
) {
    return createElement(HomeSwitcher, {
        homes,
        selectedHomeId,
        locale: "en",
        onSelect,
    });
}

async function openMenu() {
    fireEvent.keyDown(
        screen.getByRole("button", { name: "Global selected home" }),
        { key: "Enter" },
    );
    await screen.findByRole("menu");
}

describe("home selector", () => {
    it("shows the empty state only without accessible homes", () => {
        const view = render(switcher([], "removed"));
        const trigger = screen.getByRole("button", {
            name: "Global selected home",
        });
        expect(trigger.textContent).toContain("No home yet");
        expect(trigger.hasAttribute("disabled")).toBe(true);
        view.rerender(switcher([first], "removed"));
        expect(trigger.textContent).toContain(first.name);
        expect(trigger.hasAttribute("disabled")).toBe(false);
    });

    it("lists accessible homes and marks the valid saved selection", async () => {
        render(switcher([first, second], second.id));
        expect(
            screen.getByRole("button", { name: "Global selected home" })
                .textContent,
        ).toContain(second.name);
        await openMenu();
        expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
        expect(
            screen
                .getByRole("menuitemradio", { name: /Second home/ })
                .getAttribute("aria-checked"),
        ).toBe("true");
        expect(
            screen
                .getByRole("menuitemradio", { name: /First home/ })
                .getAttribute("aria-checked"),
        ).toBe("false");
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("switches to the chosen home and reflects refreshed props", async () => {
        const onSelect = vi.fn(async () => {});
        const view = render(switcher([first, second], first.id, onSelect));
        await openMenu();
        fireEvent.click(
            screen.getByRole("menuitemradio", { name: /Second home/ }),
        );
        await waitFor(() => expect(onSelect).toHaveBeenCalledWith(second.id));
        view.rerender(switcher([first, second], second.id, onSelect));
        expect(
            screen.getByRole("button", { name: "Global selected home" })
                .textContent,
        ).toContain(second.name);
    });

    it("retains the selection and reports a failed switch", async () => {
        render(
            switcher(
                [first, second],
                first.id,
                vi.fn(async () => {
                    throw new Error("Home not found.");
                }),
            ),
        );
        await openMenu();
        fireEvent.click(
            screen.getByRole("menuitemradio", { name: /Second home/ }),
        );
        expect((await screen.findByRole("alert")).textContent).toBe(
            "Home not found.",
        );
        expect(
            screen.getByRole("button", { name: "Global selected home" })
                .textContent,
        ).toContain(first.name);
    });
});

describe("home state refresh", () => {
    it("keeps rooms and makes no requests when selecting the active home", async () => {
        const room = {
            id: "kitchen",
            name: "Existing kitchen",
            icon: "cooking-pot",
        };
        const fetchMock = vi.fn(async (url: string) =>
            Response.json(
                url === "/api/homes"
                    ? { homes: [first, second] }
                    : { rooms: [room] },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);
        render(createElement(HomeWorkspace));
        await screen.findByText(room.name);
        const requestCount = fetchMock.mock.calls.length;
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /First home/ }));
        });
        expect(screen.getByText(room.name)).toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(requestCount);
        expect(router.refresh).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: /First home/ }).parentElement
                ?.textContent,
        ).toContain("Selected");
    });

    it("preserves an open room edit when selecting the active home", async () => {
        const room = {
            id: "kitchen",
            name: "Existing kitchen",
            icon: "Cooking",
        };
        const fetchMock = vi.fn(async (url: string) =>
            Response.json(
                url === "/api/homes"
                    ? { homes: [first, second] }
                    : { rooms: [room] },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);
        render(createElement(HomeWorkspace));
        fireEvent.click(
            await screen.findByRole("button", {
                name: "Edit Existing kitchen",
            }),
        );
        const nameInput = screen.getByDisplayValue(
            room.name,
        ) as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: "Unsaved room name" } });
        const requestCount = fetchMock.mock.calls.length;
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /First home/ }));
        });
        expect(screen.getByDisplayValue("Unsaved room name")).toBe(nameInput);
        expect(fetchMock).toHaveBeenCalledTimes(requestCount);
        expect(router.refresh).not.toHaveBeenCalled();
    });

    it("refreshes the layout immediately after creating the first home", async () => {
        let created = false;
        const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
            if (url === "/api/homes" && options?.method === "POST") {
                created = true;
                return Response.json({ home: first }, { status: 201 });
            }
            return Response.json(
                url === "/api/homes"
                    ? { homes: created ? [first] : [] }
                    : { rooms: [] },
            );
        });
        vi.stubGlobal("fetch", fetchMock);
        render(createElement(HomeWorkspace));
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith("/api/homes"),
        );
        fireEvent.click(screen.getByRole("button", { name: "Add home" }));
        fireEvent.change(screen.getByLabelText("Home name"), {
            target: { value: first.name },
        });
        fireEvent.submit(
            screen
                .getByRole("button", { name: "Create home" })
                .closest("form")!,
        );
        await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
        expect(
            screen.getByRole("button", { name: /First home/ }),
        ).toBeDefined();
    });

    it("persists a workspace selection before refreshing the sidebar", async () => {
        const fetchMock = vi.fn(async (url: string) =>
            Response.json(
                url === "/api/homes"
                    ? { homes: [first, second] }
                    : { rooms: [] },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);
        render(createElement(HomeWorkspace));
        fireEvent.click(
            await screen.findByRole("button", { name: /Second home/ }),
        );
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/homes/selected",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ homeId: second.id }),
                }),
            ),
        );
        await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    });

    it("keeps the workspace selection when access to another home is denied", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string) => {
                if (url === "/api/homes/selected")
                    return Response.json(
                        { error: { message: "Home not found." } },
                        { status: 404 },
                    );
                return Response.json(
                    url === "/api/homes"
                        ? { homes: [first, second] }
                        : { rooms: [] },
                );
            }),
        );
        render(createElement(HomeWorkspace));
        fireEvent.click(
            await screen.findByRole("button", { name: /Second home/ }),
        );
        expect((await screen.findByRole("alert")).textContent).toContain(
            "Home not found.",
        );
        expect(
            screen.getByRole("button", { name: /First home/ }).parentElement
                ?.textContent,
        ).toContain("Selected");
        expect(router.refresh).not.toHaveBeenCalled();
    });

    it("refreshes cached application state after joining a home", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ homeId: second.id })),
        );
        render(
            createElement(AcceptInvitation, { token: "test-invitation-token" }),
        );
        fireEvent.click(screen.getByRole("button", { name: "Join household" }));
        await waitFor(() =>
            expect(router.push).toHaveBeenCalledWith("/dashboard"),
        );
        expect(router.refresh).toHaveBeenCalledOnce();
    });
});
