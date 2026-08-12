"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SOURCE_COLORS } from "@/lib/taxonomy";
import {
  DashboardCustomWidget,
  DashboardEditableBlock,
  DashboardEditToolbar,
  DashboardWidgetComposer,
  useDashboardEditor,
  type DashboardChartSeries,
  type DashboardEditorController,
  type DashboardFormulaMetric,
} from "@/components/DashboardEditor";

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
type ClientRow = {
  month: string; source: string; company: string;
  won: number; wonCount: number; openPipeline: number; openCount: number;
};
type LeadRow = {
  month: string; channel: string; source: string; total: number;
  nql: number; iql: number; mql: number; sql_: number;
  junk: number; toSales: number; handlingHours: number | null; handlingCount: number;
};
type Payload = {
  currentMonth: string;
  bySource: SourceRow[]; byMonth: MonthRow[]; clients: ClientRow[]; leads: LeadRow[];
  sync: {
    finishedAt: string; status: string; trigger: string;
    dealsUpserted: number; leadsUpserted: number; unknownSources: string[];
    sources: { deals: string; leads: string };
  } | null;
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

type View = "db" | "ld" | "dl" | "sr";
const VIEWS: Array<[View, string]> = [
  ["db", "Dashboard"], ["ld", "Ліди"], ["dl", "Угоди"], ["sr", "Джерела"],
];
type IconName =
  | "dashboard"
  | "leads"
  | "deals"
  | "sources"
  | "layout"
  | "search"
  | "reset"
  | "refresh"
  | "check"
  | "target"
  | "logout"
  | "plus"
  | "arrow";

const NAV_ICONS: Record<View, IconName> = {
  db: "dashboard",
  ld: "leads",
  dl: "deals",
  sr: "sources",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "dashboard" ? <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></> : null}
      {name === "leads" ? <><circle cx="12" cy="7.5" r="3.25" /><path d="M5 20c.8-3.35 3.12-5.02 7-5.02S18.2 16.65 19 20" /></> : null}
      {name === "deals" ? <><rect x="3.5" y="5.5" width="17" height="14" rx="2" /><path d="M8.3 5.5V3.8h7.4v1.7M3.5 10.2h17M10 14h4" /></> : null}
      {name === "sources" ? <><circle cx="12" cy="12" r="8.25" /><path d="M3.75 12h16.5M12 3.75c2.1 2.3 3.15 5.05 3.15 8.25S14.1 17.95 12 20.25C9.9 17.95 8.85 15.2 8.85 12S9.9 6.05 12 3.75Z" /></> : null}
      {name === "layout" ? <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M8.5 4v16M8.5 9h12" /></> : null}
      {name === "search" ? <><circle cx="10.7" cy="10.7" r="5.8" /><path d="m15.2 15.2 4.1 4.1" /></> : null}
      {name === "reset" ? <><path d="M4.3 9.5A8.1 8.1 0 1 1 5.1 16" /><path d="M4.3 4.8v4.7H9" /></> : null}
      {name === "refresh" ? <><path d="M20 11a8 8 0 0 0-14.4-4.8L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.4 4.8L20 16" /><path d="M20 20v-4h-4" /></> : null}
      {name === "check" ? <path d="m5 12.3 4.1 4.1L19.2 6.3" /> : null}
      {name === "target" ? <><circle cx="12" cy="12" r="7.8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22" /></> : null}
      {name === "logout" ? <><path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10" /><path d="M14 8l4 4-4 4M8 12h10" /></> : null}
      {name === "plus" ? <path d="M12 5v14M5 12h14" /> : null}
      {name === "arrow" ? <path d="M5 12h13M13 6l6 6-6 6" /> : null}
    </svg>
  );
}
const EDITABLE_BLOCK_IDS: Record<View, readonly string[]> = {
  db: ["dashboard-kpis", "dashboard-revenue", "dashboard-clients", "dashboard-funnel"],
  ld: ["leads-kpis", "leads-breakdown", "leads-note"],
  dl: ["deals-kpis", "deals-by-source", "deals-by-month"],
  sr: ["sources-overview", "sources-revenue"],
};

type EditableBlockDefinition = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function Dashboard({ user }: { user: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<View>("db");
  // A filter always means one exact value. The previous multi-select state
  // accidentally removed the clicked source from the full set, which made a
  // source click look like a sum of every other source.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
      setSelectedMonth(json.currentMonth);
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

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingSources = useMemo(() => {
    if (!data || !normalizedQuery) return null;
    const matches = new Set<string>();
    for (const row of data.bySource) {
      if (row.source.toLocaleLowerCase().includes(normalizedQuery)) matches.add(row.source);
    }
    for (const row of data.clients) {
      if (
        row.source.toLocaleLowerCase().includes(normalizedQuery) ||
        row.company.toLocaleLowerCase().includes(normalizedQuery)
      ) matches.add(row.source);
    }
    for (const row of data.leads) {
      if (
        row.source.toLocaleLowerCase().includes(normalizedQuery) ||
        row.channel.toLocaleLowerCase().includes(normalizedQuery)
      ) matches.add(row.source);
    }
    return matches;
  }, [data, normalizedQuery]);

  const deals = useMemo(
    () => (data?.byMonth ?? []).filter(
      (r) =>
        (!selectedMonth || r.month === selectedMonth) &&
        (!selectedSource || r.source === selectedSource) &&
        (!normalizedQuery || matchingSources?.has(r.source))
    ),
    [data, selectedMonth, selectedSource, normalizedQuery, matchingSources]
  );
  const leadRows = useMemo(
    () =>
      (data?.leads ?? []).filter(
        (r) =>
          (!selectedMonth || r.month === selectedMonth) &&
          (!selectedSource || r.source === selectedSource) &&
          (!selectedChannel || r.channel === selectedChannel) &&
          (!normalizedQuery || matchingSources?.has(r.source) || r.channel.toLocaleLowerCase().includes(normalizedQuery))
      ),
    [data, selectedMonth, selectedSource, selectedChannel, normalizedQuery, matchingSources]
  );
  const clientRows = useMemo(
    () =>
      (data?.clients ?? []).filter(
        (r) =>
          (!selectedMonth || r.month === selectedMonth) &&
          (!selectedSource || r.source === selectedSource) &&
          (!normalizedQuery || matchingSources?.has(r.source) || r.company.toLocaleLowerCase().includes(normalizedQuery))
      ),
    [data, selectedMonth, selectedSource, normalizedQuery, matchingSources]
  );

  const totals = useMemo(() => {
    const won = deals.reduce((s, r) => s + r.won, 0);
    const wonCount = deals.reduce((s, r) => s + r.wonCount, 0);
    const lostCount = deals.reduce((s, r) => s + r.lostCount, 0);
    const pipeline = deals.reduce((s, r) => s + r.pipeline, 0);
    const pipelineCount = deals.reduce((s, r) => s + r.pipelineCount, 0);
    const lost = deals.reduce((s, r) => s + r.lost, 0);
    return { won, wonCount, lostCount, pipeline, pipelineCount, lost };
  }, [deals]);

  const displayMonths = useMemo(
    () => (selectedMonth ? [selectedMonth] : allMonths),
    [allMonths, selectedMonth]
  );
  const editor = useDashboardEditor({
    dashboardId: `moodua-${user}-${view}`,
    blockIds: EDITABLE_BLOCK_IDS[view],
  });
  const editorMetrics = useMemo<DashboardFormulaMetric[]>(() => {
    const leadTotal = leadRows.reduce((sum, row) => sum + row.total, 0);
    return [
      { id: "revenue", label: "Виручка", value: totals.won },
      { id: "pipeline", label: "Пайплайн", value: totals.pipeline },
      { id: "deals", label: "Відкриті угоди", value: totals.pipelineCount },
      { id: "won_deals", label: "Виграні угоди", value: totals.wonCount },
      { id: "lost_deals", label: "Програні угоди", value: totals.lostCount },
      { id: "leads", label: "Ліди", value: leadTotal },
    ];
  }, [leadRows, totals]);
  const editorChartSeries = useMemo<DashboardChartSeries[]>(() => {
    const byMonth = (value: (row: MonthRow) => number) =>
      displayMonths.map((month) => ({
        label: label(month),
        value: deals.filter((row) => row.month === month).reduce((sum, row) => sum + value(row), 0),
      }));
    const leadByMonth = displayMonths.map((month) => ({
      label: label(month),
      value: leadRows.filter((row) => row.month === month).reduce((sum, row) => sum + row.total, 0),
    }));
    const revenueBySource = new Map<string, number>();
    for (const row of deals) revenueBySource.set(row.source, (revenueBySource.get(row.source) ?? 0) + row.won);
    return [
      { id: "revenue_by_month", label: "Виручка за місяцями", points: byMonth((row) => row.won) },
      { id: "pipeline_by_month", label: "Пайплайн за місяцями", points: byMonth((row) => row.pipeline) },
      { id: "leads_by_month", label: "Ліди за місяцями", points: leadByMonth },
      {
        id: "revenue_by_source",
        label: "Виручка за джерелами",
        points: [...revenueBySource]
          .sort((a, b) => b[1] - a[1])
          .map(([source, value]) => ({ label: source, value })),
      },
    ];
  }, [deals, displayMonths, leadRows]);

  if (loading && !data) {
    return (
      <div className="app">
        <Sidebar view={view} setView={setView} user={user} />
        <main className="main-frame">
          <div className="crumbs">Аналітика <span>/</span> <b>Dashboard</b></div>
          <div className="kpis">{[...Array(8)].map((_, i) => <div key={i} className="skeleton" />)}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <Sidebar view={view} setView={setView} user={user} />
        <main className="main-frame error-state">
          <div className="crumbs">Аналітика <span>/</span> <b>Dashboard</b></div>
          <h1>Дані поки недоступні</h1>
          <p>{loadError ?? "Не вдалося відкрити підготовлені Excel-дані."}</p>
          <button className="refresh" onClick={() => load().catch(() => undefined)} disabled={loading}>
            {loading ? "Завантажую…" : "Спробувати ще раз"}
          </button>
        </main>
      </div>
    );
  }

  const stamp = data.sync?.finishedAt
    ? new Date(data.sync.finishedAt).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })
    : "дата не вказана";
  const sourceLabel = data.sync?.sources
    ? data.sync.sources.deals + " + " + data.sync.sources.leads
    : "Excel-бази 2026";
  const resetFilters = () => {
    setSelectedMonth(data.currentMonth);
    setSelectedSource(null);
    setSelectedChannel(null);
    setQuery("");
  };

  return (
    <div className={"app app-" + view}>
      <Sidebar view={view} setView={setView} user={user} onLogout={logout} />
      <main className="main-frame">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="topbar-nav-mark" aria-hidden><Icon name="layout" /></span>
            <span className="topbar-crumb-muted">Аналітика</span>
            <span className="topbar-slash" aria-hidden>/</span>
            <strong>{VIEWS.find(([v]) => v === view)?.[1]}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <span className="search-glyph" aria-hidden><Icon name="search" /></span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук клієнта, джерела або каналу…"
                aria-label="Пошук клієнта, джерела або каналу"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="utility-button" type="button" onClick={resetFilters} title="Скинути фільтри" aria-label="Скинути фільтри"><Icon name="reset" /></button>
            <button
              className="utility-button"
              type="button"
              onClick={() => load().catch(() => undefined)}
              disabled={loading}
              aria-label={loading ? "Оновлюю дані" : "Оновити дані"}
              title={loading ? "Оновлюю дані" : "Оновити дані"}
            >
              {loading ? "…" : <Icon name="refresh" />}
            </button>
            <span className="topbar-divider" aria-hidden />
            <div className="topbar-profile" title={sourceLabel}>
              <span className="top-avatar" aria-hidden>{user.slice(0, 1).toUpperCase()}</span>
              <span className="topbar-user"><strong>{user}</strong><small>Адміністратор</small></span>
            </div>
            <DashboardEditToolbar editor={editor} className="top-editor-toolbar" />
          </div>
        </header>

        <section className="workspace-heading">
          <div>
            <h1>{view === "db" ? "Огляд" : VIEWS.find(([v]) => v === view)?.[1]}</h1>
            <p>Маркетингова аналітика за {selectedMonth ? label(selectedMonth) + " 2026" : "весь період"}</p>
          </div>
          <div className="period-indicator" aria-label={"Поточний зріз: " + (selectedMonth ? label(selectedMonth) : "усі місяці")}><span>Період</span><b>{selectedMonth ? label(selectedMonth) : "Усі місяці"}</b></div>
        </section>

        <FilterChipBand
          currentMonth={data.currentMonth}
          allMonths={allMonths}
          allSources={allSources}
          allChannels={allChannels}
          selectedMonth={selectedMonth}
          selectedSource={selectedSource}
          selectedChannel={selectedChannel}
          isLeadsView={view === "ld"}
          chooseMonth={setSelectedMonth}
          chooseSource={setSelectedSource}
          chooseChannel={setSelectedChannel}
          reset={resetFilters}
        />

        <div className={"workspace-view view-" + view}>
          {view === "db" && (
            <DashboardView
              deals={deals}
              clients={clientRows}
              leads={leadRows}
              totals={totals}
              months={displayMonths}
              periodLabel={selectedMonth ? label(selectedMonth) + " 2026" : "за весь період"}
              onViewChange={setView}
              editor={editor}
              metrics={editorMetrics}
              chartSeries={editorChartSeries}
            />
          )}
          {view === "ld" && <LeadsView leads={leadRows} editor={editor} metrics={editorMetrics} chartSeries={editorChartSeries} />}
          {view === "dl" && <DealsView deals={deals} months={displayMonths} editor={editor} metrics={editorMetrics} chartSeries={editorChartSeries} />}
          {view === "sr" && <SourcesView deals={deals} editor={editor} metrics={editorMetrics} chartSeries={editorChartSeries} />}
          {editor.isEditing ? <DashboardWidgetComposer editor={editor} metrics={editorMetrics} chartSeries={editorChartSeries} /> : null}
        </div>

        <p className="data-footnote" title={sourceLabel}>Excel · оновлено {stamp}</p>
      </main>
    </div>
  );
}

