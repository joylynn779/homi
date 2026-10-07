import { expect, test, type Locator } from "@playwright/test";

test("room icons render, remain compatible and persist through the accessible picker", async ({
    page,
}) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    async function saveRoom(form: Locator) {
        const [response] = await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.request().method() === "PATCH" &&
                    /\/api\/rooms\//.test(response.url()),
            ),
            form.getByRole("button", { name: "Save", exact: true }).click(),
        ]);
        expect(response.status()).toBe(200);
    }
    const homeName = `Icon test ${suffix}`;
    const homeResponse = await page.request.post("/api/homes", {
        data: { name: homeName, type: "HOUSE", timezone: "UTC" },
    });
    expect(homeResponse.status()).toBe(201);
    const homeId = (await homeResponse.json()).home.id as string;
    const fixtures = [
        {
            name: `Bedroom ${suffix}`,
            icon: "BedDouble",
            rendered: "bed-double",
        },
        { name: `Kitchen ${suffix}`, icon: "Cooking", rendered: "cooking-pot" },
        {
            name: `Unknown ${suffix}`,
            icon: "old-custom-icon",
            rendered: "house",
        },
        { name: `Empty ${suffix}`, rendered: "house" },
        { name: `Tree ${suffix}`, icon: "TreePine", rendered: "tree-pine" },
    ];
    const ids: string[] = [];
    for (const fixture of fixtures) {
        const response = await page.request.post("/api/rooms", {
            data: { homeId, name: fixture.name, icon: fixture.icon },
        });
        expect(response.status()).toBe(201);
        ids.push((await response.json()).room.id);
    }

    await page.goto("/homes");
    for (const fixture of fixtures) {
        const row = page
            .locator(".dash-task")
            .filter({ has: page.getByText(fixture.name, { exact: true }) });
        await expect(
            row.locator(`svg.lucide-${fixture.rendered}`),
        ).toBeVisible();
    }

    // Merely editing another field must not replace an invalid, legacy or absent value.
    for (const index of [1, 2, 3, 4]) {
        await page
            .getByRole("button", {
                name: `Edit ${fixtures[index].name}`,
                exact: true,
            })
            .click();
        const form = page.locator("form").filter({
            has: page.getByRole("button", { name: "Save", exact: true }),
        });
        await form.getByLabel("Floor", { exact: true }).fill("Existing floor");
        await saveRoom(form);
        await expect(
            page.getByRole("button", {
                name: `Edit ${fixtures[index].name}`,
                exact: true,
            }),
        ).toBeVisible();
        const response = await page.request.get(`/api/rooms/${ids[index]}`);
        expect((await response.json()).room.icon).toBe(
            fixtures[index].icon ?? null,
        );
    }

    await page
        .getByRole("button", { name: `Edit ${fixtures[0].name}`, exact: true })
        .click();
    const bedroomEdit = page.locator("form").filter({
        has: page.getByRole("button", { name: "Save", exact: true }),
    });
    await bedroomEdit
        .getByRole("radio", { name: "Bathroom", exact: true })
        .check();
    await saveRoom(bedroomEdit);
    await expect(
        page.getByRole("button", {
            name: `Edit ${fixtures[0].name}`,
            exact: true,
        }),
    ).toBeVisible();
    expect(
        (await (await page.request.get(`/api/rooms/${ids[0]}`)).json()).room
            .icon,
    ).toBe("bath");

    await page
        .getByRole("button", { name: `Edit ${fixtures[2].name}`, exact: true })
        .click();
    const edit = page.locator("form").filter({
        has: page.getByRole("button", { name: "Save", exact: true }),
    });
    await expect(edit.getByText(/saved value is kept/)).toBeVisible();
    await edit.getByRole("radio", { name: "Default", exact: true }).check();
    await saveRoom(edit);
    await expect(
        page.getByRole("button", {
            name: `Edit ${fixtures[2].name}`,
            exact: true,
        }),
    ).toBeVisible();
    expect(
        (await (await page.request.get(`/api/rooms/${ids[2]}`)).json()).room
            .icon,
    ).toBe("house");

    await page.getByRole("button", { name: "Add room", exact: true }).click();
    const create = page.locator("form").filter({
        has: page.getByRole("button", { name: "Create room", exact: true }),
    });
    await create
        .getByLabel("Room name", { exact: true })
        .fill(`Laundry ${suffix}`);
    await create
        .getByRole("searchbox", { name: "Search room icons" })
        .fill("clothes");
    await expect(create.getByRole("radio")).toHaveCount(2);
    // Native radios support tab/arrow/space without custom keyboard handlers.
    await create.getByRole("radio", { name: "Default", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
        create.getByRole("radio", { name: "Laundry", exact: true }),
    ).toBeChecked();
    await expect(
        create.locator(".room-icon-preview svg.lucide-washing-machine"),
    ).toBeVisible();
    await create
        .getByRole("button", { name: "Create room", exact: true })
        .click();
    await expect(
        page.getByRole("button", {
            name: `Edit Laundry ${suffix}`,
            exact: true,
        }),
    ).toBeVisible();
    await expect(create).toHaveCount(0);
    await page.getByRole("button", { name: "Add room", exact: true }).click();
    await expect(
        create.getByRole("radio", { name: "Default", exact: true }),
    ).toBeChecked();
    await expect(create.getByRole("searchbox")).toHaveValue("");
    await create.getByRole("button", { name: "Cancel", exact: true }).click();
    const rooms = (
        await (await page.request.get(`/api/rooms?homeId=${homeId}`)).json()
    ).rooms as { name: string; icon: string }[];
    expect(rooms.find((room) => room.name === `Laundry ${suffix}`)?.icon).toBe(
        "washing-machine",
    );

    await page.reload();
    const row = page
        .locator(".dash-task")
        .filter({ has: page.getByText(`Laundry ${suffix}`, { exact: true }) });
    await expect(row.locator("svg.lucide-washing-machine")).toBeVisible();
    const bedroom = page
        .locator(".dash-task")
        .filter({ has: page.getByText(fixtures[0].name, { exact: true }) });
    await expect(bedroom.locator("svg.lucide-bath")).toBeVisible();
});
