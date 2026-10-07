"use client";

import { useId, useState } from "react";
import { Search } from "lucide-react";
import { RoomIcon } from "@/src/components/room-icon";
import {
    defaultRoomIconId,
    filterRoomIcons,
    findRoomIcon,
    resolveRoomIcon,
    roomIconOptions,
} from "@/src/features/rooms/icons";

export function RoomIconPicker({
    defaultValue,
    disabled = false,
}: {
    defaultValue?: string | null;
    disabled?: boolean;
}) {
    const id = useId();
    // Keep the original value until an explicit choice, including legacy/invalid values.
    const [value, setValue] = useState(defaultValue ?? "");
    const [query, setQuery] = useState("");
    const recognized = findRoomIcon(value);
    const current = resolveRoomIcon(value);
    const invalid = Boolean(value.trim()) && !recognized;
    const selectedId = invalid ? undefined : current.id;
    const options = filterRoomIcons(query);
    const savedExtra =
        recognized &&
        !roomIconOptions.some((option) => option.id === recognized.id);

    return (
        <fieldset className="room-icon-picker" disabled={disabled}>
            <legend>Room icon</legend>
            <input type="hidden" name="icon" value={value} />
            <div className="room-icon-preview">
                <span className="room-icon-preview-symbol">
                    <RoomIcon value={value} size={24} />
                </span>
                <div>
                    <strong>
                        {invalid
                            ? "Default (saved icon unavailable)"
                            : current.label}
                    </strong>
                    <small>
                        {invalid
                            ? "The saved value is kept unless you choose a replacement."
                            : "Choose an icon to recognize this room."}
                    </small>
                </div>
            </div>
            <div className="field room-icon-search">
                <label htmlFor={`${id}-search`}>Search room icons</label>
                <div>
                    <Search size={16} aria-hidden="true" />
                    <input
                        id={`${id}-search`}
                        type="search"
                        placeholder="Bedroom, kitchen, garden…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
            </div>
            <div className="room-icon-grid">
                {(savedExtra ? [recognized, ...options] : options).map(
                    (option) => (
                        <label className="room-icon-choice" key={option.id}>
                            <input
                                type="radio"
                                name={`${id}-choice`}
                                value={option.id}
                                checked={selectedId === option.id}
                                onChange={() => setValue(option.id)}
                            />
                            <RoomIcon value={option.id} size={22} />
                            <span>
                                {option.id === defaultRoomIconId
                                    ? "Default"
                                    : option.label}
                            </span>
                        </label>
                    ),
                )}
            </div>
            {options.length === 1 && query.trim() && (
                <p className="field-hint" role="status">
                    No matching room icons. Try another search.
                </p>
            )}
        </fieldset>
    );
}
