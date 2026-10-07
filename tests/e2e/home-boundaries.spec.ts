import { expect, test } from "@playwright/test";

test("selecting the active home keeps rooms and selection without requests", async ({
    page,
    isMobile,
}) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const roomRow = (name: string) =>
        page
            .locator(".dash-task")
            .filter({ has: page.getByText(name, { exact: true }) });
    const fixtures = [
        { name: `Active home A ${suffix}`, room: `Room A ${suffix}` },
        { name: `Active home B ${suffix}`, room: `Room B ${suffix}` },
    ];
    const homeIds: string[] = [];
    for (const fixture of fixtures) {
        const homeResponse = await page.request.post("/api/homes", {
            data: { name: fixture.name, type: "HOUSE", timezone: "UTC" },
        });
        expect(homeResponse.status()).toBe(201);
        const homeId = (await homeResponse.json()).home.id as string;
        homeIds.push(homeId);
        const roomResponse = await page.request.post("/api/rooms", {
            data: { homeId, name: fixture.room },
        });
        expect(roomResponse.status()).toBe(201);
    }
    expect(
        (
            await page.request.post("/api/homes/selected", {
                data: { homeId: homeIds[0] },
            })
        ).status(),
    ).toBe(200);
    await page.goto("/homes");
    await expect(roomRow(fixtures[0].room)).toBeVisible();
    const cookieBefore = (await page.context().cookies()).find(
        (cookie) => cookie.name === "homi-selected-home",
    );
    expect(cookieBefore?.value).toBe(homeIds[0]);
    const requests: string[] = [];
    page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (path === "/api/homes/selected" || path === "/api/rooms")
            requests.push(`${request.method()} ${path}`);
    });
    await page
        .getByRole("button", { name: new RegExp(fixtures[0].name) })
        .click();
    await page
        .getByRole("button", { name: new RegExp(fixtures[0].name) })
        .click();
    expect(
        (await (await page.request.get("/api/homes")).json()).selectedHomeId,
    ).toBe(homeIds[0]);
    await expect(roomRow(fixtures[0].room)).toBeVisible();
    expect(requests).toEqual([]);
    expect(
        (await page.context().cookies()).find(
            (cookie) => cookie.name === "homi-selected-home",
        ),
    ).toEqual(cookieBefore);

    const [selection] = await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/homes/selected") &&
                response.request().method() === "POST",
        ),
        page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/rooms" &&
                url.searchParams.get("homeId") === homeIds[1] &&
                response.request().method() === "GET"
            );
        }),
        page
            .getByRole("button", { name: new RegExp(fixtures[1].name) })
            .click(),
    ]);
    expect(selection.status()).toBe(200);
    await expect(roomRow(fixtures[1].room)).toBeVisible();
    await expect(page.getByText(fixtures[0].room, { exact: true })).toHaveCount(
        0,
    );
    await page.reload();
    await expect(roomRow(fixtures[1].room)).toBeVisible();
    expect(
        (await (await page.request.get("/api/homes")).json()).selectedHomeId,
    ).toBe(homeIds[1]);
    if (!isMobile)
        await expect(
            page.getByRole("button", { name: "Global selected home" }),
        ).toContainText(fixtures[1].name);
});

test("rejects cross-home resource associations", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    const suffix = crypto.randomUUID().slice(0, 8);

    const firstHomeResponse = await page.request.post("/api/homes", {
        data: { name: `Boundary A ${suffix}`, type: "HOUSE", timezone: "UTC" },
    });
    const secondHomeResponse = await page.request.post("/api/homes", {
        data: { name: `Boundary B ${suffix}`, type: "HOUSE", timezone: "UTC" },
    });
    expect(firstHomeResponse.status()).toBe(201);
    expect(secondHomeResponse.status()).toBe(201);
    const firstHomeId = (
        (await firstHomeResponse.json()) as { home: { id: string } }
    ).home.id;
    const secondHomeId = (
        (await secondHomeResponse.json()) as { home: { id: string } }
    ).home.id;

    const roomResponse = await page.request.post("/api/rooms", {
        data: { homeId: firstHomeId, name: `Room ${suffix}` },
    });
    expect(roomResponse.status()).toBe(201);
    const roomId = ((await roomResponse.json()) as { room: { id: string } })
        .room.id;

    const crossHomeAsset = await page.request.post("/api/assets", {
        data: {
            homeId: secondHomeId,
            roomId,
            name: `Invalid asset ${suffix}`,
            category: "Other",
            status: "ACTIVE",
        },
    });
    expect(crossHomeAsset.status()).toBe(404);

    const assetResponse = await page.request.post("/api/assets", {
        data: {
            homeId: firstHomeId,
            roomId,
            name: `Valid asset ${suffix}`,
            category: "Other",
            status: "ACTIVE",
        },
    });
    expect(assetResponse.status()).toBe(201);
    const assetId = ((await assetResponse.json()) as { asset: { id: string } })
        .asset.id;

    const crossHomeTask = await page.request.post("/api/tasks", {
        data: {
            homeId: secondHomeId,
            assetId,
            title: `Invalid task ${suffix}`,
            frequencyType: "ONCE",
            frequencyInterval: 1,
            nextDueAt: new Date().toISOString(),
            priority: "MEDIUM",
        },
    });
    expect(crossHomeTask.status()).toBe(404);

    const crossHomeRepair = await page.request.post("/api/repairs", {
        data: {
            homeId: secondHomeId,
            assetId,
            title: `Invalid repair ${suffix}`,
            issueDate: new Date().toISOString().slice(0, 10),
            status: "OPEN",
            warrantyClaim: false,
        },
    });
    expect(crossHomeRepair.status()).toBe(404);

    const crossHomeDocument = await page.request.post("/api/uploads", {
        multipart: {
            homeId: secondHomeId,
            assetId,
            type: "MANUAL",
            title: `Invalid document ${suffix}`,
            file: {
                name: "boundary.pdf",
                mimeType: "application/pdf",
                buffer: Buffer.from("%PDF-1.4\n%%EOF"),
            },
        },
    });
    expect(crossHomeDocument.status()).toBe(404);
});

