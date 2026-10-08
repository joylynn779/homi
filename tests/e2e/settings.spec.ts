import { expect, test } from "@playwright/test";

const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZJ84AAAAASUVORK5CYII=",
    "base64",
);
test("Settings routes, profile and notification saves remain independent", async ({
    page,
}) => {
    const before = (await (await page.request.get("/api/preferences")).json())
        .preferences;
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/profile$/);
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    await nav.getByRole("link", { name: "Profile", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
        nav.getByRole("link", { name: "Notifications", exact: true }),
    ).toBeFocused();
    await expect(
        nav.getByRole("link", { name: "Profile", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
        before.timezone,
    );
    await page.getByLabel("Timezone", { exact: true }).fill("America/New_York");
    const [timezoneSave] = await Promise.all([
        page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/preferences" &&
                response.request().method() === "PATCH",
        ),
        page
            .getByRole("button", { name: "Save timezone", exact: true })
            .click(),
    ]);
    expect(timezoneSave.status()).toBe(200);
    const changed = (await timezoneSave.json()).preferences;
    for (const key of [
        "emailEnabled",
        "inAppEnabled",
        "weeklySummaryEnabled",
        "maintenanceReminderDays",
        "warrantyReminderDays",
        "documentExpiryReminderDays",
    ])
        expect(changed[key]).toBe(before[key]);
    await nav.getByRole("link", { name: "Notifications", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/notifications$/);
    await expect(
        nav.getByRole("link", { name: "Notifications", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Timezone", { exact: true })).toHaveCount(0);
    await expect(
        page.getByRole("heading", { name: "Web Push", exact: true }),
    ).toBeVisible();
    await page
        .getByLabel("Email reminders", { exact: true })
        .setChecked(!before.emailEnabled);
    await page
        .getByLabel("Maintenance notice (days)", { exact: true })
        .fill("9");
    const [remindersSave] = await Promise.all([
        page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/preferences" &&
                response.request().method() === "PATCH",
        ),
        page
            .getByRole("button", { name: "Save reminders", exact: true })
            .click(),
    ]);
    const saved = (await remindersSave.json()).preferences;
    expect(saved.timezone).toBe("America/New_York");
    expect(saved.emailEnabled).toBe(!before.emailEnabled);
    expect(saved.maintenanceReminderDays).toBe(9);
    await page.goBack();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
        "America/New_York",
    );
    await page.goForward();
    await expect(page).toHaveURL(/\/settings\/notifications$/);
    await page.reload();
    await expect(
        page.getByLabel("Maintenance notice (days)", { exact: true }),
    ).toHaveValue("9");
    for (const section of [
        "profile",
        "notifications",
        "security",
        "integrations",
    ]) {
        await page.goto(`/settings/${section}`);
        await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
            "href",
            `/settings/${section}`,
        );
        await expect
            .poll(() =>
                nav.locator('[aria-current="page"]').evaluate((element) => {
                    const bounds =
                        element.parentElement!.getBoundingClientRect();
                    const selected = element.getBoundingClientRect();
                    return (
                        selected.left >= bounds.left - 1 &&
                        selected.right <= bounds.right + 1
                    );
                }),
            )
            .toBe(true);
        await expect(
            page.getByRole("heading", { name: "Settings", exact: true }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    }
    await expect(
        page.getByRole("heading", { name: "Personal API keys", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", {
            name: "Private calendar feed",
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Signed webhooks", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Sign-in methods", exact: true }),
    ).toHaveCount(0);
    await page.request.patch("/api/preferences", {
        data: Object.fromEntries(
            Object.entries(before).filter(([key]) =>
                [
                    "timezone",
                    "emailEnabled",
                    "inAppEnabled",
                    "weeklySummaryEnabled",
                    "maintenanceReminderDays",
                    "warrantyReminderDays",
                    "documentExpiryReminderDays",
                ].includes(key),
            ),
        ),
    });
});

test("Settings profile nickname and photo controls still work", async ({
    page,
    isMobile,
}) => {
    const original = (await (await page.request.get("/api/profile")).json())
        .profile;
    await page.goto("/settings/profile");
    const name = `Settings user ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByLabel("Nickname", { exact: true }).fill(name);
    await page
        .getByRole("button", { name: "Save nickname", exact: true })
        .click();
    await expect(
        page.getByText("Your nickname was updated.", { exact: true }),
    ).toBeVisible();
    expect(
        (await (await page.request.get("/api/profile")).json()).profile.name,
    ).toBe(name);
    if (!isMobile)
        await expect(
            page.locator(".app-user").getByText(name, { exact: true }),
        ).toBeVisible();
    await page.getByLabel("Choose a profile photo").setInputFiles({
        name: "settings-avatar.png",
        mimeType: "image/png",
        buffer: png,
    });
    const [avatarSave] = await Promise.all([
        page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/profile/avatar" &&
                response.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Update photo", exact: true }).click(),
    ]);
    expect(avatarSave.status()).toBe(200);
    await expect(
        page.getByText("Your profile photo was updated.", { exact: true }),
    ).toBeVisible();
    await page
        .getByRole("button", { name: "Remove custom photo", exact: true })
        .click();
    await expect(
        page.getByText("Your custom profile photo was removed.", {
            exact: true,
        }),
    ).toBeVisible();
    await page.getByLabel("Nickname", { exact: true }).fill(original.name);
    await page
        .getByRole("button", { name: "Save nickname", exact: true })
        .click();
    await expect(
        page.getByText("Your nickname was updated.", { exact: true }),
    ).toBeVisible();
});

test("Settings security keeps sessions, password changes, export and safe linking", async ({
    page,
}) => {
    await page.goto("/settings/security");
    await expect(
        page.getByText("Email & password", { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Sessions", exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByRole("button", { name: "Revoke session", exact: true })
            .first(),
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Export JSON", exact: true }),
    ).toHaveAttribute("href", "/api/export/account");
    expect((await page.request.get("/api/export/account")).status()).toBe(200);
    expect(
        (
            await page.request.post("/api/auth/unlink-account", {
                data: { providerId: "credential" },
            })
        ).status(),
    ).toBe(400);
    for (const [current, next] of [
        ["HomiDemo!2026", "SettingsTemp!2026"],
        ["SettingsTemp!2026", "HomiDemo!2026"],
    ]) {
        await page
            .getByLabel("Current password", { exact: true })
            .fill(current);
        await page.getByLabel("New password", { exact: true }).fill(next);
        const [changed] = await Promise.all([
            page.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname ===
                    "/api/auth/change-password",
            ),
            page
                .getByRole("button", { name: "Update password", exact: true })
                .click(),
        ]);
        expect(changed.status()).toBe(200);
        await expect(
            page.getByText("Password changed. Other sessions were revoked.", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByLabel("Current password", { exact: true }),
        ).toHaveValue("");
    }
    await page
        .getByRole("button", { name: "Revoke all other sessions", exact: true })
        .click();
    await expect(
        page.getByText("Other sessions revoked.", { exact: true }),
    ).toBeVisible();
    // Password changes rotate the current session; subsequent stateful journeys
    // must use the fresh cookie rather than the setup project's revoked token.
    await page.context().storageState({ path: "playwright/.auth/user.json" });
    const methods = (await (await page.request.get("/api/auth-methods")).json())
        .methods;
    if (
        !methods.find(
            (method: { providerId: string; enabled: boolean }) =>
                method.providerId === "google",
        )?.enabled
    )
        return;
    await page.route("https://accounts.google.com/**", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<html><body>Controlled provider cancellation</body></html>",
        }),
    );
    await page
        .getByRole("button", { name: "Connect Google", exact: true })
        .click();
    await page.waitForURL((url) => url.hostname === "accounts.google.com");
    const url = new URL(page.url());
    expect(new URL(url.searchParams.get("redirect_uri")!).pathname).toBe(
        "/api/auth/callback/google",
    );
    await page.goto(
        `/api/auth/callback/google?error=access_denied&state=${encodeURIComponent(url.searchParams.get("state")!)}`,
    );
    await expect(page).toHaveURL(/\/settings\/security/);
    await expect(
        page.getByText(
            "Connection cancelled. Your sign-in methods have not changed.",
            { exact: true },
        ),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Connect Google", exact: true }),
    ).toBeEnabled();
});
