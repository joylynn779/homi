import { describe, expect, it } from "vitest";
import { resolveSelectedHomeId } from "../src/features/homes/selection";

describe("selected home resolution", () => {
    const homes = [{ id: "first" }, { id: "second" }];

    it("returns no selection only when there are no accessible homes", () => {
        expect(resolveSelectedHomeId([])).toBe("");
        expect(resolveSelectedHomeId([], "previous")).toBe("");
    });

    it("selects the only accessible home", () => {
        expect(resolveSelectedHomeId([homes[0]])).toBe("first");
    });

    it("uses the first home in the shared ordering without a valid selection", () => {
        expect(resolveSelectedHomeId(homes)).toBe("first");
        expect(resolveSelectedHomeId(homes, "")).toBe("first");
        expect(resolveSelectedHomeId(homes, "inaccessible")).toBe("first");
    });

    it("preserves a previously selected accessible home", () => {
        expect(resolveSelectedHomeId(homes, "second")).toBe("second");
    });

    it("falls back when membership or the selected home is removed", () => {
        expect(resolveSelectedHomeId([homes[0]], "second")).toBe("first");
    });
});
