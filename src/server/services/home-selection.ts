import "server-only";
import { cookies } from "next/headers";
import { selectedHomeCookie } from "@/src/features/homes/selection";

// Call only after verifying access or committing the new home membership.
export async function setSelectedHomeId(homeId: string) {
  const store = await cookies();
  store.set(selectedHomeCookie, homeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
