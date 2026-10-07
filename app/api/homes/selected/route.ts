import { z } from "zod";
import { requireHomeAccess } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { setSelectedHomeId } from "@/src/server/services/home-selection";

const input = z.object({ homeId: z.string().uuid() });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const { homeId } = input.parse(await request.json());
    await requireHomeAccess(homeId);
    await setSelectedHomeId(homeId);
    return Response.json({ homeId, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
