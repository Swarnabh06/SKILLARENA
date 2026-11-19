import { NextResponse } from "next/server";
import { parseJson, requireApiUser } from "@/lib/auth/guards";
import { contestErrorResponse } from "@/lib/contests/routeHelpers";
import { limitOrNull } from "@/lib/utils/rateLimit";
import { contestSubmitSchema } from "@/lib/validations/algoarena";
import { contestSubmit } from "@/services/contests";

/** POST /api/contests/:slug/submit — judged contest submission (registered students, live contests only). */
export async function POST(request, { params }) {
  const { user, response } = await requireApiUser(request, { roles: ["student"] });
  if (response) return response;
  const limited = limitOrNull(`submit:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const { data, response: invalid } = await parseJson(request, contestSubmitSchema);
  if (invalid) return invalid;
  const { slug } = await params;
  try {
    return NextResponse.json(await contestSubmit(user, slug, data));
  } catch (error) {
    return contestErrorResponse(error, "Couldn't submit your code. Try again.");
  }
}
