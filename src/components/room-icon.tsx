"use client";

import { House, type LucideProps } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { resolveRoomIcon } from "@/src/features/rooms/icons";

export function RoomIcon({
    value,
    ...props
}: LucideProps & { value?: string | null }) {
    const option = resolveRoomIcon(value);
    if (option.Icon) return <option.Icon aria-hidden="true" {...props} />;
    // Uncommon existing Lucide icons load on demand; suggested room icons are static.
    return (
        <DynamicIcon
            {...props}
            key={option.id}
            name={option.id}
            aria-hidden="true"
            className={`lucide-${option.id} ${props.className ?? ""}`}
            fallback={() => <House aria-hidden="true" {...props} />}
        />
    );
}
