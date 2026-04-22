import { sendWhatsAppTextMessage } from "@/lib/server/meta-whatsapp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    to?: string;
    text?: string;
    previewUrl?: boolean;
    contextMessageId?: string;
  };

  if (!body.to?.trim()) {
    return Response.json({ error: "Destination phone is required." }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return Response.json({ error: "Message text is required." }, { status: 400 });
  }

  try {
    const result = await sendWhatsAppTextMessage({
      to: body.to.trim(),
      text: body.text.trim(),
      previewUrl: body.previewUrl,
      contextMessageId: body.contextMessageId,
    });

    return Response.json({
      ok: true,
      wamid: result.wamid,
      raw: result.raw,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "WhatsApp send failed.",
      },
      { status: 502 },
    );
  }
}
