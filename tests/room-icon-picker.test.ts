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
    within,
} from "@testing-library/react";
import { RoomIconPicker } from "../src/components/room-icon-picker";
import { RoomIcon } from "../src/components/room-icon";
import { HomeWorkspace } from "../src/components/home-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function picker(value?: string | null) {
    const view = render(
        createElement(
            "form",
            null,
            createElement(RoomIconPicker, { defaultValue: value }),
        ),
    );
    const form = view.container.querySelector("form")!;
    return { ...view, stored: () => new FormData(form).get("icon") };
}

describe("room icon picker", () => {
    it("previews and retains the original legacy value, even when searching", () => {
        const view = picker("Cooking");
        expect(
            view.container.querySelector(
                ".room-icon-preview .lucide-cooking-pot",
            ),
        ).not.toBeNull();
        expect(
            (screen.getByRole("radio", { name: "Kitchen" }) as HTMLInputElement)
                .checked,
        ).toBe(true);
        fireEvent.change(screen.getByRole("searchbox"), {
            target: { value: "family" },
        });
        expect(screen.queryByRole("radio", { name: "Kitchen" })).toBeNull();
        expect(
            screen.getByRole("radio", { name: "Living room" }),
        ).toBeDefined();
        expect(view.stored()).toBe("Cooking");
    });

    it("stores a canonical identifier only when a choice is made", () => {
        const view = picker();
        fireEvent.click(screen.getByRole("radio", { name: "Bedroom" }));
        expect(view.stored()).toBe("bed-single");
        fireEvent.click(screen.getByRole("radio", { name: "Default" }));
        expect(view.stored()).toBe("house");
    });

    it.each([null, "", "unknown-icon", "  old value  ", "🏠"])(
        "preserves %s until deliberately replaced",
        (value) => {
            const view = picker(value);
            expect(view.stored()).toBe(value ?? "");
            if (value?.trim()) {
                expect(screen.getByText(/saved value is kept/)).toBeDefined();
                expect(
                    (
                        screen.getByRole("radio", {
                            name: "Default",
                        }) as HTMLInputElement
                    ).checked,
                ).toBe(false);
            }
            fireEvent.click(screen.getByRole("radio", { name: "Default" }));
            if (value?.trim()) expect(view.stored()).toBe("house");
        },
    );

    it("shows an existing icon outside the suggested gallery without replacing it", async () => {
        const view = picker("TreePine");
        expect(
            (
                screen.getByRole("radio", {
                    name: "Tree Pine",
                }) as HTMLInputElement
            ).checked,
        ).toBe(true);
        await waitFor(() =>
            expect(
                view.container.querySelector(
                    ".room-icon-preview svg.lucide-tree-pine path",
                ),
            ).not.toBeNull(),
        );
        expect(view.stored()).toBe("TreePine");
    });

    it("uses independent native radio groups for multiple pickers", () => {
        const view = render(
            createElement(
                "div",
                null,
                createElement(RoomIconPicker),
                createElement(RoomIconPicker),
            ),
        );
        const groups = view.container.querySelectorAll("fieldset");
        fireEvent.click(
            within(groups[0] as HTMLElement).getByRole("radio", {
                name: "Bedroom",
            }),
        );
        expect(
            (
                within(groups[1] as HTMLElement).getByRole("radio", {
                    name: "Default",
                }) as HTMLInputElement
            ).checked,
        ).toBe(true);
    });

    it("disables all choices and search through a native fieldset", () => {
        const view = render(createElement(RoomIconPicker, { disabled: true }));
        expect(view.container.querySelector("fieldset")?.disabled).toBe(true);
        expect(screen.getByRole("searchbox").matches(":disabled")).toBe(true);
        expect(
            screen.getByRole("radio", { name: "Kitchen" }).matches(":disabled"),
        ).toBe(true);
    });

    it("renders the stored icon rather than always rendering a house", () => {
        const view = render(
            createElement(RoomIcon, { value: "Bath", size: 16 }),
        );
        expect(view.container.querySelector(".lucide-bath")).not.toBeNull();
        view.rerender(createElement(RoomIcon, { value: "unknown" }));
        expect(view.container.querySelector(".lucide-house")).not.toBeNull();
    });
});

