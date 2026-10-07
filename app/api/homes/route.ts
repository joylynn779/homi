import { cookies } from "next/headers";
import { resolveSelectedHomeId, selectedHomeCookie } from "@/src/features/homes/selection";
import { requireVerifiedUser } from "@/src/server/authorization";
import { errorResponse, requestId } from "@/src/server/http";
import { createHome, listHomes } from "@/src/server/services/homes";
import { setSelectedHomeId } from "@/src/server/services/home-selection";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const homes = await listHomes(session.user.id);
    const selectedId = resolveSelectedHomeId(
      homes,
      (await cookies()).get(selectedHomeCookie)?.value,
    );
    return Response.json({
      homes: [...homes].sort((a, b) =>
        a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0,
      ),
      selectedHomeId: selectedId,
      requestId: id,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireVerifiedUser();
    const home = await createHome(session.user.id, await request.json());
    await setSelectedHomeId(home.id);
    return Response.json({ home, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
