import { getRequestActor, requireAdmin } from "@/lib/server/apiAuthorization";
import { DOCUMENTATION_HEADERS, loadAdminDocumentation } from "@/lib/server/adminDocumentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug?: string[] }> };

function protectResponse(response: Response): Response {
  for (const [key, value] of Object.entries(DOCUMENTATION_HEADERS)) response.headers.set(key, value);
  return response;
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    // Do not rely on a hidden link, client role, layout, or Proxy alone. No file read before this check.
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return protectResponse(admin.response);

    const { slug } = await context.params;
    const document = await loadAdminDocumentation(slug);
    if (document === null) return protectResponse(new Response("Not found", { status: 404 }));
    return protectResponse(new Response(document, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  } catch {
    // Fail closed, including when Clerk is unavailable. Never expose file paths or auth errors.
    return protectResponse(new Response("Documentation is temporarily unavailable.", { status: 503 }));
  }
}

export async function HEAD(request: Request, context: Context): Promise<Response> {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
