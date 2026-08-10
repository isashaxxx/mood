import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300; // a cold full sync walks every folder page

function authorised(req: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  // Vercel cron sends its own bearer; the UI button sends the shared secret.
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (url.searchParams.get("cron") === "1" && req.headers.get("x-vercel-cron")) return true;
  return false;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";
  const trigger = url.searchParams.get("cron") === "1" ? "cron" : "manual";

  try {
    const result = await runSync({ trigger, full });
    revalidatePath("/");
    return NextResponse.json({ ok: true, ...result, finishedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Vercel cron issues GET requests.
export const GET = POST;
