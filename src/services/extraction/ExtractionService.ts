/**
 * Server-side PDF/AI extraction. Sends the uploaded PDF directly to Claude as a native
 * document block (no local PDF parsing) and asks for structured price/product data.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface PriceEntry {
  code: string;
  eur: number;
  dims?: string;
}

const SYSTEM = `You extract product pricing from Atelier Vierkant price-list PDFs.
Return ONLY valid JSON of the form {"entries":[{"code":"AU80","eur":748,"dims":"a=72cm · h=80cm"}]}.
- code: the model code exactly as printed (e.g. AU80, LEDA90).
- eur: the EUR price as a number (no currency symbol, no thousands separators).
- dims: dimensions/weight string if present, else omit.
Include every priced model you can find. Do not invent prices.`;

export async function extractPriceList(base64Pdf: string): Promise<PriceEntry[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
          },
          { type: "text", text: "Extract all model codes and EUR prices as JSON." },
        ],
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { entries?: PriceEntry[] };
    return (parsed.entries ?? []).filter((e) => e.code && typeof e.eur === "number");
  } catch {
    return [];
  }
}