function Sidebar({ view, setView, user, onLogout }: { view: View; setView: (v: View) => void; user: string; onLogout?: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-avatar" aria-hidden>M</span>
        <span><strong>MOODua</strong><small>Наскрізна аналітика</small></span>
      </div>

      <div className="sidebar-tabs" aria-label="Навігація">
        <span className="is-active">Обране</span>
        <span>Останні</span>
      </div>

      <div className="sidebar-content">
        <div className="navlbl">Аналітика</div>
        <nav className="nav" aria-label="Аналітика">
          {VIEWS.map(([v, name]) => (
            <button key={v} aria-current={view === v ? "page" : undefined}
              onClick={(event) => { event.currentTarget.blur(); setView(v); }}>
              <span className="nav-icon" aria-hidden><Icon name={NAV_ICONS[v]} /></span>
              {name}
            </button>
          ))}
        </nav>

        <div className="navlbl">Дані</div>
        <div className="nav nav-static-list">
          <span className="nav-static"><span className="nav-icon" aria-hidden><Icon name="deals" /></span>Угоди · 2026</span>
          <span className="nav-static"><span className="nav-icon" aria-hidden><Icon name="leads" /></span>All leads · 2026</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user"><span className="sidebar-avatar small" aria-hidden>{user.slice(0, 1).toUpperCase()}</span><span><b>{user}</b><small>Адміністратор</small></span></div>
        {onLogout ? <button className="logout" type="button" onClick={onLogout}><Icon name="logout" />Вийти</button> : null}
      </div>
    </aside>
  );
}

