import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";
import { userFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
// The 2026 Inbound rebuild is bounded to one reporting year and stays within
// the Hobby function limit. It is triggered explicitly from the dashboard.
export const maxDuration = 60;

async function authorised(req: Request): Promise<boolean> {
  if (await userFromRequest(req)) return true;
  const secrets = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (!secrets.length) return false;
  // The dashboard button uses its secure session cookie; Vercel Cron sends
  // CRON_SECRET as a bearer token.
  const header = req.headers.get("authorization");
  return secrets.some((secret) => header === `Bearer ${secret}`);
}

export async function POST(req: Request) {
  if (!(await authorised(req))) {
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
