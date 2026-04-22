import { getWhatsAppConnectionState } from "@/lib/server/meta-whatsapp";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    whatsapp: getWhatsAppConnectionState(),
  });
}