function FilterChipBand({
  currentMonth,
  allMonths,
  allSources,
  allChannels,
  selectedMonth,
  selectedSource,
  selectedChannel,
  isLeadsView,
  chooseMonth,
  chooseSource,
  chooseChannel,
  reset,
}: {
  currentMonth: string;
  allMonths: string[];
  allSources: string[];
  allChannels: string[];
  selectedMonth: string | null;
  selectedSource: string | null;
  selectedChannel: string | null;
  isLeadsView: boolean;
  chooseMonth: (value: string | null) => void;
  chooseSource: (value: string | null) => void;
  chooseChannel: (value: string | null) => void;
  reset: () => void;
}) {
  const hasFilters = selectedMonth !== currentMonth || Boolean(selectedSource || selectedChannel);
  return (
    <section className="wide-filters" aria-label="Фільтри аналітики">
      {hasFilters ? <div className="wide-filters-reset"><button type="button" onClick={reset}>Скинути фільтри</button></div> : null}
      <FilterChipRow
        label="Період"
        items={[
          { id: "current", label: "Поточний місяць", active: selectedMonth === currentMonth, onClick: () => chooseMonth(currentMonth) },
          { id: "all-period", label: "За весь період", active: selectedMonth === null, onClick: () => chooseMonth(null) },
        ]}
      />
      <FilterChipRow
        label="Місяць створення"
        scrollable
        items={[
          { id: "all-months", label: "Усі місяці", active: selectedMonth === null, onClick: () => chooseMonth(null) },
          ...allMonths.map((month) => ({ id: month, label: label(month), active: selectedMonth === month, onClick: () => chooseMonth(month) })),
        ]}
      />
      <FilterChipRow
        label="Джерело"
        scrollable
        items={[
          { id: "all-sources", label: "Усі джерела", active: selectedSource === null, onClick: () => chooseSource(null) },
          ...allSources.map((source) => ({ id: source, label: source, active: selectedSource === source, onClick: () => chooseSource(source) })),
        ]}
      />
      {isLeadsView ? (
        <FilterChipRow
          label="Канал"
          scrollable
          items={[
            { id: "all-channels", label: "Усі канали", active: selectedChannel === null, onClick: () => chooseChannel(null) },
            ...allChannels.map((channel) => ({ id: channel, label: channel, active: selectedChannel === channel, onClick: () => chooseChannel(channel) })),
          ]}
        />
      ) : null}
    </section>
  );
}

