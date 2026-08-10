"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SOURCE_COLORS } from "@/lib/taxonomy";

type SourceRow = {
  source: string;
  pipeline: number;
  pipelineCount: number;
  won: number;
  wonCount: number;
  lost: number;
  lostCount: number;
  avgCycleDays: number | null;
};
type MonthRow = SourceRow & { month: string };
type LeadRow = {
  month: string; channel: string; source: string; total: number;
  nql: number; iql: number; mql: number; sql_: number;
  junk: number; toSales: number; handlingHours: number | null; handlingCount: number;
};
type BudgetRow = { month: string; channel: string; amountUah: number; amountUsd: number | null; fxRate: number | null };
type MetaRow = { month: string; spendUsd: number; impressions: number; reach: number; clicks: number; conversations: number };
type Payload = {
  margin: number; currentMonth: string;
  bySource: SourceRow[]; byMonth: MonthRow[]; leads: LeadRow[];
  budget: BudgetRow[]; meta: MetaRow[];
  sync: { finishedAt: string | null; status: string; dealsUpserted: number; leadsUpserted: number; unknownSources: string[] } | null;
};

const MN: Record<string, string> = {
  "01": "Січ", "02": "Лют", "03": "Бер", "04": "Кві", "05": "Тра", "06": "Чер",
  "07": "Лип", "08": "Сер", "09": "Вер", "10": "Жов", "11": "Лис", "12": "Гру",
};
const label = (m: string) => MN[m.slice(5, 7)] ?? m;
const uah = (n: number) => Math.round(n).toLocaleString("uk-UA").replace(/[,\u00A0]/g, " ");
const short = (n: number) =>
  Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + " млн" : Math.abs(n) >= 1e3 ? uah(n / 1e3) + "k" : uah(n);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const colour = (s: string) => SOURCE_COLORS[s] ?? "#D9DEE4";
const SPEND_LABEL: Record<string, string> = {
  meta: "Meta", google_ads: "Google PPC", seo: "SEO", specialist: "Спеціаліст",
};

type View = "db" | "ld" | "dl" | "sr";
const VIEWS: Array<[View, string]> = [
  ["db", "Dashboard"], ["ld", "Ліди"], ["dl", "Угоди"], ["sr", "Джерела"],
];

