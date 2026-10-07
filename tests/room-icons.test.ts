import { describe, expect, it } from "vitest";
import {
    Bath,
    BedDouble,
    CookingPot,
    House,
    Sofa,
    Trees,
    WashingMachine,
    Wrench,
} from "lucide-react";
import { iconNames } from "lucide-react/dynamic";
import {
    filterRoomIcons,
    findRoomIcon,
    resolveRoomIcon,
    roomIconOptions,
} from "../src/features/rooms/icons";

describe("room icon resolution", () => {
    it.each([
        ["bed-double", BedDouble],
        ["BedDouble", BedDouble],
        ["bed_double", BedDouble],
        [" Bath ", Bath],
        ["washing-machine", WashingMachine],
        ["Cooking", CookingPot],
        ["Systems", Wrench],
        ["Living", Sofa],
        ["Exterior", Trees],
        ["Tools", Wrench],
        ["Room", House],
    ])(
        "resolves canonical, component and legacy identifiers: %s",
        (value, Icon) => {
            expect(resolveRoomIcon(value as string).Icon).toBe(Icon);
        },
    );

    it.each([
        undefined,
        null,
        "",
        "  ",
        "not-an-icon",
        "🏠",
        "<svg />",
        "__proto__",
        "constructor",
    ])("safely falls back for %s", (value) => {
        expect(findRoomIcon(value)).toBeUndefined();
        expect(resolveRoomIcon(value).Icon).toBe(House);
    });

    it("recognizes existing Lucide icons outside the suggested gallery", () => {
        expect(findRoomIcon("TreePine")?.id).toBe("tree-pine");
        expect(findRoomIcon("tree-pine")?.label).toBe("Tree Pine");
        for (const id of iconNames) expect(findRoomIcon(id)).toBeDefined();
    });

    it("offers unique identifiers from the installed Lucide library", () => {
        expect(new Set(roomIconOptions.map((option) => option.id)).size).toBe(
            roomIconOptions.length,
        );
        for (const option of roomIconOptions) {
            expect(iconNames).toContain(option.id);
            expect(option.Icon).toBeDefined();
            expect(resolveRoomIcon(option.id)).toBe(option);
        }
    });

    it("searches labels, identifiers and room synonyms while keeping Default available", () => {
        expect(filterRoomIcons("family").map((option) => option.id)).toEqual([
            "house",
            "sofa",
        ]);
        expect(
            filterRoomIcons("mechanical hvac").map((option) => option.id),
        ).toEqual(["house", "air-vent"]);
        expect(
            filterRoomIcons("not-a-room").map((option) => option.id),
        ).toEqual(["house"]);
        expect(filterRoomIcons("  ")).toHaveLength(roomIconOptions.length);
    });
});
