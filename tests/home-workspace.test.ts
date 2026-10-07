// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react";
import { HomeWorkspace } from "../src/components/home-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

async function setup(fail = false, role = "OWNER") {
    const homes = [
        { id: "home", name: "My home", type: "HOUSE", timezone: "UTC", role },
    ];
    const rooms = [
        {
            id: "room",
            name: "Downstairs Bedroom",
            floor: "Ground floor",
            icon: "bed-double",
        },
    ];
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
            if (fail)
                return Response.json(
                    { error: { message: "Please check the name." } },
                    { status: 400 },
                );
            const body = JSON.parse(String(options.body));
            if (url === "/api/homes") {
                const home = { ...homes[0], ...body, id: "new-home" };
                homes.unshift(home);
                return Response.json({ home });
            }
            const room = { ...rooms[0], ...body, id: "new-room" };
            rooms.push(room);
            return Response.json({ room });
        }
        return Response.json(url === "/api/homes" ? { homes } : { rooms });
    });
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
        render(createElement(HomeWorkspace));
    });
    return fetch;
}

describe("Homes & Rooms creation panels", () => {
    it("starts with both creation forms hidden and preserves three row regions", async () => {
        await setup();
        expect(screen.queryByRole("form", { name: "Add home" })).toBeNull();
        expect(screen.queryByRole("form", { name: "Add room" })).toBeNull();
        const row = screen
            .getByText("Downstairs Bedroom")
            .closest(".home-room-row")!;
        expect(row.children).toHaveLength(3);
        expect(row.children[1].textContent).toContain("Ground floor");
        expect(
            within(row as HTMLElement).getByRole("button", {
                name: "Edit Downstairs Bedroom",
            }).parentElement,
        ).toBe(row.children[2]);
        expect(
            within(row as HTMLElement).getByRole("button", {
                name: "Archive Downstairs Bedroom",
            }).parentElement,
        ).toBe(row.children[2]);
    });

    it.each(["home", "room"])(
        "opens and cancels the Add %s form without submitting",
        async (kind) => {
            const fetch = await setup();
            const button = screen.getByRole("button", { name: `Add ${kind}` });
            expect(button.getAttribute("aria-expanded")).toBe("false");
            fireEvent.click(button);
            const form = screen.getByRole("form", { name: `Add ${kind}` });
            const name = within(form).getByLabelText(
                kind === "home" ? "Home name" : "Room name",
            );
            expect(document.activeElement).toBe(name);
            fireEvent.change(name, { target: { value: "Discard me" } });
            fireEvent.click(
                within(form).getByRole("button", { name: "Cancel" }),
            );
            expect(
                screen.queryByRole("form", { name: `Add ${kind}` }),
            ).toBeNull();
            expect(document.activeElement).toBe(button);
            expect(
                fetch.mock.calls.some(
                    ([, options]) => options?.method === "POST",
                ),
            ).toBe(false);
            fireEvent.click(button);
            expect(
                (
                    screen.getByLabelText(
                        kind === "home" ? "Home name" : "Room name",
                    ) as HTMLInputElement
                ).value,
            ).toBe("");
        },
    );

    it.each(["home", "room"])(
        "closes and resets Add %s only after successful creation",
        async (kind) => {
            await setup();
            const button = screen.getByRole("button", { name: `Add ${kind}` });
            fireEvent.click(button);
            const form = screen.getByRole("form", { name: `Add ${kind}` });
            fireEvent.change(
                within(form).getByLabelText(
                    kind === "home" ? "Home name" : "Room name",
                ),
                { target: { value: "New place" } },
            );
            if (kind === "room")
                fireEvent.click(
                    within(form).getByRole("radio", { name: "Laundry" }),
                );
            await act(async () => {
                fireEvent.submit(form);
            });
            expect(
                screen.queryByRole("form", { name: `Add ${kind}` }),
            ).toBeNull();
            expect(screen.getByText("New place")).toBeDefined();
            expect(document.activeElement).toBe(button);
            fireEvent.click(button);
            const reopened = screen.getByRole("form", { name: `Add ${kind}` });
            expect(
                (
                    within(reopened).getByLabelText(
                        kind === "home" ? "Home name" : "Room name",
                    ) as HTMLInputElement
                ).value,
            ).toBe("");
            if (kind === "room")
                expect(
                    (
                        within(reopened).getByRole("radio", {
                            name: "Default",
                        }) as HTMLInputElement
                    ).checked,
                ).toBe(true);
        },
    );

    it.each(["home", "room"])(
        "keeps the Add %s draft open on validation failure",
        async (kind) => {
            await setup(true);
            fireEvent.click(
                screen.getByRole("button", { name: `Add ${kind}` }),
            );
            const form = screen.getByRole("form", { name: `Add ${kind}` });
            const name = within(form).getByLabelText(
                kind === "home" ? "Home name" : "Room name",
            );
            fireEvent.change(name, { target: { value: "Draft" } });
            if (kind === "room")
                fireEvent.click(
                    within(form).getByRole("radio", { name: "Bedroom" }),
                );
            await act(async () => {
                fireEvent.submit(form);
            });
            expect(screen.getByRole("form", { name: `Add ${kind}` })).toBe(
                form,
            );
            expect((name as HTMLInputElement).value).toBe("Draft");
            expect(screen.getByText("Please check the name.")).toBeDefined();
            if (kind === "room")
                expect(
                    (
                        within(form).getByRole("radio", {
                            name: "Bedroom",
                        }) as HTMLInputElement
                    ).checked,
                ).toBe(true);
        },
    );

    it("keeps room creation restricted to home managers", async () => {
        await setup(false, "MEMBER");
        expect(screen.queryByRole("button", { name: "Add room" })).toBeNull();
        expect(
            screen.queryByRole("button", { name: "Edit Downstairs Bedroom" }),
        ).toBeNull();
        expect(screen.getByRole("button", { name: "Add home" })).toBeDefined();
    });
});
