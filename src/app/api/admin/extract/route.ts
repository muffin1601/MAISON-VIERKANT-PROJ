import { NextResponse } from "next/server";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { extractPriceList } from "@/services/extraction/ExtractionService";

export const maxDuration = 60;

/** Upload an Atelier Vierkant price-list PDF → Claude extracts EUR prices. */
export async function POST(req: Request) {
  try {
    await requirePermission("pricing.manage");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { message: "No PDF uploaded" } }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let entries;
  try {
    entries = await extractPriceList(base64);
  } catch (e) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Extraction failed" } },
      { status: 500 },
    );
  }

  // Record the upload for audit.
  try {
    await prisma.uploadedFile.create({
      data: {
        kind: "PRICE_LIST",
        url: "",
        filename: file.name,
        parseStatus: "DONE",
        parsedJson: { entries: entries.map((e) => ({ ...e })) } as object as never,
      },
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ data: { entries, count: entries.length } });
}
