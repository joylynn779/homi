import {
    AirVent,
    Armchair,
    Baby,
    Bath,
    Bed,
    BedDouble,
    BedSingle,
    BookOpen,
    Boxes,
    Car,
    CookingPot,
    DoorOpen,
    Dumbbell,
    Fence,
    Flower2,
    Heater,
    House,
    LampDesk,
    Leaf,
    Monitor,
    Refrigerator,
    ShowerHead,
    Sofa,
    Sun,
    Trees,
    Utensils,
    Warehouse,
    WashingMachine,
    Wrench,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { iconNames, type IconName } from "lucide-react/dynamic";

export type RoomIconOption = {
    id: IconName;
    label: string;
    keywords: string;
    Icon?: LucideIcon;
};
export const defaultRoomIconId = "house";

// Stable Lucide identifiers are stored; labels and search terms are presentation only.
export const roomIconOptions: readonly RoomIconOption[] = [
    {
        id: "house",
        label: "Default",
        keywords: "automatic home room",
        Icon: House,
    },
    {
        id: "bed-double",
        label: "Master Bedroom",
        keywords: "sleep guest master",
        Icon: BedDouble,
    },
    {
        id: "bed-single",
        label: "Bedroom",
        keywords: "sleep guest master",
        Icon: BedSingle,
    },
    { id: "bed", label: "Guest room", keywords: "bedroom sleep", Icon: Bed },
    {
        id: "bath",
        label: "Bathroom",
        keywords: "bathtub wash restroom",
        Icon: Bath,
    },
    {
        id: "shower-head",
        label: "Shower",
        keywords: "bathroom wash",
        Icon: ShowerHead,
    },
    {
        id: "cooking-pot",
        label: "Kitchen",
        keywords: "cooking food",
        Icon: CookingPot,
    },
    {
        id: "utensils",
        label: "Dining room",
        keywords: "food eating table",
        Icon: Utensils,
    },
    {
        id: "sofa",
        label: "Living room",
        keywords: "family lounge den",
        Icon: Sofa,
    },
    {
        id: "armchair",
        label: "Sitting room",
        keywords: "living lounge reading",
        Icon: Armchair,
    },
    {
        id: "monitor",
        label: "Office",
        keywords: "study computer work",
        Icon: Monitor,
    },
    {
        id: "lamp-desk",
        label: "Study",
        keywords: "office desk work",
        Icon: LampDesk,
    },
    {
        id: "washing-machine",
        label: "Laundry",
        keywords: "wash clothes utility",
        Icon: WashingMachine,
    },
    {
        id: "car",
        label: "Garage",
        keywords: "parking vehicle carport",
        Icon: Car,
    },
    {
        id: "boxes",
        label: "Storage",
        keywords: "closet pantry attic basement",
        Icon: Boxes,
    },
    {
        id: "warehouse",
        label: "Workshop",
        keywords: "shed garage storage",
        Icon: Warehouse,
    },
    {
        id: "trees",
        label: "Garden",
        keywords: "exterior outdoor yard",
        Icon: Trees,
    },
    {
        id: "sun",
        label: "Patio",
        keywords: "outdoor terrace balcony deck",
        Icon: Sun,
    },
    {
        id: "fence",
        label: "Yard",
        keywords: "outdoor garden exterior",
        Icon: Fence,
    },
    {
        id: "flower-2",
        label: "Flowers",
        keywords: "garden outdoor",
        Icon: Flower2,
    },
    {
        id: "leaf",
        label: "Plants",
        keywords: "garden conservatory greenhouse",
        Icon: Leaf,
    },
    {
        id: "door-open",
        label: "Entry & hallway",
        keywords: "entrance foyer corridor mudroom",
        Icon: DoorOpen,
    },
    {
        id: "wrench",
        label: "Utility room",
        keywords: "mechanical tools systems repairs",
        Icon: Wrench,
    },
    {
        id: "air-vent",
        label: "Ventilation",
        keywords: "mechanical utility hvac systems",
        Icon: AirVent,
    },
    {
        id: "heater",
        label: "Heating",
        keywords: "mechanical utility boiler basement",
        Icon: Heater,
    },
    {
        id: "zap",
        label: "Electrical",
        keywords: "mechanical utility power",
        Icon: Zap,
    },
    {
        id: "refrigerator",
        label: "Pantry",
        keywords: "kitchen food storage",
        Icon: Refrigerator,
    },
    {
        id: "book-open",
        label: "Library",
        keywords: "study reading books",
        Icon: BookOpen,
    },
    {
        id: "baby",
        label: "Nursery",
        keywords: "kids children bedroom playroom",
        Icon: Baby,
    },
    {
        id: "dumbbell",
        label: "Gym",
        keywords: "exercise fitness workout",
        Icon: Dumbbell,
    },
];

const normalize = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, "");
const canonicalNames = new Map(iconNames.map((id) => [normalize(id), id]));
const suggestedIcons = new Map(
    roomIconOptions.map((option) => [option.id, option]),
);
// Seed data and the old free-text form predate a canonical identifier format.
const legacyNames = new Map<string, IconName>([
    ["room", "house"],
    ["default", "house"],
    ["automatic", "house"],
    ["cooking", "cooking-pot"],
    ["kitchen", "cooking-pot"],
    ["systems", "wrench"],
    ["tools", "wrench"],
    ["utility", "wrench"],
    ["living", "sofa"],
    ["exterior", "trees"],
    ["garden", "trees"],
]);

export function findRoomIcon(
    value?: string | null,
): RoomIconOption | undefined {
    if (!value?.trim()) return undefined;
    const normalized = normalize(value);
    const id = legacyNames.get(normalized) ?? canonicalNames.get(normalized);
    if (!id) return undefined;
    return (
        suggestedIcons.get(id) ?? {
            id,
            label: id
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
            keywords: id,
        }
    );
}

export function resolveRoomIcon(value?: string | null): RoomIconOption {
    return findRoomIcon(value) ?? roomIconOptions[0];
}

export function filterRoomIcons(query: string): readonly RoomIconOption[] {
    const words = query.trim().toLowerCase().split(/\s+/);
    return roomIconOptions.filter(
        (option) =>
            option.id === defaultRoomIconId ||
            words.every((word) =>
                `${option.label} ${option.id} ${option.keywords}`
                    .toLowerCase()
                    .includes(word),
            ),
    );
}
