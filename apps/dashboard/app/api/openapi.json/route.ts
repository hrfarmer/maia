import { buildOpenApiDocument } from "@/lib/api/openapi/document";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const serverUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? requestUrl.origin;
  const document = buildOpenApiDocument(serverUrl);
  return Response.json(document, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