export default function Dashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<View>("db");
  const [allTime, setAllTime] = useState(false);
  const [months, setMonths] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      const json = await res.json().catch(() => null) as Payload | { error?: string } | null;
      if (!res.ok || !json || !("currentMonth" in json)) {
        throw new Error((json && "error" in json && json.error) || `Помилка завантаження (${res.status})`);
      }
      setData(json);
      return json;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не вдалося завантажити дані";
      setLoadError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((json) => {
      // Default view is the month in progress — that is what anyone opening
      // this at 9am actually wants to see.
      setMonths(new Set([json.currentMonth]));
    }).catch(() => undefined);
  }, [load]);

  const allMonths = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>([...data.byMonth.map((r) => r.month), ...data.leads.map((r) => r.month)]);
    return [...s].sort();
  }, [data]);
  const allSources = useMemo(
    () => (data ? [...new Set([...data.bySource.map((r) => r.source), ...data.leads.map((r) => r.source)])].sort() : []),
    [data]
  );
  const allChannels = useMemo(
    () => (data ? [...new Set(data.leads.map((r) => r.channel))].sort() : []),
    [data]
  );

  const activeMonths = useMemo(
    () => (allTime || !months.size ? new Set(allMonths) : months),
    [allTime, months, allMonths]
  );
  const activeSources = useMemo(
    () => (sources.size ? sources : new Set(allSources)),
    [sources, allSources]
  );
  const activeChannels = useMemo(
    () => (channels.size ? channels : new Set(allChannels)),
    [channels, allChannels]
  );

  async function refresh() {
    setSyncing(true);
    setFlash(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SYNC_TOKEN ?? ""}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "sync failed");
      await load();
      const unknown: string[] = json.unknownSources ?? [];
      setFlash(
        `Оновлено: ${json.dealsUpserted} угод, ${json.leadsUpserted} лідів.` +
          (unknown.length ? ` Нові значення джерела: ${unknown.join(", ")}` : "")
      );
    } catch (e) {
      setFlash(`Не вдалося оновити: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  const deals = useMemo(
    () => (data?.byMonth ?? []).filter((r) => activeMonths.has(r.month) && activeSources.has(r.source)),
    [data, activeMonths, activeSources]
  );
  const leadRows = useMemo(
    () =>
      (data?.leads ?? []).filter(
        (r) => activeMonths.has(r.month) && activeSources.has(r.source) && activeChannels.has(r.channel)
      ),
    [data, activeMonths, activeSources, activeChannels]
  );
  const spendRows = useMemo(
    () => (data?.budget ?? []).filter((r) => activeMonths.has(r.month)),
    [data, activeMonths]
  );

  const totals = useMemo(() => {
    const won = deals.reduce((s, r) => s + r.won, 0);
    const wonCount = deals.reduce((s, r) => s + r.wonCount, 0);
    const lostCount = deals.reduce((s, r) => s + r.lostCount, 0);
    const pipeline = deals.reduce((s, r) => s + r.pipeline, 0);
    const pipelineCount = deals.reduce((s, r) => s + r.pipelineCount, 0);
    const lost = deals.reduce((s, r) => s + r.lost, 0);
    const cost = spendRows.reduce((s, r) => s + r.amountUah, 0);
    const margin = data?.margin ?? 0.1526;
    return { won, wonCount, lostCount, pipeline, pipelineCount, lost, cost, profit: won * margin, margin };
  }, [deals, spendRows, data]);

  if (loading && !data) {
    return (
      <div className="app">
        <Sidebar view={view} setView={setView} />
        <main>
          <div className="crumbs">Аналітика <span>/</span> <b>Dashboard</b></div>
          <div className="kpis">{[...Array(8)].map((_, i) => <div key={i} className="skeleton" />)}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <Sidebar view={view} setView={setView} />
        <main className="error-state">
          <div className="crumbs">Аналітика <span>/</span> <b>Dashboard</b></div>
          <h1>Дані поки недоступні</h1>
          <p>{loadError ?? "Не вдалося підключитися до бази даних."}</p>
          <button className="refresh" onClick={() => load().catch(() => undefined)} disabled={loading}>
            {loading ? "Завантажую…" : "Спробувати ще раз"}
          </button>
        </main>
      </div>
    );
  }

  const stamp = data?.sync?.finishedAt
    ? new Date(data.sync.finishedAt).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })
    : "ще не синхронізовано";

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} />
      <main>
        <div className="crumbs">
          Аналітика <span>/</span> <b>{VIEWS.find(([v]) => v === view)?.[1]}</b>
          <span className="right">
            <span>Оновлено {stamp}</span>
            <button className="refresh" onClick={refresh} disabled={syncing}>
              {syncing && <span className="spin" aria-hidden />}
              {syncing ? "Оновлюю…" : "Оновити"}
            </button>
          </span>
        </div>
        {flash && <div className="warn" role="status">{flash}</div>}

        <div className="filters">
          <div className="fg">
            <div className="fl">Період</div>
            <div className="chips">
              <button className="chip act" aria-pressed={!allTime}
                onClick={(e) => { e.currentTarget.blur(); setAllTime(false); setMonths(new Set([data!.currentMonth])); }}>
                Поточний місяць
              </button>
              <button className="chip act" aria-pressed={allTime}
                onClick={(e) => { e.currentTarget.blur(); setAllTime(true); }}>
                За весь період
              </button>
            </div>
          </div>
          <Chips label="Місяць" items={allMonths} sel={activeMonths} cls=""
            render={label}
            toggle={(m) => { setAllTime(false); setMonths(toggle(activeMonths, m, allMonths)); }} />
          <Chips label="Джерело" items={allSources} sel={activeSources} cls="s"
            toggle={(s) => setSources(toggle(activeSources, s, allSources))} />
          {view === "ld" && (
            <Chips label="Канал" items={allChannels} sel={activeChannels} cls="c"
              toggle={(c) => setChannels(toggle(activeChannels, c, allChannels))} />
          )}
        </div>

        {view === "db" && <DashboardView deals={deals} leads={leadRows} spend={spendRows} totals={totals} months={[...activeMonths].sort()} />}
        {view === "ld" && <LeadsView leads={leadRows} />}
        {view === "dl" && <DealsView deals={deals} spend={spendRows} margin={totals.margin} months={[...activeMonths].sort()} />}
        {view === "sr" && <SourcesView deals={deals} spend={spendRows} meta={data!.meta.filter((m) => activeMonths.has(m.month))} margin={totals.margin} />}
      </main>
    </div>
  );
}

function toggle(cur: Set<string>, v: string, all: string[]): Set<string> {
  const next = new Set(cur);
  next.has(v) ? next.delete(v) : next.add(v);
  return next.size ? next : new Set(all);
}

function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <aside className="sidebar">
      <div className="logo"><b /> MOODua</div>
      <div className="navlbl">Аналітика</div>
      <nav className="nav">
        {VIEWS.map(([v, name]) => (
          <button key={v} aria-current={view === v ? "page" : undefined}
            onClick={(e) => { e.currentTarget.blur(); setView(v); }}>
            {name}
          </button>
        ))}
      </nav>
      <div className="navlbl">Дані</div>
      <div className="nav">
        <button className="static" type="button">NetHunt CRM</button>
        <button className="static" type="button">Meta Ads</button>
        <button className="static" type="button">Бюджет</button>
      </div>
    </aside>
  );
}

function Chips({ label: title, items, sel, cls, toggle: onToggle, render }: {
  label: string; items: string[]; sel: Set<string>; cls: string;
  toggle: (v: string) => void; render?: (v: string) => string;
}) {
  return (
    <div className="fg">
      <div className="fl">{title}</div>
      <div className="chips">
        {items.map((v) => (
          <button key={v} className={`chip ${cls}`} aria-pressed={sel.has(v)}
            onClick={(e) => { e.currentTarget.blur(); onToggle(v); }}>
            {render ? render(v) : v}
          </button>
        ))}
      </div>
    </div>
  );
}

function Kpis({ items }: { items: Array<[string, string, string, string?, string?]> }) {
  return (
    <div className="kpis">
      {items.map(([k, v, d, tone, bg]) => (
        <div key={k} className="kpi" style={{ background: bg ?? "var(--peri)" }}>
          <div className="k">{k}</div>
          <div className="row">
            <div className="v">{v}</div>
            <div className={`d ${tone ?? ""}`}>{d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function byKey<T extends { [k: string]: unknown }>(rows: T[], key: keyof T, adds: Array<keyof T>) {
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = String(r[key]);
    const cur = map.get(k) ?? Object.fromEntries(adds.map((a) => [a as string, 0]));
    for (const a of adds) cur[a as string] += Number(r[a] ?? 0);
    map.set(k, cur);
  }
  return map;
}

/* ------------------------------- Dashboard ------------------------------- */
function DashboardView({ deals, leads, spend, totals, months }: {
  deals: MonthRow[]; leads: LeadRow[]; spend: BudgetRow[];
  totals: ReturnType<typeof Object> & Record<string, number>; months: string[];
}) {
  const romi = totals.cost ? (totals.profit / totals.cost) * 100 : 0;
  const leadTotal = leads.reduce((s, r) => s + r.total, 0);
  const perMonth = months.map((m) => ({
    m,
    won: deals.filter((r) => r.month === m).reduce((s, r) => s + r.won, 0),
    cost: spend.filter((r) => r.month === m).reduce((s, r) => s + r.amountUah, 0),
  }));
  const src = byKey(deals, "source", ["won", "wonCount", "pipeline"]);

  return (
    <>
      <h2 className="t">Ключові показники</h2>
      <Kpis items={[
        ["Виручка", short(totals.won) + " ₴", `${totals.wonCount} угод`, "", "var(--blue)"],
        ["Витрати", uah(totals.cost) + " ₴", "реклама + ведення", "", "var(--peri)"],
        ["Прибуток", short(totals.profit) + " ₴", `маржа ${(totals.margin * 100).toFixed(2)}%`, totals.profit > totals.cost ? "up" : "dn", "var(--blue)"],
        ["ROMI", totals.cost ? Math.round(romi) + "%" : "—", "поріг 100%", romi >= 100 ? "up" : "dn", "var(--peri)"],
        ["Пайплайн", short(totals.pipeline) + " ₴", `${totals.pipelineCount} угод у когорті`, "", "var(--peri)"],
        ["Win rate", pct(totals.wonCount, totals.wonCount + totals.lostCount).toFixed(0) + "%", `${totals.lostCount} програно`, "", "var(--blue)"],
        ["Середній чек", totals.wonCount ? uah(totals.won / totals.wonCount) + " ₴" : "—", "новий клієнт", "", "var(--peri)"],
        ["Лідів", uah(leadTotal), "з 13.06.2026", "", "var(--blue)"],
      ]} />

      <div className="grid g21">
        <div className="card">
          <div className="ch">Виручка та витрати <small>по місяцю запиту</small></div>
          <LineChart data={perMonth} />
        </div>
        <div className="card">
          <div className="ch">Виручка за джерелами</div>
          <Donut rows={[...src].map(([k, v]) => [k, v.won] as [string, number])} />
        </div>
      </div>

      <div className="grid g11">
        <div className="card">
          <div className="ch">Витрати за каналами</div>
          <Bars rows={[...byKey(spend, "channel", ["amountUah"])].map(([k, v]) => [SPEND_LABEL[k] ?? k, v.amountUah] as [string, number])} />
        </div>
        <div className="card">
          <div className="ch">Наскрізна воронка</div>
          <Funnel steps={[
            ["Ліди", leadTotal],
            ["MQL+SQL", leads.reduce((s, r) => s + r.mql + r.sql_, 0)],
            ["Запити в CRM", totals.pipelineCount],
            ["Виграно", totals.wonCount],
          ]} />
          <div className="note">
            Угода зараховується в місяць, коли надійшов запит, а не коли закрилась.
            Аутбаунд виключено з усіх розрахунків.
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------------- Leads --------------------------------- */
function LeadsView({ leads }: { leads: LeadRow[] }) {
  const total = leads.reduce((s, r) => s + r.total, 0);
  const mql = leads.reduce((s, r) => s + r.mql, 0);
  const sq = leads.reduce((s, r) => s + r.sql_, 0);
  const junk = leads.reduce((s, r) => s + r.junk, 0);
  const toSales = leads.reduce((s, r) => s + r.toSales, 0);
  const hSum = leads.reduce((s, r) => s + (r.handlingHours ?? 0) * r.handlingCount, 0);
  const hN = leads.reduce((s, r) => s + r.handlingCount, 0);
  const dur = (h: number) => (h < 24 ? `${Math.round(h)} год` : `${(h / 24).toFixed(1)} дн`);

  const table = (key: "channel" | "source", title: string, lastCol: "time" | "sales") => {
    const map = byKey(leads, key, ["total", "mql", "sql_", "junk", "toSales", "handlingCount"]);
    const hours = new Map<string, number>();
    for (const r of leads) {
      hours.set(String(r[key]), (hours.get(String(r[key])) ?? 0) + (r.handlingHours ?? 0) * r.handlingCount);
    }
    const rows = [...map].sort((a, b) => b[1].total - a[1].total);
    return (
      <div className="card">
        <div className="ch">{title}</div>
        <table>
          <thead>
            <tr>
              <th>{key === "channel" ? "Канал" : "Джерело"}</th><th>Лідів</th><th>MQL</th><th>SQL</th>
              <th>MQL→SQL</th><th>Спам-рейт</th><th>{lastCol === "time" ? "Сер. обробка" : "У Sales"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">Немає даних</td></tr>}
            {rows.map(([k, v]) => {
              const conv = pct(v.sql_, v.mql + v.sql_);
              const spam = pct(v.junk, v.total);
              const h = v.handlingCount ? (hours.get(k) ?? 0) / v.handlingCount : null;
              return (
                <tr key={k}>
                  <td><span className="dotc" style={{ background: colour(k) }} />{k}</td>
                  <td>{v.total}</td><td>{v.mql}</td><td>{v.sql_}</td>
                  <td><span className={`tag ${v.mql + v.sql_ ? (conv >= 60 ? "g" : conv >= 30 ? "y" : "r") : "n"}`}>
                    {v.mql + v.sql_ ? conv.toFixed(0) + "%" : "—"}</span></td>
                  <td><span className={`tag ${spam >= 60 ? "r" : spam >= 25 ? "y" : "g"}`}>{spam.toFixed(0)}%</span></td>
                  <td>{lastCol === "time" ? (h === null ? "—" : dur(h)) : v.toSales}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <h2 className="t">Ліди</h2>
      <Kpis items={[
        ["Всього лідів", uah(total), "", "", "var(--blue)"],
        ["MQL → SQL", mql + sq ? pct(sq, mql + sq).toFixed(0) + "%" : "—", `${mql} MQL · ${sq} SQL`, "", "var(--peri)"],
        ["Спам-рейт", total ? pct(junk, total).toFixed(0) + "%" : "—", `${uah(junk)} нецільових`, pct(junk, total) > 50 ? "dn" : "", "var(--blue)"],
        ["Сер. час обробки", hN ? dur(hSum / hN) : "—", `${uah(hN)} лідів`, "", "var(--peri)"],
        ["Передано Sales", uah(toSales), total ? pct(toSales, total).toFixed(0) + "% від лідів" : "", "", "var(--peri)"],
        ["SQL", uah(sq), total ? pct(sq, total).toFixed(0) + "% від лідів" : "", "", "var(--blue)"],
        ["Каналів", String(new Set(leads.map((r) => r.channel)).size), "активних", "", "var(--blue)"],
        ["З атрибуцією", String(new Set(leads.filter((r) => r.source !== "Не вказано").map((r) => r.source)).size), "джерел", "", "var(--peri)"],
      ]} />
      <div className="grid g11">
        {table("channel", "За каналом звернення", "time")}
        {table("source", "За джерелом", "sales")}
      </div>
      <div className="note">
        Середній час обробки — проміжок від створення картки до останньої зміни. Окремого поля
        «дата передачі в Sales» у NetHunt немає; щойно воно з’явиться, показник стане точним.
      </div>
    </>
  );
}

/* --------------------------------- Deals --------------------------------- */
function DealsView({ deals, spend, margin, months }: {
  deals: MonthRow[]; spend: BudgetRow[]; margin: number; months: string[];
}) {
  const [sortKey, setSortKey] = useState<string>("won");
  const [dir, setDir] = useState(-1);
  const costBySource = new Map<string, number>();
  for (const r of spend) {
    const src = { meta: "Instagram Paid", google_ads: "Google PPC", seo: "Google Organic" }[r.channel];
    if (src) costBySource.set(src, (costBySource.get(src) ?? 0) + r.amountUah);
  }
  const map = byKey(deals, "source", ["pipeline", "pipelineCount", "won", "wonCount", "lost", "lostCount"]);
  const rows = [...map].map(([source, v]) => {
    const cost = costBySource.get(source) ?? 0;
    const cycles = deals.filter((d) => d.source === source && d.avgCycleDays !== null);
    return {
      source,
      pipeline: v.pipeline,
      pipelineCount: v.pipelineCount,
      won: v.won,
      wonCount: v.wonCount,
      lost: v.lost,
      lostCount: v.lostCount,
      cost,
      winrate: pct(v.wonCount, v.wonCount + v.lostCount),
      avg: v.wonCount ? v.won / v.wonCount : 0,
      cycle: cycles.length ? cycles.reduce((s, c) => s + (c.avgCycleDays ?? 0), 0) / cycles.length : null,
      cac: v.wonCount && cost ? cost / v.wonCount : null,
      romi: cost ? (v.won * margin) / cost * 100 : null,
    };
  });
  rows.sort((a, b) => (((a as never as Record<string, number>)[sortKey] ?? -1) > ((b as never as Record<string, number>)[sortKey] ?? -1) ? 1 : -1) * dir);
  const t = rows.reduce((s, r) => ({
    pipeline: s.pipeline + r.pipeline, pipelineCount: s.pipelineCount + r.pipelineCount,
    won: s.won + r.won, wonCount: s.wonCount + r.wonCount, lost: s.lost + r.lost,
    lostCount: s.lostCount + r.lostCount, cost: s.cost + r.cost,
  }), { pipeline: 0, pipelineCount: 0, won: 0, wonCount: 0, lost: 0, lostCount: 0, cost: 0 });
  const totalCost = spend.reduce((s, r) => s + r.amountUah, 0);

  const th = (k: string, name: string) => (
    <th className="sortable" onClick={() => { sortKey === k ? setDir(-dir) : (setSortKey(k), setDir(-1)); }}>{name}</th>
  );

  return (
    <>
      <h2 className="t">Угоди · когорта за датою запиту</h2>
      <Kpis items={[
        ["Запитів", uah(t.pipelineCount), short(t.pipeline) + " ₴ пайплайн", "", "var(--peri)"],
        ["Виграно", uah(t.wonCount), `win rate ${pct(t.wonCount, t.wonCount + t.lostCount).toFixed(0)}%`, "", "var(--blue)"],
        ["Програно", uah(t.lostCount), short(t.lost) + " ₴ втрачено", "dn", "var(--peri)"],
        ["Виручка", short(t.won) + " ₴", "нові клієнти", "", "var(--blue)"],
        ["Середній чек", t.wonCount ? uah(t.won / t.wonCount) + " ₴" : "—", "", "", "var(--peri)"],
        ["Прибуток", short(t.won * margin) + " ₴", `маржа ${(margin * 100).toFixed(2)}%`, "", "var(--blue)"],
        ["Витрати", uah(totalCost) + " ₴", "усі канали", "", "var(--peri)"],
        ["CAC", t.wonCount && totalCost ? uah(totalCost / t.wonCount) + " ₴" : "—", "", "", "var(--blue)"],
      ]} />
      <div className="grid">
        <div className="card">
          <div className="ch">За джерелом</div>
          <table>
            <thead><tr>
              {th("source", "Джерело")}{th("pipelineCount", "Запитів")}{th("wonCount", "Виграно")}
              {th("lostCount", "Програно")}{th("winrate", "Win rate")}{th("won", "Виручка")}
              {th("avg", "Сер. чек")}{th("cycle", "Цикл, дн.")}{th("cost", "Витрати")}
              {th("cac", "CAC")}{th("romi", "ROMI")}{th("lost", "Втрачено")}
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} className="empty">Немає даних за фільтром</td></tr>}
              {rows.map((r) => (
                <tr key={r.source}>
                  <td><span className="dotc" style={{ background: colour(r.source) }} />{r.source}</td>
                  <td>{r.pipelineCount}</td><td>{r.wonCount}</td><td>{r.lostCount}</td>
                  <td><span className={`tag ${r.wonCount + r.lostCount ? (r.winrate >= 32 ? "g" : r.winrate >= 20 ? "y" : "r") : "n"}`}>
                    {r.wonCount + r.lostCount ? r.winrate.toFixed(0) + "%" : "—"}</span></td>
                  <td>{uah(r.won)}</td><td>{uah(r.avg)}</td>
                  <td>{r.cycle === null ? "—" : r.cycle.toFixed(0)}</td>
                  <td>{r.cost ? uah(r.cost) : "—"}</td>
                  <td>{r.cac ? uah(r.cac) : "—"}</td>
                  <td>{r.romi === null ? "—" : <span className={`tag ${r.romi >= 100 ? "g" : "r"}`}>{Math.round(r.romi)}%</span>}</td>
                  <td style={{ color: "var(--red)" }}>{uah(r.lost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td>Разом</td><td>{t.pipelineCount}</td><td>{t.wonCount}</td><td>{t.lostCount}</td>
              <td>{pct(t.wonCount, t.wonCount + t.lostCount).toFixed(0)}%</td>
              <td>{uah(t.won)}</td><td>{t.wonCount ? uah(t.won / t.wonCount) : "—"}</td><td>—</td>
              <td>{uah(totalCost)}</td><td>{t.wonCount && totalCost ? uah(totalCost / t.wonCount) : "—"}</td>
              <td>{totalCost ? Math.round((t.won * margin) / totalCost * 100) + "%" : "—"}</td>
              <td style={{ color: "var(--red)" }}>{uah(t.lost)}</td>
            </tr></tfoot>
          </table>
          <div className="note">
            Прибуток = виручка × {(margin * 100).toFixed(2)}%. ROMI = прибуток ÷ витрати, поріг окупності 100%.
            Оплата спеціаліста не рознесена по каналах і входить лише в загальний підсумок.
          </div>
        </div>
      </div>
      <div className="grid">
        <div className="card">
          <div className="ch">По місяцях</div>
          <table>
            <thead><tr><th>Місяць</th><th>Запитів</th><th>Пайплайн</th><th>Виграно</th><th>Програно</th>
              <th>Win rate</th><th>Виручка</th><th>Сер. чек</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const r = deals.filter((d) => d.month === m);
                const w = r.reduce((s, x) => s + x.wonCount, 0);
                const l = r.reduce((s, x) => s + x.lostCount, 0);
                const rev = r.reduce((s, x) => s + x.won, 0);
                return (
                  <tr key={m}>
                    <td>{label(m)}</td>
                    <td>{r.reduce((s, x) => s + x.pipelineCount, 0)}</td>
                    <td>{uah(r.reduce((s, x) => s + x.pipeline, 0))}</td>
                    <td>{w}</td><td>{l}</td>
                    <td>{w + l ? pct(w, w + l).toFixed(0) + "%" : "—"}</td>
                    <td>{uah(rev)}</td><td>{w ? uah(rev / w) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* -------------------------------- Sources -------------------------------- */
function SourcesView({ deals, spend, meta, margin }: {
  deals: MonthRow[]; spend: BudgetRow[]; meta: MetaRow[]; margin: number;
}) {
  const metaSpend = spend.filter((r) => r.channel === "meta").reduce((s, r) => s + r.amountUah, 0);
  const gadsSpend = spend.filter((r) => r.channel === "google_ads").reduce((s, r) => s + r.amountUah, 0);
  const seoSpend = spend.filter((r) => r.channel === "seo").reduce((s, r) => s + r.amountUah, 0);
  const conv = meta.reduce((s, r) => s + r.conversations, 0);
  const igAll = deals.filter((d) => d.source.startsWith("Instagram")).reduce((s, d) => s + d.won, 0);
  const igPaid = deals.filter((d) => d.source === "Instagram Paid").reduce((s, d) => s + d.won, 0);
  const ppc = deals.filter((d) => d.source === "Google PPC");
  const org = deals.filter((d) => d.source === "Google Organic");
  const ppcWon = ppc.reduce((s, d) => s + d.won, 0);
  const orgWon = org.reduce((s, d) => s + d.won, 0);
  const months = [...new Set(deals.map((d) => d.month))].sort();

  return (
    <>
      <h2 className="t">Джерела</h2>
      <div className="grid g11">
        <div className="card">
          <div className="ch">Meta Ads <small>Instagram Paid</small></div>
          <Kpis items={[
            ["Витрати", uah(metaSpend) + " ₴", "", "", "var(--lav)"],
            ["Розмов", uah(conv), "", "", "var(--peri)"],
            ["CPL", conv ? uah(metaSpend / conv) + " ₴" : "—", "за розмову", "", "var(--lav)"],
            ["ROMI стеля", metaSpend ? Math.round((igAll * margin) / metaSpend * 100) + "%" : "—",
              "якщо весь IG платний", igAll * margin >= metaSpend ? "up" : "dn", "var(--peri)"],
          ]} />
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Місяць</th><th>Бюджет $</th><th>Курс</th><th>Бюджет ₴</th>
              <th>Покази</th><th>Кліки</th><th>Розмов</th><th>CPL ₴</th></tr></thead>
            <tbody>
              {meta.map((m) => {
                const b = spend.find((s) => s.month === m.month && s.channel === "meta");
                const uahSpend = b?.amountUah ?? 0;
                return (
                  <tr key={m.month}>
                    <td>{label(m.month)}</td><td>{m.spendUsd ? uah(m.spendUsd) + "$" : "—"}</td>
                    <td>{b?.fxRate?.toFixed(2) ?? "—"}</td><td>{uahSpend ? uah(uahSpend) : "—"}</td>
                    <td>{uah(m.impressions)}</td><td>{uah(m.clicks)}</td><td>{m.conversations}</td>
                    <td>{uahSpend && m.conversations ? uah(uahSpend / m.conversations) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="warn">
            Виручка з джерелом <b>Instagram Paid</b> у CRM: <b>{uah(igPaid)} ₴</b>. Уся виручка
            Instagram разом — <b>{uah(igAll)} ₴</b>. Доки в довіднику угод немає опції
            Instagram&nbsp;Paid, точний ROMI по Meta порахувати неможливо; «ROMI стеля» показує
            верхню межу.
          </div>
        </div>

        <div className="card">
          <div className="ch">Google <small>PPC та Organic</small></div>
          <Kpis items={[
            ["PPC витрати", uah(gadsSpend) + " ₴", "", "", "var(--peri)"],
            ["PPC виручка", uah(ppcWon) + " ₴", `${ppc.reduce((s, d) => s + d.wonCount, 0)} угод`, ppcWon ? "" : "dn", "var(--blue)"],
            ["Organic виручка", short(orgWon) + " ₴", `${org.reduce((s, d) => s + d.wonCount, 0)} угод`, "up", "var(--blue)"],
            ["SEO витрати", uah(seoSpend) + " ₴", "", "", "var(--peri)"],
          ]} />
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Місяць</th><th>PPC ₴</th><th>SEO ₴</th><th>Виручка PPC</th>
              <th>Виручка Organic</th><th>Угод Organic</th><th>Сер. чек</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const o = org.filter((d) => d.month === m);
                const p = ppc.filter((d) => d.month === m);
                const rev = o.reduce((s, d) => s + d.won, 0);
                const w = o.reduce((s, d) => s + d.wonCount, 0);
                return (
                  <tr key={m}>
                    <td>{label(m)}</td>
                    <td>{uah(spend.filter((s) => s.month === m && s.channel === "google_ads").reduce((s, r) => s + r.amountUah, 0))}</td>
                    <td>{uah(spend.filter((s) => s.month === m && s.channel === "seo").reduce((s, r) => s + r.amountUah, 0))}</td>
                    <td style={{ color: p.reduce((s, d) => s + d.won, 0) ? "inherit" : "var(--red)" }}>
                      {uah(p.reduce((s, d) => s + d.won, 0))}</td>
                    <td>{uah(rev)}</td><td>{w}</td><td>{w ? uah(rev / w) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!ppcWon && gadsSpend > 0 && (
            <div className="warn">
              <b>Витрачено {uah(gadsSpend)} ₴ на Google PPC — жодної виграної угоди в CRM за обраний період.</b>{" "}
              У бюджетній таблиці виручку Google Organic зараховано на витрати PPC, звідси ROAS у тисячі відсотків.
            </div>
          )}
        </div>
      </div>
      <div className="grid">
        <div className="card">
          <div className="ch">Усі джерела за виручкою</div>
          <HBars rows={[...byKey(deals, "source", ["won"])].map(([k, v]) => [k, v.won] as [string, number])} />
        </div>
      </div>
    </>
  );
}

/* --------------------------------- Charts -------------------------------- */
function LineChart({ data }: { data: Array<{ m: string; won: number; cost: number }> }) {
  const W = 640, H = 224, P = { t: 12, r: 16, b: 26, l: 48 };
  const mx = Math.max(...data.map((d) => d.won), 1);
  const X = (i: number) => P.l + (W - P.l - P.r) * (data.length > 1 ? i / (data.length - 1) : 0.5);
  const Y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / mx);
  const path = (k: "won" | "cost") => data.map((d, i) => `${i ? "L" : "M"}${X(i)},${Y(d[k])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Виручка та витрати по місяцях">
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (mx / 4) * i;
        return (
          <g key={i}>
            <line className="gl" x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} />
            <text className="ax" x={P.l - 8} y={Y(v) + 4} textAnchor="end">{short(v)}</text>
          </g>
        );
      })}
      {data.length > 1 && (
        <>
          <path d={`${path("won")} L${X(data.length - 1)},${H - P.b} L${X(0)},${H - P.b} Z`} fill="rgba(149,164,252,.14)" />
          <path d={path("won")} fill="none" stroke="#1C1C1C" strokeWidth={2.5} strokeLinejoin="round" />
          <path d={path("cost")} fill="none" stroke="#95A4FC" strokeWidth={2.5} strokeDasharray="5 5" />
        </>
      )}
      {data.map((d, i) => (
        <g key={d.m}>
          <circle cx={X(i)} cy={Y(d.won)} r={4} fill="#fff" stroke="#1C1C1C" strokeWidth={2} />
          <circle cx={X(i)} cy={Y(d.cost)} r={3} fill="#95A4FC" />
          <text className="ax" x={X(i)} y={H - P.b + 16} textAnchor="middle">{label(d.m)}</text>
        </g>
      ))}
    </svg>
  );
}

