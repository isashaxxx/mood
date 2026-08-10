import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";

export const runtime = "nodejs";
// Vercel Hobby allows a maximum 60-second function. The initial full import is
// deliberately run with scripts/sync-cli.ts locally; Vercel only runs deltas.
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secrets = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (!secrets.length) return false;
  // The dashboard button uses SYNC_SECRET; Vercel Cron sends CRON_SECRET as a bearer token.
  const header = req.headers.get("authorization");
  return secrets.some((secret) => header === `Bearer ${secret}`);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1";
  const trigger = url.searchParams.get("cron") === "1" ? "cron" : "manual";

  if (full && process.env.VERCEL) {
    return NextResponse.json(
      { error: "Повний імпорт запускайте локально: npx tsx scripts/sync-cli.ts --full" },
      { status: 400 }
    );
  }

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
