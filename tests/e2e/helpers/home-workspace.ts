import { expect, type Page } from "@playwright/test";

export async function checkHomeWorkspace(page: Page, isMobile: boolean) {
    await page.goto("/homes");
    const row = page
        .locator(".home-room-row")
        .filter({ has: page.getByText("Downstairs Bedroom", { exact: true }) });
    await expect(row).toBeVisible();
    const layout = await row.evaluate((element) => {
        const info = element.children[1];
        const actions = element.children[2];
        const title = info.querySelector("strong")!;
        const floor = info.querySelector("small")!;
        return {
            columns:
                getComputedStyle(element).gridTemplateColumns.split(" ").length,
            textWidth: info.getBoundingClientRect().width,
            actionsRight: actions.getBoundingClientRect().right,
            rowRight: element.getBoundingClientRect().right,
            titleHeight: title.getBoundingClientRect().height,
            lineHeight: parseFloat(getComputedStyle(title).lineHeight),
            floorTop: floor.getBoundingClientRect().top,
            titleBottom: title.getBoundingClientRect().bottom,
        };
    });
    expect(layout.columns).toBe(3);
    expect(layout.textWidth).toBeGreaterThan(80);
    expect(Math.abs(layout.rowRight - layout.actionsRight)).toBeLessThan(2);
    expect(layout.floorTop).toBeGreaterThanOrEqual(layout.titleBottom);
    if (!isMobile)
        expect(layout.titleHeight).toBeLessThan(layout.lineHeight * 1.1);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    const longName = page.getByText("A".repeat(80), { exact: true });
    expect(
        await longName.evaluate(
            (element) =>
                element.getBoundingClientRect().height >
                parseFloat(getComputedStyle(element).lineHeight),
        ),
    ).toBe(true);
    await expect(
        page.getByRole("button", {
            name: `Edit ${"A".repeat(80)}`,
            exact: true,
        }),
    ).toBeVisible();

    for (const kind of ["room", "home"] as const) {
        const add = page.getByRole("button", {
            name: `Add ${kind}`,
            exact: true,
        });
        const form = page.getByRole("form", {
            name: `Add ${kind}`,
            exact: true,
        });
        await expect(form).toHaveCount(0);
        await add.focus();
        await page.keyboard.press("Enter");
        await expect(add).toHaveAttribute("aria-expanded", "true");
        const name = form.getByLabel(
            kind === "home" ? "Home name" : "Room name",
            { exact: true },
        );
        await expect(name).toBeFocused();
        await form
            .getByRole("button", { name: `Create ${kind}`, exact: true })
            .click();
        await expect(form).toBeVisible();
        expect(
            await name.evaluate(
                (element) =>
                    (element as HTMLInputElement).validity.valueMissing,
            ),
        ).toBe(true);
        await name.fill("Discard draft");
        await form.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(form).toHaveCount(0);
        await expect(add).toBeFocused();
        await add.click();
        await expect(name).toHaveValue("");
        const newName = `${kind} UI ${crypto.randomUUID().slice(0, 8)}`;
        await name.fill(newName);
        const endpoint = kind === "home" ? "**/api/homes" : "**/api/rooms";
        await page.route(endpoint, (route) =>
            route.request().method() === "POST"
                ? route.fulfill({
                      status: 400,
                      contentType: "application/json",
                      body: JSON.stringify({
                          error: { message: "Please check the name." },
                      }),
                  })
                : route.continue(),
        );
        await form
            .getByRole("button", { name: `Create ${kind}`, exact: true })
            .click();
        await expect(
            page.getByText("Please check the name.", { exact: true }),
        ).toBeVisible();
        await expect(form).toBeVisible();
        await expect(name).toHaveValue(newName);
        await page.unroute(endpoint);
        if (kind === "room")
            await form
                .getByRole("radio", { name: "Laundry", exact: true })
                .check();
        await form
            .getByRole("button", { name: `Create ${kind}`, exact: true })
            .click();
        await expect(form).toHaveCount(0);
        await expect(
            page
                .locator(".home-workspace")
                .getByText(newName, { exact: true })
                .first(),
        ).toBeVisible();
        await expect(add).toBeFocused();
        await add.click();
        await expect(name).toHaveValue("");
        if (kind === "room")
            await expect(
                form.getByRole("radio", { name: "Default", exact: true }),
            ).toBeChecked();
        await form.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await page
        .getByRole("button", { name: "Edit selected home", exact: true })
        .click();
    await expect(
        page.getByRole("button", { name: "Save home", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Cancel home editing", exact: true })
        .click();
}