function FilterChipRow({ label: title, items, scrollable = false }: {
  label: string;
  scrollable?: boolean;
  items: Array<{ id: string; label: string; active: boolean; onClick: () => void }>;
}) {
  return (
    <div className="filter-chip-row">
      <span className="filter-chip-label">{title}</span>
      <div className={"filter-chip-track" + (scrollable ? " is-scrollable" : "")} role="group" aria-label={title}>
        {items.map((item) => (
          <button key={item.id} type="button" aria-pressed={item.active} className={item.active ? "is-active" : ""} onClick={item.onClick}>
            {item.label}
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

function EditableBlocks({
  editor,
  blocks,
  metrics,
  chartSeries,
}: {
  editor: DashboardEditorController;
  blocks: EditableBlockDefinition[];
  metrics: DashboardFormulaMetric[];
  chartSeries: DashboardChartSeries[];
}) {
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const widgetMap = new Map(editor.config.widgets.map((widget) => [widget.id, widget]));

  return (
    <>
      {editor.orderedIds.map((id) => {
        const block = blockMap.get(id);
        if (block) {
          return (
            <DashboardEditableBlock
              key={block.id}
              editor={editor}
              id={block.id}
              title={block.title}
              description={block.description}
            >
              {block.children}
            </DashboardEditableBlock>
          );
        }

        const widget = widgetMap.get(id);
        if (!widget) return null;
        return (
          <DashboardEditableBlock key={widget.id} editor={editor} id={widget.id} title={widget.title} removable>
            <DashboardCustomWidget widget={widget} metrics={metrics} chartSeries={chartSeries} />
          </DashboardEditableBlock>
        );
      })}
    </>
  );
}

/* ------------------------------- Dashboard ------------------------------- */
type DashboardSourceSummary = {
  source: string;
  won: number;
  wonCount: number;
  pipeline: number;
  pipelineCount: number;
  lost: number;
  lostCount: number;
};

type DashboardChartMode = "revenue" | "pipeline" | "leads";

function DashboardView({ deals, clients, leads, totals, months, periodLabel, onViewChange, editor, metrics, chartSeries }: {
  deals: MonthRow[];
  clients: ClientRow[];
  leads: LeadRow[];
  totals: ReturnType<typeof Object> & Record<string, number>;
  months: string[];
  periodLabel: string;
  onViewChange: (view: View) => void;
  editor: DashboardEditorController;
  metrics: DashboardFormulaMetric[];
  chartSeries: DashboardChartSeries[];
}) {
  const [chartMode, setChartMode] = useState<DashboardChartMode>("revenue");
  const leadTotal = leads.reduce((sum, row) => sum + row.total, 0);
  const revenueByMonth = months.map((month) => ({
    m: month,
    won: deals.filter((row) => row.month === month).reduce((sum, row) => sum + row.won, 0),
  }));
  const pipelineByMonth = months.map((month) => ({
    m: month,
    won: deals.filter((row) => row.month === month).reduce((sum, row) => sum + row.pipeline, 0),
  }));
  const leadsByMonth = months.map((month) => ({
    m: month,
    won: leads.filter((row) => row.month === month).reduce((sum, row) => sum + row.total, 0),
  }));
  const sourceRows: DashboardSourceSummary[] = [...byKey(deals, "source", ["won", "wonCount", "pipeline", "pipelineCount", "lost", "lostCount"])]
    .map(([source, values]) => ({
      source,
      won: values.won ?? 0,
      wonCount: values.wonCount ?? 0,
      pipeline: values.pipeline ?? 0,
      pipelineCount: values.pipelineCount ?? 0,
      lost: values.lost ?? 0,
      lostCount: values.lostCount ?? 0,
    }))
    .sort((a, b) => b.won - a.won || b.pipeline - a.pipeline);
  const companies: Array<Pick<ClientRow, "company" | "won" | "wonCount" | "openPipeline" | "openCount">> =
    [...byKey(clients, "company", ["won", "wonCount", "openPipeline", "openCount"])]
      .map(([company, values]) => ({
        company,
        won: values.won ?? 0,
        wonCount: values.wonCount ?? 0,
        openPipeline: values.openPipeline ?? 0,
        openCount: values.openCount ?? 0,
      }));
  const topRevenue = companies.filter((row) => row.won > 0).sort((a, b) => b.won - a.won).slice(0, 5);
  const topOpenPipeline = companies.filter((row) => row.openPipeline > 0).sort((a, b) => b.openPipeline - a.openPipeline).slice(0, 5);
  const winRate = pct(totals.wonCount, totals.wonCount + totals.lostCount);
  const sourceMax = Math.max(...sourceRows.map((row) => row.won), 1);
  const chart = {
    revenue: { label: "Виручка", hint: "лише виграні угоди", data: revenueByMonth },
    pipeline: { label: "Пайплайн", hint: "відкриті угоди", data: pipelineByMonth },
    leads: { label: "Ліди", hint: "нові ліди за місяцем", data: leadsByMonth },
  }[chartMode];

  const blocks: EditableBlockDefinition[] = [
    {
      id: "dashboard-kpis",
      title: "Ключові показники",
      children: (
        <section className="snow-kpi-section" aria-label="Ключові показники">
          <div className="snow-kpis">
            <button type="button" className="snow-kpi snow-kpi-lilac" onClick={() => onViewChange("dl")}>
              <span>Виручка</span><strong>{short(totals.won)} ₴</strong><small>{totals.wonCount} виграних угод <i>↗</i></small>
            </button>
            <button type="button" className="snow-kpi snow-kpi-blue" onClick={() => onViewChange("dl")}>
              <span>Пайплайн</span><strong>{short(totals.pipeline)} ₴</strong><small>{totals.pipelineCount} відкритих угод <i>↗</i></small>
            </button>
            <button type="button" className="snow-kpi snow-kpi-lilac" onClick={() => onViewChange("ld")}>
              <span>Ліди</span><strong>{uah(leadTotal)}</strong><small>за {periodLabel} <i>↗</i></small>
            </button>
            <button type="button" className="snow-kpi snow-kpi-blue" onClick={() => onViewChange("sr")}>
              <span>Win rate</span><strong>{winRate.toFixed(0)}%</strong><small>{totals.lostCount} програно <i>↗</i></small>
            </button>
          </div>
        </section>
      ),
    },
    {
      id: "dashboard-revenue",
      title: "Динаміка та джерела",
      children: (
        <div className="snow-dashboard-grid snow-primary-grid">
          <section className="snow-card snow-line-card">
            <div className="snow-card-header snow-line-header">
              <div className="snow-tabs" role="tablist" aria-label="Показник графіка">
                {(["revenue", "pipeline", "leads"] as DashboardChartMode[]).map((mode) => (
                  <button key={mode} type="button" role="tab" aria-selected={chartMode === mode} onClick={() => setChartMode(mode)}>
                    {({ revenue: "Виручка", pipeline: "Пайплайн", leads: "Ліди" })[mode]}
                  </button>
                ))}
              </div>
              <span className="snow-chart-period">{chart.hint}</span>
            </div>
            <div className="snow-chart-title"><strong>{chart.label}</strong><span>{periodLabel}</span></div>
            <LineChart
              data={chart.data}
              secondary={chartMode === "revenue" ? pipelineByMonth : chartMode === "pipeline" ? revenueByMonth : undefined}
            />
          </section>
          <section className="snow-card snow-source-card" aria-label="Топ джерела">
            <div className="snow-card-header">
              <div><h2>Топ джерела</h2><span>за виручкою</span></div>
              <button type="button" className="snow-icon-button" onClick={() => onViewChange("sr")} aria-label="Відкрити всі джерела">→</button>
            </div>
            <div className="snow-source-list">
              {sourceRows.slice(0, 6).map((row, index) => (
                <button type="button" className="snow-source-row" key={row.source} onClick={() => onViewChange("sr")}>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                  <span><b>{row.source}</b><small>{row.wonCount} виграно</small></span>
                  <i><b style={{ width: String(Math.max(4, (row.won / sourceMax) * 100)) + "%" }} /></i>
                  <strong>{short(row.won)} ₴</strong>
                </button>
              ))}
              {!sourceRows.length ? <p className="empty">Немає джерел за фільтром</p> : null}
            </div>
          </section>
        </div>
      ),
    },
    {
      id: "dashboard-clients",
      title: "Структура результату",
      children: (
        <div className="snow-dashboard-grid snow-secondary-grid">
          <section className="snow-card">
            <div className="snow-card-header"><h2>Угоди за статусом</h2><span>за активним зрізом</span></div>
            <Bars rows={[["Відкриті", totals.pipelineCount], ["Виграні", totals.wonCount], ["Програні", totals.lostCount]]} />
          </section>
          <section className="snow-card">
            <div className="snow-card-header"><h2>Виручка за джерелами</h2><button type="button" className="snow-icon-button" onClick={() => onViewChange("sr")} aria-label="Відкрити джерела">→</button></div>
            <Donut rows={sourceRows.map((row) => [row.source, row.won] as [string, number])} />
          </section>
        </div>
      ),
    },
    {
      id: "dashboard-funnel",
      title: "Пріоритетні угоди",
      children: (
        <section className="snow-card snow-table-card">
          <div className="snow-card-header">
            <div><h2>Пріоритетні угоди</h2><span>Клієнти з найбільшим фінансовим потенціалом</span></div>
            <button type="button" className="snow-link-button" onClick={() => onViewChange("dl")}>Усі угоди →</button>
          </div>
          <div className="snow-table-grid">
            <div className="snow-mini-table">
              <h3>Топ клієнтів</h3>
              {topRevenue.length === 0 ? <p className="empty">Немає виграних угод</p> : topRevenue.map((row) => (
                <button type="button" key={row.company} onClick={() => onViewChange("dl")}><span>{row.company}</span><small>{row.wonCount} угод</small><b>{short(row.won)} ₴</b></button>
              ))}
            </div>
            <div className="snow-mini-table">
              <h3>Відкритий потенціал</h3>
              {topOpenPipeline.length === 0 ? <p className="empty">Немає відкритих угод</p> : topOpenPipeline.map((row) => (
                <button type="button" key={row.company} onClick={() => onViewChange("dl")}><span>{row.company}</span><small>{row.openCount} угод</small><b>{short(row.openPipeline)} ₴</b></button>
              ))}
            </div>
          </div>
        </section>
      ),
    },
  ];

  return <EditableBlocks editor={editor} blocks={blocks} metrics={metrics} chartSeries={chartSeries} />;
}

/* --------------------------------- Leads --------------------------------- */
function LeadsView({ leads, editor, metrics, chartSeries }: {
  leads: LeadRow[]; editor: DashboardEditorController; metrics: DashboardFormulaMetric[]; chartSeries: DashboardChartSeries[];
}) {
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

  const blocks: EditableBlockDefinition[] = [
    {
      id: "leads-kpis",
      title: "Показники лідів",
      children: <><h2 className="t">Ліди</h2><Kpis items={[
        ["Всього лідів", uah(total), "", "", "var(--blue)"],
        ["MQL → SQL", mql + sq ? pct(sq, mql + sq).toFixed(0) + "%" : "—", `${mql} MQL · ${sq} SQL`, "", "var(--peri)"],
        ["Спам-рейт", total ? pct(junk, total).toFixed(0) + "%" : "—", `${uah(junk)} нецільових`, pct(junk, total) > 50 ? "dn" : "", "var(--blue)"],
        ["Сер. час обробки", hN ? dur(hSum / hN) : "—", `${uah(hN)} лідів`, "", "var(--peri)"],
        ["Передано Sales", uah(toSales), total ? pct(toSales, total).toFixed(0) + "% від лідів" : "", "", "var(--peri)"],
        ["SQL", uah(sq), total ? pct(sq, total).toFixed(0) + "% від лідів" : "", "", "var(--blue)"],
        ["Каналів", String(new Set(leads.map((r) => r.channel)).size), "активних", "", "var(--blue)"],
        ["З атрибуцією", String(new Set(leads.filter((r) => r.source !== "Не вказано").map((r) => r.source)).size), "джерел", "", "var(--peri)"],
      ]} /></>,
    },
    {
      id: "leads-breakdown",
      title: "Розподіл лідів",
      children: <div className="grid g11">
        {table("channel", "За каналом звернення", "time")}
        {table("source", "За джерелом", "sales")}
      </div>,
    },
    {
      id: "leads-note",
      title: "Пояснення до обробки",
      children: <div className="note">
        Середній час обробки — проміжок між «Created At» та «Updated At» у файлі All leads.
        Це технічний орієнтир, а не окрема дата передачі в Sales.
      </div>,
    },
  ];

  return <EditableBlocks editor={editor} blocks={blocks} metrics={metrics} chartSeries={chartSeries} />;
}

/* --------------------------------- Deals --------------------------------- */
function DealsView({ deals, months, editor, metrics, chartSeries }: {
  deals: MonthRow[]; months: string[];
  editor: DashboardEditorController; metrics: DashboardFormulaMetric[]; chartSeries: DashboardChartSeries[];
}) {
  const [sortKey, setSortKey] = useState<string>("won");
  const [dir, setDir] = useState(-1);
  const map = byKey(deals, "source", ["pipeline", "pipelineCount", "won", "wonCount", "lost", "lostCount"]);
  const rows = [...map].map(([source, v]) => {
    const cycles = deals.filter((d) => d.source === source && d.avgCycleDays !== null);
    return {
      source,
      pipeline: v.pipeline,
      pipelineCount: v.pipelineCount,
      won: v.won,
      wonCount: v.wonCount,
      lost: v.lost,
      lostCount: v.lostCount,
      winrate: pct(v.wonCount, v.wonCount + v.lostCount),
      avg: v.wonCount ? v.won / v.wonCount : 0,
      cycle: cycles.length ? cycles.reduce((s, c) => s + (c.avgCycleDays ?? 0), 0) / cycles.length : null,
    };
  });
  rows.sort((a, b) => (((a as never as Record<string, number>)[sortKey] ?? -1) > ((b as never as Record<string, number>)[sortKey] ?? -1) ? 1 : -1) * dir);
  const t = rows.reduce((s, r) => ({
    pipeline: s.pipeline + r.pipeline, pipelineCount: s.pipelineCount + r.pipelineCount,
    won: s.won + r.won, wonCount: s.wonCount + r.wonCount, lost: s.lost + r.lost,
    lostCount: s.lostCount + r.lostCount,
  }), { pipeline: 0, pipelineCount: 0, won: 0, wonCount: 0, lost: 0, lostCount: 0 });

  const th = (k: string, name: string) => (
    <th className="sortable" onClick={() => { sortKey === k ? setDir(-dir) : (setSortKey(k), setDir(-1)); }}>{name}</th>
  );

  const blocks: EditableBlockDefinition[] = [
    {
      id: "deals-kpis",
      title: "Показники угод",
      children: <><h2 className="t">Угоди · місяць створення</h2><Kpis items={[
        ["Відкриті", uah(t.pipelineCount), short(t.pipeline) + " ₴ пайплайн", "", "var(--peri)"],
        ["Виграно", uah(t.wonCount), `win rate ${pct(t.wonCount, t.wonCount + t.lostCount).toFixed(0)}%`, "", "var(--blue)"],
        ["Програно", uah(t.lostCount), short(t.lost) + " ₴ втрачено", "dn", "var(--peri)"],
        ["Виручка", short(t.won) + " ₴", "лише виграні", "", "var(--blue)"],
        ["Середній чек", t.wonCount ? uah(t.won / t.wonCount) + " ₴" : "—", "лише виграні", "", "var(--peri)"],
        ["Win rate", pct(t.wonCount, t.wonCount + t.lostCount).toFixed(0) + "%", "виграні / закриті", "", "var(--blue)"],
        ["Втрачено", short(t.lost) + " ₴", "сума програних", "dn", "var(--peri)"],
        ["Джерел", uah(rows.length), "у вибірці", "", "var(--blue)"],
        ["Угод у вибірці", uah(t.pipelineCount + t.wonCount + t.lostCount), "усі етапи", "", "var(--peri)"],
      ]} /></>,
    },
    {
      id: "deals-by-source",
      title: "Угоди за джерелом",
      children: <div className="grid">
        <div className="card">
          <div className="ch">За джерелом</div>
          <table>
            <thead><tr>
              {th("source", "Джерело")}{th("pipelineCount", "Відкриті")}{th("wonCount", "Виграно")}
              {th("lostCount", "Програно")}{th("winrate", "Win rate")}{th("won", "Виручка")}
              {th("avg", "Сер. чек")}{th("cycle", "Цикл, дн.")}{th("lost", "Втрачено")}
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="empty">Немає даних за фільтром</td></tr>}
              {rows.map((r) => (
                <tr key={r.source}>
                  <td><span className="dotc" style={{ background: colour(r.source) }} />{r.source}</td>
                  <td>{r.pipelineCount}</td><td>{r.wonCount}</td><td>{r.lostCount}</td>
                  <td><span className={`tag ${r.wonCount + r.lostCount ? (r.winrate >= 32 ? "g" : r.winrate >= 20 ? "y" : "r") : "n"}`}>
                    {r.wonCount + r.lostCount ? r.winrate.toFixed(0) + "%" : "—"}</span></td>
                  <td>{uah(r.won)}</td><td>{uah(r.avg)}</td>
                  <td>{r.cycle === null ? "—" : r.cycle.toFixed(0)}</td>
                  <td style={{ color: "var(--red)" }}>{uah(r.lost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td>Разом</td><td>{t.pipelineCount}</td><td>{t.wonCount}</td><td>{t.lostCount}</td>
              <td>{pct(t.wonCount, t.wonCount + t.lostCount).toFixed(0)}%</td>
              <td>{uah(t.won)}</td><td>{t.wonCount ? uah(t.won / t.wonCount) : "—"}</td><td>—</td>
              <td style={{ color: "var(--red)" }}>{uah(t.lost)}</td>
            </tr></tfoot>
          </table>
          <div className="note">
            Ця таблиця використовує тільки файл «Угоди_2026 - 11_08.xlsx». Витрати, CAC та ROMI
            не показуються: таких даних у двох завантажених базах немає.
          </div>
        </div>
      </div>,
    },
    {
      id: "deals-by-month",
      title: "Угоди за місяцями",
      children: <div className="grid">
        <div className="card">
          <div className="ch">По місяцях</div>
          <table>
            <thead><tr><th>Місяць</th><th>Відкриті</th><th>Пайплайн</th><th>Виграно</th><th>Програно</th>
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
      </div>,
    },
  ];

  return <EditableBlocks editor={editor} blocks={blocks} metrics={metrics} chartSeries={chartSeries} />;
}

/* -------------------------------- Sources -------------------------------- */
function SourcesView({ deals, editor, metrics, chartSeries }: {
  deals: MonthRow[];
  editor: DashboardEditorController; metrics: DashboardFormulaMetric[]; chartSeries: DashboardChartSeries[];
}) {
  const map = byKey(deals, "source", ["pipeline", "pipelineCount", "won", "wonCount", "lost", "lostCount"]);
  const rows = [...map]
    .map(([source, value]) => ({
      source,
      pipeline: value.pipeline,
      pipelineCount: value.pipelineCount,
      won: value.won,
      wonCount: value.wonCount,
      lost: value.lost,
      lostCount: value.lostCount,
      winRate: pct(value.wonCount, value.wonCount + value.lostCount),
    }))
    .sort((a, b) => b.won - a.won || b.pipeline - a.pipeline);
  const totals = rows.reduce((sum, row) => ({
    pipeline: sum.pipeline + row.pipeline,
    pipelineCount: sum.pipelineCount + row.pipelineCount,
    won: sum.won + row.won,
    wonCount: sum.wonCount + row.wonCount,
    lost: sum.lost + row.lost,
    lostCount: sum.lostCount + row.lostCount,
  }), { pipeline: 0, pipelineCount: 0, won: 0, wonCount: 0, lost: 0, lostCount: 0 });

  const blocks: EditableBlockDefinition[] = [
    {
      id: "sources-overview",
      title: "Джерела угод",
      children: <>
        <h2 className="t">Джерела</h2>
        <Kpis items={[
          ["Джерел", uah(rows.length), "за вибраним фільтром", "", "var(--blue)"],
          ["Виручка", short(totals.won) + " ₴", `${totals.wonCount} виграних`, "", "var(--peri)"],
          ["Пайплайн", short(totals.pipeline) + " ₴", `${totals.pipelineCount} відкритих`, "", "var(--blue)"],
          ["Win rate", pct(totals.wonCount, totals.wonCount + totals.lostCount).toFixed(0) + "%", `${totals.lostCount} програно`, "", "var(--peri)"],
        ]} />
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ch">Угоди за джерелом <small>лише з файлу Угоди_2026</small></div>
          <table>
            <thead><tr><th>Джерело</th><th>Відкриті</th><th>Виграно</th><th>Програно</th><th>Win rate</th><th>Виручка</th><th>Пайплайн</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="empty">Немає даних за фільтром</td></tr>}
              {rows.map((row) => <tr key={row.source}>
                <td><span className="dotc" style={{ background: colour(row.source) }} />{row.source}</td>
                <td>{row.pipelineCount}</td><td>{row.wonCount}</td><td>{row.lostCount}</td>
                <td>{row.wonCount + row.lostCount ? row.winRate.toFixed(0) + "%" : "—"}</td>
                <td>{uah(row.won)} ₴</td><td>{uah(row.pipeline)} ₴</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>,
    },
    {
      id: "sources-revenue",
      title: "Виручка за джерелами",
      children: <div className="grid">
        <div className="card">
          <div className="ch">Усі джерела за виручкою</div>
          <HBars rows={rows.map((row) => [row.source, row.won] as [string, number])} />
        </div>
      </div>,
    },
  ];

  return <EditableBlocks editor={editor} blocks={blocks} metrics={metrics} chartSeries={chartSeries} />;
}

/* --------------------------------- Charts -------------------------------- */
function LineChart({ data, secondary }: {
  data: Array<{ m: string; won: number }>;
  secondary?: Array<{ m: string; won: number }>;
}) {
  const W = 700, H = 276, P = { t: 20, r: 16, b: 32, l: 54 };
  const values = [...data, ...(secondary ?? [])].map((item) => item.won);
  const mx = Math.max(...values, 1);
  const X = (i: number, length = data.length) => P.l + (W - P.l - P.r) * (length > 1 ? i / (length - 1) : 0.5);
  const Y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / mx);
  const path = (series: Array<{ m: string; won: number }>) => series.map((d, i) => `${i ? "L" : "M"}${X(i, series.length)},${Y(d.won)}`).join(" ");
  const primaryPath = path(data);
  const secondaryPath = secondary?.length ? path(secondary) : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Динаміка показників по місяцях">
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (mx / 4) * i;
        return (
          <g key={i}>
            <line className="gl" x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} />
            <text className="ax" x={P.l - 8} y={Y(v) + 4} textAnchor="end">{short(v)}</text>
          </g>
        );
      })}
      {secondaryPath ? <path d={secondaryPath} fill="none" stroke="var(--accent-line)" strokeWidth={2} strokeDasharray="4 7" strokeLinecap="round" /> : null}
      {data.length > 1 ? <path d={`${primaryPath} L${X(data.length - 1)},${H - P.b} L${X(0)},${H - P.b} Z`} fill="var(--chart-fill)" /> : null}
      <path d={primaryPath} fill="none" stroke="var(--ink)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.m}>
          <circle cx={X(i)} cy={Y(d.won)} r={3.5} fill="var(--card)" stroke="var(--ink)" strokeWidth={1.7} />
          <text className="ax" x={X(i)} y={H - P.b + 18} textAnchor="middle">{label(d.m)}</text>
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
      fill={colour(k)} stroke="var(--panel)" strokeWidth={2} />;
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 116, flex: "none" }}>
        <svg viewBox="0 0 116 116" role="img" aria-label="Виручка за джерелами">
          {arcs.length ? arcs : <circle cx={58} cy={58} r={42} fill="var(--rail-track)" />}
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
  const palette = ["var(--accent-soft)", "var(--teal)", "var(--blue)", "var(--accent-pale)"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Розподіл угод">
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
            <text className="ax" x={cx} y={Y(v) - 6} textAnchor="middle" fill="var(--ink)" fontWeight={700}>{short(v)}</text>
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
            <text className="ax" x={0} y={y + 16} fill="var(--ink)" fontWeight={600} fontSize={12}>{k}</text>
            <rect x={200} y={y + 5} width={w} height={16} rx={5} fill={colour(k)} />
            <text className="ax" x={200 + w + 8} y={y + 17} fill="var(--ink)" fontWeight={700}>{uah(v)} ₴</text>
          </g>
        );
      })}
    </svg>
  );
}

