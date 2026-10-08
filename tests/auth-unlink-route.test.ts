import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    safe: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
}));
vi.mock("better-auth/next-js", () => ({
    toNextJsHandler: () => ({ GET: mocks.get, POST: mocks.post }),
}));
vi.mock("../src/server/auth", () => ({
    auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("../src/server/auth/unlink", () => ({
    withSafeAccountUnlink: mocks.safe,
}));
import { POST } from "../app/api/auth/[...all]/route";
afterEach(() => vi.resetAllMocks());
describe("unlink endpoint protection", () => {
    it.each([
        "/api/auth/unlink-account",
        "/api/auth/unlink-account/",
        "/api/auth/%75nlink-account",
        "/api/auth//unlink-account",
    ])("guards normalized unlink path %s", async (path) => {
        mocks.getSession.mockResolvedValue({ user: { id: "current-user" } });
        mocks.safe.mockResolvedValue(Response.json({ status: true }));
        const request = new Request(`http://localhost${path}`, {
            method: "POST",
        });
        await POST(request);
        expect(mocks.safe).toHaveBeenCalledWith(
            request,
            "current-user",
            mocks.post,
        );
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it("delegates unauthenticated unlink requests to Better Auth's own rejection", async () => {
        mocks.getSession.mockResolvedValue(null);
        mocks.post.mockResolvedValue(Response.json({}, { status: 401 }));
        expect(
            (
                await POST(
                    new Request("http://localhost/api/auth/unlink-account", {
                        method: "POST",
                    }),
                )
            ).status,
        ).toBe(401);
        expect(mocks.safe).not.toHaveBeenCalled();
    });
    it("leaves other authentication endpoints unchanged", async () => {
        const request = new Request("http://localhost/api/auth/sign-in/email", {
            method: "POST",
        });
        mocks.post.mockResolvedValue(Response.json({ status: true }));
        await POST(request);
        expect(mocks.post).toHaveBeenCalledWith(request);
        expect(mocks.getSession).not.toHaveBeenCalled();
    });
    it("lets Better Auth handle malformed path encoding", async () => {
        const request = new Request("http://localhost/api/auth/%E0", {
            method: "POST",
        });
        mocks.post.mockResolvedValue(Response.json({}, { status: 404 }));
        expect((await POST(request)).status).toBe(404);
        expect(mocks.getSession).not.toHaveBeenCalled();
    });
});