const home = {
    id: "home",
    name: "Home",
    type: "HOUSE",
    role: "OWNER",
    timezone: "UTC",
};
async function workspace(icon: string | null) {
    const room = { id: "room", name: "Existing room", floor: null, icon };
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "PATCH") return Response.json({ room });
        if (options?.method === "POST") return Response.json({ room });
        return Response.json(
            url === "/api/homes" ? { homes: [home] } : { rooms: [room] },
        );
    });
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
        render(createElement(HomeWorkspace));
    });
    return fetch;
}

describe("room icon form integration", () => {
    it("uses the canonical default when creating without an explicit choice", async () => {
        const fetch = await workspace(null);
        fireEvent.click(screen.getByRole("button", { name: "Add room" }));
        const form = screen.getByRole("form", { name: "Add room" });
        fireEvent.change(within(form).getByLabelText("Room name"), {
            target: { value: "New room" },
        });
        fireEvent.submit(form);
        await screen.findByText("Room added.");
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "POST",
                    )![1]!.body,
                ),
            ).icon,
        ).toBe("house");
    });

    it.each([
        null,
        "Cooking",
        "BedDouble",
        "unknown-icon",
        "  imported legacy value  ",
        "x".repeat(50),
    ])(
        "omits unchanged icon %s from updates to preserve the database value",
        async (icon) => {
            const fetch = await workspace(icon);
            fireEvent.click(
                await screen.findByRole("button", {
                    name: "Edit Existing room",
                }),
            );
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
            await waitFor(() =>
                expect(
                    fetch.mock.calls.some(
                        ([, options]) => options?.method === "PATCH",
                    ),
                ).toBe(true),
            );
            const patch = fetch.mock.calls.find(
                ([, options]) => options?.method === "PATCH",
            )![1]!;
            expect(JSON.parse(String(patch.body))).not.toHaveProperty("icon");
        },
    );

    it("sends the chosen canonical icon on edit", async () => {
        const fetch = await workspace("unknown-icon");
        fireEvent.click(
            await screen.findByRole("button", { name: "Edit Existing room" }),
        );
        const form = screen
            .getByRole("button", { name: "Save" })
            .closest("form")!;
        fireEvent.click(within(form).getByRole("radio", { name: "Laundry" }));
        fireEvent.click(within(form).getByRole("button", { name: "Save" }));
        await waitFor(() =>
            expect(
                fetch.mock.calls.some(
                    ([, options]) => options?.method === "PATCH",
                ),
            ).toBe(true),
        );
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "PATCH",
                    )![1]!.body,
                ),
            ).icon,
        ).toBe("washing-machine");
    });

    it("creates with the chosen icon and resets the picker after success", async () => {
        const fetch = await workspace(null);
        await screen.findByRole("button", { name: "Edit Existing room" });
        fireEvent.click(screen.getByRole("button", { name: "Add room" }));
        const form = screen.getByRole("form", { name: "Add room" });
        fireEvent.change(within(form).getByLabelText("Room name"), {
            target: { value: "Bedroom" },
        });
        fireEvent.click(within(form).getByRole("radio", { name: "Bedroom" }));
        fireEvent.submit(form);
        await waitFor(() =>
            expect(screen.getByText("Room added.")).toBeDefined(),
        );
        expect(
            JSON.parse(
                String(
                    fetch.mock.calls.find(
                        ([, options]) => options?.method === "POST",
                    )![1]!.body,
                ),
            ).icon,
        ).toBe("bed-single");
        expect(screen.queryByRole("form", { name: "Add room" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Add room" }));
        const reopened = screen.getByRole("form", { name: "Add room" });
        expect(
            (
                within(reopened).getByRole("radio", {
                    name: "Default",
                }) as HTMLInputElement
            ).checked,
        ).toBe(true);
        expect(
            within(reopened).getByRole("searchbox").getAttribute("value"),
        ).toBe("");
    });
});
