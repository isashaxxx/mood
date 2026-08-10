import { NextResponse } from "next/server";
import { authenticate, createSession, sessionCookie, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невірний формат запиту" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Невірний формат запиту" }, { status: 400 });
  }

  const user = authenticate(body.username, body.password);
  if (!user) {
    return NextResponse.json({ error: "Невірний логін або пароль" }, { status: 401 });
  }

  try {
    const response = NextResponse.json({ ok: true, user });
    response.cookies.set(SESSION_COOKIE, await createSession(user), sessionCookie);
    return response;
  } catch (error) {
    console.error("Unable to create auth session", error);
    return NextResponse.json({ error: "Авторизація тимчасово недоступна" }, { status: 503 });
  }
}
