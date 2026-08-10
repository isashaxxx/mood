/**
 * NetHunt REST client.
 *
 * Docs: https://nethunt.com/integration-api
 * Auth is HTTP Basic — username is the Gmail address NetHunt runs on,
 * password is the API key from Settings → NetHunt CRM → API key.
 *
 * The zapier-flavoured endpoints return fields keyed by their display NAME
 * ("Бюджет", "Дата - Запит"), not by numeric id. That is what this client
 * expects and what lib/sync.ts reads.
 */

const BASE = "https://nethunt.com/api/v1/zapier";

export type NetHuntRecord = {
  id: string;
  recordId: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
  fields: Record<string, unknown>;
};

function authHeader(): string {
  const email = process.env.NETHUNT_EMAIL;
  const key = process.env.NETHUNT_API_KEY;
  if (!email || !key) throw new Error("NETHUNT_EMAIL / NETHUNT_API_KEY are not set");
  return "Basic " + Buffer.from(`${email}:${key}`).toString("base64");
}

async function get<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    cache: "no-store",
  });

  // NetHunt throttles bursts; back off rather than losing a page mid-sync.
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 750));
    return get<T>(path, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`NetHunt ${res.status} ${res.statusText} on ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export function listFolders() {
  return get<Array<{ id: string; name: string }>>("/triggers/readable-folder");
}

const PAGE = 500;

/**
 * Walks every record in a folder created since `since`.
 *
 * The endpoint is cursor-less: it returns the next `limit` records after
 * `since`, so the cursor is the createdAt of the last record in the batch.
 * Records created within the same millisecond would loop forever, hence the
 * strict "did the cursor move" check.
 */
export async function fetchNewRecords(folderId: string, since: Date): Promise<NetHuntRecord[]> {
  const all: NetHuntRecord[] = [];
  let cursor = since.toISOString();
  const seen = new Set<string>();

  for (let page = 0; page < 200; page++) {
    const batch = await get<NetHuntRecord[]>(
      `/triggers/new-record/${folderId}?since=${encodeURIComponent(cursor)}&limit=${PAGE}`
    );
    if (!batch.length) break;

    let advanced = false;
    for (const r of batch) {
      if (seen.has(r.recordId ?? r.id)) continue;
      seen.add(r.recordId ?? r.id);
      all.push(r);
      if (r.createdAt > cursor) {
        cursor = r.createdAt;
        advanced = true;
      }
    }
    if (!advanced || batch.length < PAGE) break;
  }
  return all;
}

/** Records changed since `since` — the cheap path for incremental syncs. */
export async function fetchUpdatedRecords(folderId: string, since: Date): Promise<NetHuntRecord[]> {
  const all: NetHuntRecord[] = [];
  let cursor = since.toISOString();
  const seen = new Set<string>();

  for (let page = 0; page < 200; page++) {
    const batch = await get<NetHuntRecord[]>(
      `/triggers/updated-record/${folderId}?since=${encodeURIComponent(cursor)}&limit=${PAGE}`
    );
    if (!batch.length) break;

    let advanced = false;
    for (const r of batch) {
      const id = r.recordId ?? r.id;
      if (seen.has(id)) continue;
      seen.add(id);
      all.push(r);
      const ts = r.updatedAt ?? r.createdAt;
      if (ts > cursor) {
        cursor = ts;
        advanced = true;
      }
    }
    if (!advanced || batch.length < PAGE) break;
  }
  return all;
}
