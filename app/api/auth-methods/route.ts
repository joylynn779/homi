import { requireVerifiedUser } from "@/src/server/authorization";
import { getSignInMethods } from "@/src/server/auth/methods";
import { errorResponse, requestId } from "@/src/server/http";

export async function GET(request: Request) {
    const id = requestId(request);
    try {
        const session = await requireVerifiedUser();
        return Response.json(
            {
                email: session.user.email,
                methods: await getSignInMethods(session.user.id),
                requestId: id,
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        return errorResponse(error, id);
    }
}