function Funnel({ steps }: { steps: Array<[string, number]> }) {
  const mx = Math.max(...steps.map((s) => s[1]), 1), W = 440, rh = 42;
  const fills = ["var(--accent-deep)", "var(--teal)", "var(--accent-soft)", "var(--accent-pale)"];
  return (
    <svg viewBox={`0 0 ${W} ${steps.length * rh + 10}`} role="img" aria-label="Наскрізна воронка">
      {steps.map(([k, v], i) => {
        const y = i * rh + 8, w = Math.max(2, ((W - 150) * v) / mx);
        const conv = i > 0 && steps[i - 1][1] ? pct(v, steps[i - 1][1]).toFixed(0) + "%" : "";
        return (
          <g key={k}>
            <text className="ax" x={0} y={y + 16} fill="var(--ink)" fontWeight={600} fontSize={12}>{k}</text>
            <rect x={118} y={y + 4} width={w} height={18} rx={6} fill={fills[i % fills.length]} />
            <text className="ax" x={118 + w + 8} y={y + 17} fill="var(--ink)" fontWeight={700}>{uah(v)}</text>
            {conv && <text className="ax" x={118} y={y + 34} fontSize={10.5}>конверсія кроку {conv}</text>}
          </g>
        );
      })}
    </svg>
  );
}