function Donut({ rows }: { rows: Array<[string, number]> }) {
  const list = rows.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((s, x) => s + x[1], 0) || 1;
  let a = -Math.PI / 2;
  const arcs = list.map(([k, v]) => {
    const ang = (v / total) * Math.PI * 2, e = a + ang, big = ang > Math.PI ? 1 : 0;
    const p = (r: number, t: number) => [58 + r * Math.cos(t), 58 + r * Math.sin(t)];
    const [x1, y1] = p(52, a), [x2, y2] = p(52, e), [x3, y3] = p(33, e), [x4, y4] = p(33, a);
    a = e;
    return <path key={k} d={`M${x1},${y1}A52,52 0 ${big} 1 ${x2},${y2}L${x3},${y3}A33,33 0 ${big} 0 ${x4},${y4}Z`}
      fill={colour(k)} stroke="#F7F9FB" strokeWidth={2} />;
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 116, flex: "none" }}>
        <svg viewBox="0 0 116 116" role="img" aria-label="Виручка за джерелами">
          {arcs.length ? arcs : <circle cx={58} cy={58} r={42} fill="#E5ECF6" />}
        </svg>
      </div>
      <div className="llist" style={{ flex: 1, minWidth: 130 }}>
        {list.slice(0, 7).map(([k, v]) => (
          <div key={k}>
            <span><s style={{ background: colour(k) }} />{k}</span>
            <b>{pct(v, total).toFixed(1)}%</b>
          </div>
        ))}
        {!list.length && <div style={{ color: "var(--m40)" }}>Немає даних</div>}
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: Array<[string, number]> }) {
  const W = 440, H = 196, P = { t: 12, r: 10, b: 30, l: 52 };
  const mx = Math.max(...rows.map((r) => r[1]), 1);
  const bw = (W - P.l - P.r) / Math.max(rows.length, 1);
  const Y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / mx);
  const palette = ["#C6C7F8", "#3BB9BE", "#95A4FC", "#A8C5DA"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Витрати за каналами">
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (mx / 4) * i;
        return (
          <g key={i}>
            <line className="gl" x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} />
            <text className="ax" x={P.l - 8} y={Y(v) + 4} textAnchor="end">{short(v)}</text>
          </g>
        );
      })}
      {rows.map(([k, v], i) => {
        const cx = P.l + bw * i + bw / 2;
        return (
          <g key={k}>
            <rect x={cx - 18} y={Y(v)} width={36} height={Math.max(0, H - P.b - Y(v))} rx={6} fill={palette[i % palette.length]} />
            <text className="ax" x={cx} y={H - P.b + 16} textAnchor="middle">{k}</text>
            <text className="ax" x={cx} y={Y(v) - 6} textAnchor="middle" fill="#1C1C1C" fontWeight={700}>{short(v)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HBars({ rows }: { rows: Array<[string, number]> }) {
  const list = rows.sort((a, b) => b[1] - a[1]);
  const W = 680, rh = 30, mx = Math.max(...list.map((r) => r[1]), 1);
  return (
    <svg viewBox={`0 0 ${W} ${Math.max(list.length * rh + 10, 40)}`} role="img" aria-label="Джерела за виручкою">
      {list.map(([k, v], i) => {
        const y = i * rh + 6, w = Math.max(2, ((W - 320) * v) / mx);
        return (
          <g key={k}>
            <text className="ax" x={0} y={y + 16} fill="#1C1C1C" fontWeight={600} fontSize={12}>{k}</text>
            <rect x={200} y={y + 5} width={w} height={16} rx={5} fill={colour(k)} />
            <text className="ax" x={200 + w + 8} y={y + 17} fill="#1C1C1C" fontWeight={700}>{uah(v)} ₴</text>
          </g>
        );
      })}
    </svg>
  );
}

function Funnel({ steps }: { steps: Array<[string, number]> }) {
  const mx = Math.max(...steps.map((s) => s[1]), 1), W = 440, rh = 42;
  const fills = ["#1C1C1C", "#95A4FC", "#C6C7F8", "#BAEDBD"];
  return (
    <svg viewBox={`0 0 ${W} ${steps.length * rh + 10}`} role="img" aria-label="Наскрізна воронка">
      {steps.map(([k, v], i) => {
        const y = i * rh + 8, w = Math.max(2, ((W - 150) * v) / mx);
        const conv = i > 0 && steps[i - 1][1] ? pct(v, steps[i - 1][1]).toFixed(0) + "%" : "";
        return (
          <g key={k}>
            <text className="ax" x={0} y={y + 16} fill="#1C1C1C" fontWeight={600} fontSize={12}>{k}</text>
            <rect x={118} y={y + 4} width={w} height={18} rx={6} fill={fills[i % fills.length]} />
            <text className="ax" x={118 + w + 8} y={y + 17} fill="#1C1C1C" fontWeight={700}>{uah(v)}</text>
            {conv && <text className="ax" x={118} y={y + 34} fontSize={10.5}>конверсія кроку {conv}</text>}
          </g>
        );
      })}
    </svg>
  );
}
