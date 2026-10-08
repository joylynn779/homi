"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Bell,
    CalendarDays,
    Camera,
    CircleAlert,
    Coins,
    FileText,
    Hammer,
    House,
    LayoutDashboard,
    Library,
    Package,
    Settings,
    ShieldCheck,
    TriangleAlert,
    Users,
    Wrench,
} from "lucide-react";
import { Brand } from "@/src/components/brand";
import { GlobalCommandPalette } from "@/src/components/global-command-palette";
import { HomeSwitcher } from "@/src/components/home-switcher";
import { PwaInstallPrompt } from "@/src/components/pwa-install-prompt";
import { UserAvatar } from "@/src/components/user-avatar";
import type { HomeHealth } from "@/src/features/dashboard/health";
import type { SelectableHome } from "@/src/features/homes/selection";
import { getDictionary } from "@/src/features/i18n/dictionaries";
import type { SupportedLocale } from "@/src/server/services/experience";
import { authClient } from "@/src/lib/auth-client";

const navigation = [
    ["/dashboard", "overview", LayoutDashboard],
    ["/calendar", "calendar", CalendarDays],
    ["/homes", "homes", House],
    ["/assets", "assets", Package],
    ["/scan", "scan", Camera],
    ["/maintenance", "maintenance", Wrench],
    ["/operations", "operations", Hammer],
    ["/maintenance/templates", "careLibrary", Library],
    ["/repairs", "repairs", Wrench],
    ["/costs", "costs", Coins],
    ["/documents", "documents", FileText],
    ["/members", "household", Users],
] as const;

type NavigationKey = (typeof navigation)[number][1] | "settings";

function NavLink({
    href,
    label,
    icon: Icon,
}: {
    href: string;
    label: string;
    icon: typeof House;
}) {
    const pathname = usePathname();
    const moreSpecificMatch = navigation.some(
        ([candidate]) =>
            candidate !== href &&
            candidate.startsWith(`${href}/`) &&
            (pathname === candidate || pathname.startsWith(`${candidate}/`)),
    );
    const active =
        !moreSpecificMatch &&
        (pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
    return (
        <Link className={active ? "active" : ""} href={href}>
            <Icon size={17} />
            {label}
        </Link>
    );
}

export function AppShell({
    children,
    user,
    homes,
    selectedHomeId,
    locale,
}: {
    children: ReactNode;
    user: { name: string; email: string; avatarUrl?: string | null };
    homes: SelectableHome[];
    selectedHomeId: string;
    locale: SupportedLocale;
}) {
    const pathname = usePathname();
    const dictionary = getDictionary(locale);

    async function selectHome(homeId: string) {
        const response = await fetch("/api/homes/selected", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ homeId }),
        });
        if (!response.ok) {
            const payload = await response.json();
            throw new Error(
                payload.error?.message ?? dictionary.switchHomeError,
            );
        }
        window.location.reload();
    }

    const label = (key: NavigationKey) => dictionary[key];

    return (
        <div className="app-body">
            <aside className="app-sidebar">
                <Link href="/dashboard">
                    <Brand connected />
                </Link>
                <HomeSwitcher
                    homes={homes}
                    selectedHomeId={selectedHomeId}
                    locale={locale}
                    onSelect={selectHome}
                />
                <nav className="app-nav" aria-label="Workspace">
                    {navigation.map(([href, key, Icon]) => (
                        <NavLink
                            key={href}
                            href={href}
                            label={label(key)}
                            icon={Icon}
                        />
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <nav className="app-nav">
                        <NavLink
                            href="/settings"
                            label={dictionary.settings}
                            icon={Settings}
                        />
                    </nav>
                    <div className="app-user">
                        <UserAvatar
                            name={user.name}
                            avatarUrl={user.avatarUrl}
                        />
                        <div>
                            <strong>{user.name}</strong>
                            <small>{user.email}</small>
                        </div>
                    </div>
                </div>
            </aside>

            <div className="app-content">
                <header className="app-topbar">
                    <GlobalCommandPalette selectedHomeId={selectedHomeId} />
                    <PwaInstallPrompt compact />
                    <Link
                        className="icon-button"
                        href="/notifications"
                        aria-label={dictionary.notifications}
                        title={dictionary.notifications}
                    >
                        <Bell size={19} />
                    </Link>
                    <button
                        className="button button-small"
                        onClick={() =>
                            void authClient.signOut({
                                fetchOptions: {
                                    onSuccess: () =>
                                        window.location.assign("/sign-in"),
                                },
                            })
                        }
                    >
                        {dictionary.signOut}
                    </button>
                </header>
                {children}
            </div>
            <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
                {[
                    ["/dashboard", dictionary.home, LayoutDashboard],
                    ["/calendar", dictionary.calendar, CalendarDays],
                    ["/scan", dictionary.scan, Camera],
                    ["/maintenance", dictionary.tasks, Wrench],
                    ["/settings", dictionary.settings, Settings],
                ].map(([href, mobileLabel, Icon]) => (
                    <Link
                        className={pathname === href ? "active" : ""}
                        href={href as string}
                        key={href as string}
                    >
                        <Icon size={19} />
                        {mobileLabel as string}
                    </Link>
                ))}
            </nav>
        </div>
    );
}

export function CalmStatus({ health }: { health: HomeHealth }) {
    const Icon =
        health.level === "GOOD"
            ? ShieldCheck
            : health.level === "CRITICAL"
              ? CircleAlert
              : TriangleAlert;

    return (
        <div className="dash-status" data-health={health.level.toLowerCase()}>
            <span className="status-orb">
                <Icon size={25} />
            </span>
            <div>
                <h2>{health.title}</h2>
                <p>{health.summary}</p>
            </div>
            <span>
                Home health · {health.label} · {health.score}/100
            </span>
        </div>
    );
}
