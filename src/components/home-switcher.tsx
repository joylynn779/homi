"use client";

import { useId, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, House, LoaderCircle } from "lucide-react";
import {
  resolveSelectedHomeId,
  type SelectableHome,
} from "@/src/features/homes/selection";
import { getDictionary } from "@/src/features/i18n/dictionaries";
import type { SupportedLocale } from "@/src/server/services/experience";

export function HomeSwitcher({
  homes,
  selectedHomeId,
  locale,
  onSelect,
}: {
  homes: SelectableHome[];
  selectedHomeId: string;
  locale: SupportedLocale;
  onSelect: (homeId: string) => Promise<void>;
}) {
  const dictionary = getDictionary(locale);
  const descriptionId = useId();
  const resolvedId = resolveSelectedHomeId(homes, selectedHomeId);
  const selectedHome = homes.find((home) => home.id === resolvedId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function selectHome(homeId: string) {
    if (homeId === resolvedId || pending) return;
    setPending(true);
    setError("");
    try {
      await onSelect(homeId);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : dictionary.switchHomeError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="home-switcher-container">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="home-switcher"
            type="button"
            aria-label="Global selected home"
            aria-describedby={descriptionId}
            aria-busy={pending}
            disabled={!homes.length || pending}
          >
            <span aria-hidden="true">
              <House size={18} />
            </span>
            <span className="home-switcher-copy" id={descriptionId}>
              <strong title={selectedHome?.name}>
                {selectedHome?.name ?? dictionary.noHome}
              </strong>
              <small>
                {selectedHome?.city ||
                  selectedHome?.type ||
                  dictionary.personalJournal}
              </small>
            </span>
            {pending ? (
              <LoaderCircle
                className="button-spinner"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="home-switcher-menu"
            align="start"
            sideOffset={8}
            collisionPadding={12}
          >
            <DropdownMenu.Label className="home-switcher-menu-label">
              {dictionary.switchHome}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={resolvedId}
              onValueChange={(homeId) => void selectHome(homeId)}
              aria-label={dictionary.switchHome}
            >
              {homes.map((home) => (
                <DropdownMenu.RadioItem
                  className="home-switcher-option"
                  key={home.id}
                  value={home.id}
                  textValue={home.name}
                >
                  <span
                    className="home-switcher-option-icon"
                    aria-hidden="true"
                  >
                    <House size={17} />
                  </span>
                  <span className="home-switcher-option-copy">
                    <strong>{home.name}</strong>
                    <small>
                      {home.city || home.type || dictionary.personalJournal}
                    </small>
                  </span>
                  <DropdownMenu.ItemIndicator className="home-switcher-check">
                    <Check size={16} aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && (
        <p className="home-switcher-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
