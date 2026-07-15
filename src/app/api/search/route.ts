import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({ query: z.string().min(1).max(500) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // ponytail: RAG over Upstash Vector lands when ingestion exists. Stub honestly.
  return NextResponse.json(
    { error: "Code search not implemented yet", query: parsed.data.query },
    { status: 501 },
  );
}
