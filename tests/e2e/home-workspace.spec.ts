import { expect, test } from "@playwright/test";
import { checkHomeWorkspace } from "./helpers/home-workspace";

test("Homes & Rooms layout and inline creation forms", async ({
    page,
    isMobile,
}) => {
    const response = await page.request.post("/api/homes", {
        data: {
            name: `Workspace ${crypto.randomUUID().slice(0, 8)}`,
            type: "HOUSE",
            timezone: "UTC",
        },
    });
    expect(response.status()).toBe(201);
    const homeId = (await response.json()).home.id;
    expect(
        (
            await page.request.post("/api/rooms", {
                data: {
                    homeId,
                    name: "Downstairs Bedroom",
                    floor: "Ground floor",
                    icon: "bed-double",
                },
            })
        ).status(),
    ).toBe(201);
    expect(
        (
            await page.request.post("/api/rooms", {
                data: { homeId, name: "A".repeat(80), floor: "Basement" },
            })
        ).status(),
    ).toBe(201);
    await checkHomeWorkspace(page, isMobile);
});