test("global home switcher persists and drives the dashboard", async ({
    page,
}) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    const suffix = crypto.randomUUID().slice(0, 8);
    const homeName = `Selected Home ${suffix}`;
    const response = await page.request.post("/api/homes", {
        data: {
            name: homeName,
            type: "HOUSE",
            city: "Basel",
            timezone: "Europe/Zurich",
        },
    });
    expect(response.status()).toBe(201);
    const homeId = ((await response.json()) as { home: { id: string } }).home
        .id;

    const selection = await page.request.post("/api/homes/selected", {
        data: { homeId },
    });
    expect(selection.status()).toBe(200);

    await page.goto("/dashboard");
    await expect(
        page.getByText(`${homeName} is ready for the day.`),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Global selected home" }),
    ).toContainText(homeName);

    const homes = (await (await page.request.get("/api/homes")).json()) as {
        homes: Array<{ id: string }>;
        selectedHomeId: string;
    };
    expect(homes.selectedHomeId).toBe(homeId);
    expect(homes.homes[0]?.id).toBe(homeId);
});

test("creating a home refreshes the sidebar and switching persists across reloads", async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, "The sidebar is hidden on mobile.");
    await page.goto("/homes");
    const homeName = `Z Selector ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByRole("button", { name: "Add home", exact: true }).click();
    await page.getByLabel("Home name").fill(homeName);
    await page
        .getByRole("button", { name: "Create home", exact: true })
        .click();
    const switcher = page.getByRole("button", { name: "Global selected home" });
    await expect(switcher).toContainText(homeName);

    const payload = await (await page.request.get("/api/homes")).json();
    const created = payload.homes.find(
        (home: { name: string }) => home.name === homeName,
    );
    const other = payload.homes.find(
        (home: { id: string }) => home.id !== created.id,
    );
    expect(payload.selectedHomeId).toBe(created.id);
    expect(other).toBeDefined();
    await switcher.click();
    await page
        .getByRole("menuitemradio")
        .filter({ hasText: other.name })
        .click();
    await expect(switcher).toContainText(other.name);
    await page.goto("/dashboard");
    await expect(
        page.getByText(`${other.name} is ready for the day.`),
    ).toBeVisible();
    await page.reload();
    await expect(switcher).toContainText(other.name);
    expect(
        (await (await page.request.get("/api/homes")).json()).selectedHomeId,
    ).toBe(other.id);
});

test("fresh loads agree on the fallback for an inaccessible saved home", async ({
    page,
}) => {
    await page.goto("/dashboard");
    await page.context().addCookies([
        {
            name: "homi-selected-home",
            value: crypto.randomUUID(),
            url: page.url(),
        },
    ]);
    await page.reload();
    const payload = await (await page.request.get("/api/homes")).json();
    const selected = payload.homes.find(
        (home: { id: string }) => home.id === payload.selectedHomeId,
    );
    expect(selected).toBeDefined();
    await expect(
        page.getByRole("button", { name: "Global selected home" }),
    ).toContainText(selected.name);
    await expect(
        page.getByText(`${selected.name} is ready for the day.`),
    ).toBeVisible();
    const denied = await page.request.post("/api/homes/selected", {
        data: { homeId: crypto.randomUUID() },
    });
    expect(denied.status()).toBe(404);
    await page.reload();
    await expect(
        page.getByText(`${selected.name} is ready for the day.`),
    ).toBeVisible();
    await page.context().clearCookies({ name: "homi-selected-home" });
    await page.reload();
    await expect(
        page.getByRole("button", { name: "Global selected home" }),
    ).toContainText(selected.name);
    await expect(
        page.getByText(`${selected.name} is ready for the day.`),
    ).toBeVisible();
});
