import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";

/**
 * The dashboard is intentionally an Excel snapshot now. File-upload refresh
 * will be added as a separate authenticated flow; until then this endpoint
 * must not call NetHunt or any third-party service.
 */
export async function POST(req: Request) {
  if (!(await userFromRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Оновлення через завантаження Excel-файлів буде додано пізніше." },
    { status: 501 }
  );
}

export const GET = POST;
