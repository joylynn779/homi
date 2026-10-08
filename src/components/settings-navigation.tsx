"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const settingsSections = [
    { href: "/settings/profile", label: "Profile" },
    { href: "/settings/notifications", label: "Notifications" },
    { href: "/settings/security", label: "Security" },
    { href: "/settings/integrations", label: "Integrations" },
];
export function SettingsNavigation() {
    const pathname = usePathname();
    const navigation = useRef<HTMLElement>(null);
    useEffect(() => {
        const nav = navigation.current;
        const active = nav?.querySelector('[aria-current="page"]');
        if (!nav || !active) return;
        const bounds = nav.getBoundingClientRect();
        const selected = active.getBoundingClientRect();
        if (selected.left < bounds.left)
            nav.scrollLeft += selected.left - bounds.left;
        else if (selected.right > bounds.right)
            nav.scrollLeft += selected.right - bounds.right;
    }, [pathname]);
    return (
        <nav
            ref={navigation}
            className="settings-navigation"
            aria-label="Settings sections"
        >
            {settingsSections.map((section) => (
                <Link
                    key={section.href}
                    href={section.href}
                    aria-current={
                        pathname === section.href ? "page" : undefined
                    }
                >
                    {section.label}
                </Link>
            ))}
        </nav>
    );
}
