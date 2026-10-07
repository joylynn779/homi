import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/server/errors";

const mocks = vi.hoisted(() => ({
  cookies: { set: vi.fn(), get: vi.fn() },
  verifiedUser: vi.fn(),
  homeAccess: vi.fn(),
  createHome: vi.fn(),
  listHomes: vi.fn(),
  invitation: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookies }));
vi.mock("../src/server/authorization", () => ({
  requireVerifiedUser: mocks.verifiedUser,
  requireHomeAccess: mocks.homeAccess,
}));
vi.mock("../src/server/services/homes", () => ({
  createHome: mocks.createHome,
  listHomes: mocks.listHomes,
}));
vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.invitation }) }),
    }),
    transaction: mocks.transaction,
  },
}));

import { GET as getHomes, POST as createHome } from "../app/api/homes/route";
import { POST as selectHome } from "../app/api/homes/selected/route";
import { POST as acceptInvitation } from "../app/api/invitations/accept/route";

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const homes = [
  { id: firstId, name: "First" },
  { id: secondId, name: "Second" },
];
const request = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifiedUser.mockResolvedValue({
    user: { id: "user", email: "member@example.test", name: "Member" },
  });
  mocks.homeAccess.mockResolvedValue({});
  mocks.listHomes.mockResolvedValue(homes);
});

describe("home selection routes", () => {
  it("resolves API defaults, saved selections, and inaccessible selections", async () => {
    for (const [saved, expected] of [
      [undefined, firstId],
      [secondId, secondId],
      ["inaccessible", firstId],
    ]) {
      mocks.cookies.get.mockReturnValue(saved ? { value: saved } : undefined);
      const payload = await (
        await getHomes(new Request("http://localhost/api/homes"))
      ).json();
      expect(payload.selectedHomeId).toBe(expected);
      expect(payload.homes[0].id).toBe(expected);
    }
    mocks.listHomes.mockResolvedValue([]);
    const payload = await (
      await getHomes(new Request("http://localhost/api/homes"))
    ).json();
    expect(payload.homes).toEqual([]);
    expect(payload.selectedHomeId).toBe("");
  });

  it("persists authorized switches using the existing cookie", async () => {
    const response = await selectHome(
      request("/api/homes/selected", { homeId: secondId }),
    );
    expect(response.status).toBe(200);
    expect(mocks.homeAccess).toHaveBeenCalledWith(secondId);
    expect(mocks.cookies.set).toHaveBeenCalledWith(
      "homi-selected-home",
      secondId,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 31536000,
      },
    );
    expect(mocks.homeAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookies.set.mock.invocationCallOrder[0],
    );
  });

  it("does not change the cookie for an inaccessible home", async () => {
    mocks.homeAccess.mockRejectedValue(
      new AppError("NOT_FOUND", "Home not found.", 404),
    );
    expect(
      (await selectHome(request("/api/homes/selected", { homeId: secondId })))
        .status,
    ).toBe(404);
    expect(mocks.cookies.set).not.toHaveBeenCalled();
  });

  it("selects a newly created home only after creation succeeds", async () => {
    mocks.createHome.mockResolvedValue(homes[1]);
    expect(
      (await createHome(request("/api/homes", { name: "Second" }))).status,
    ).toBe(201);
    expect(mocks.cookies.set).toHaveBeenCalledWith(
      "homi-selected-home",
      secondId,
      expect.any(Object),
    );
    mocks.cookies.set.mockClear();
    mocks.createHome.mockRejectedValue(
      new AppError("FORBIDDEN", "Cannot create home.", 403),
    );
    expect((await createHome(request("/api/homes", {}))).status).toBe(403);
    expect(mocks.cookies.set).not.toHaveBeenCalled();
  });

  it("selects a joined home after committing membership", async () => {
    mocks.invitation.mockResolvedValue([
      {
        id: "invitation",
        homeId: secondId,
        email: "member@example.test",
        role: "MEMBER",
        invitedBy: "owner",
      },
    ]);
    mocks.transaction.mockImplementation(async (run) =>
      run({
        insert: () => ({ values: () => ({ onConflictDoNothing: vi.fn() }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      }),
    );
    expect(
      (
        await acceptInvitation(
          request("/api/invitations/accept", { token: "x".repeat(40) }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.cookies.set).toHaveBeenCalledWith(
      "homi-selected-home",
      secondId,
      expect.any(Object),
    );
    expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookies.set.mock.invocationCallOrder[0],
    );
  });

  it("does not select a home for an invalid invitation or failed transaction", async () => {
    mocks.invitation.mockResolvedValue([]);
    expect(
      (
        await acceptInvitation(
          request("/api/invitations/accept", { token: "x".repeat(40) }),
        )
      ).status,
    ).toBe(404);
    expect(mocks.cookies.set).not.toHaveBeenCalled();
    mocks.invitation.mockResolvedValue([
      { email: "member@example.test", homeId: secondId },
    ]);
    mocks.transaction.mockRejectedValue(
      new AppError("CONFLICT", "Membership failed.", 409),
    );
    expect(
      (
        await acceptInvitation(
          request("/api/invitations/accept", { token: "x".repeat(40) }),
        )
      ).status,
    ).toBe(409);
    expect(mocks.cookies.set).not.toHaveBeenCalled();
  });
});
