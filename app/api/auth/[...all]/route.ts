import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/server/auth";
import { withSafeAccountUnlink } from "@/src/server/auth/unlink";

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
    let path: string;
    try {
        path = decodeURIComponent(new URL(request.url).pathname)
            .replace(/\/+/g, "/")
            .replace(/\/$/, "");
    } catch {
        return handlers.POST(request);
    }
    if (path === "/api/auth/unlink-account") {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session)
            return withSafeAccountUnlink(
                request,
                session.user.id,
                handlers.POST,
            );
    }
    return handlers.POST(request);
}
