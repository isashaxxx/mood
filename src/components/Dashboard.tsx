"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const NAV_ICONS: Record<View, string> = {
  db: "▦",
  ld: "◌",
  dl: "◫",
  sr: "◎",
};
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

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
        <Sidebar view={view} setView={setView} />
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
        <Sidebar view={view} setView={setView} />
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
  const activeFilterCount = [selectedSource, selectedChannel].filter(Boolean).length;
  const resetFilters = () => {
    setSelectedMonth(null);
    setSelectedSource(null);
    setSelectedChannel(null);
    setQuery("");
    setFiltersOpen(false);
  };

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} onLogout={logout} />
      <main className="main-frame">
        <header className="topbar">
          <label className="global-search">
            <span className="search-glyph" aria-hidden>⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук клієнта, джерела або каналу…"
              aria-label="Пошук клієнта, джерела або каналу"
            />
          </label>
          <button
            className="utility-button"
            type="button"
            onClick={() => load().catch(() => undefined)}
            disabled={loading}
            aria-label={loading ? "Оновлюю дані" : "Оновити дані"}
            title={loading ? "Оновлюю дані" : "Оновити дані"}
          >
            {loading ? "…" : "↻"}
          </button>
          <div className="filter-control">
            {filtersOpen ? <button type="button" className="filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Закрити фільтри" /> : null}
            <button
              className={"filters-trigger" + (activeFilterCount ? " has-active" : "")}
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              aria-controls="dashboard-filters"
            >
              <span aria-hidden>☷</span> Фільтри
              {activeFilterCount ? <b>{activeFilterCount}</b> : null}
            </button>
            {filtersOpen ? (
              <div id="dashboard-filters" className="filter-popover" role="dialog" aria-label="Фільтри аналітики">
                <div className="filter-popover-head">
                  <div><strong>Фільтри</strong><span>Змінюють усі показники на екрані</span></div>
                  <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Закрити фільтри">×</button>
                </div>
                <FilterSelect label="Місяць створення" items={allMonths} selected={selectedMonth}
                  render={label} choose={setSelectedMonth} allLabel="Всі місяці" />
                <FilterSelect label="Джерело" items={allSources} selected={selectedSource}
                  choose={setSelectedSource} allLabel="Всі джерела" />
                {view === "ld" ? (
                  <FilterSelect label="Канал" items={allChannels} selected={selectedChannel}
                    choose={setSelectedChannel} allLabel="Всі канали" />
                ) : null}
                <div className="filter-actions">
                  <button className="clear-filters" type="button" onClick={resetFilters}>Скинути</button>
                  <button className="apply-filters" type="button" onClick={() => setFiltersOpen(false)}>Готово</button>
                </div>
              </div>
            ) : null}
          </div>
          <span className="topbar-divider" aria-hidden />
          <div className="topbar-profile" title={sourceLabel}>
            <span className="top-avatar" aria-hidden>{user.slice(0, 1).toUpperCase()}</span>
            <span className="topbar-user"><strong>{user}</strong><small>Адміністратор</small></span>
          </div>
          <DashboardEditToolbar editor={editor} className="top-editor-toolbar" />
        </header>

        {selectedSource || selectedChannel || query ? (
          <div className="active-filter-bar" aria-label="Активні фільтри">
            <span>Активні:</span>
            {selectedSource ? <button type="button" onClick={() => setSelectedSource(null)}>{selectedSource} ×</button> : null}
            {selectedChannel ? <button type="button" onClick={() => setSelectedChannel(null)}>{selectedChannel} ×</button> : null}
            {query ? <button type="button" onClick={() => setQuery("")}>Пошук: {query} ×</button> : null}
          </div>
        ) : null}

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

function Sidebar({ view, setView, onLogout }: { view: View; setView: (v: View) => void; onLogout?: () => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>✦</span>
        <span>MOODua</span>
      </div>

      <div className="sidebar-content">
        <div className="navlbl">Огляд</div>
        <nav className="nav" aria-label="Аналітика">
          {VIEWS.map(([v, name]) => (
            <button key={v} aria-current={view === v ? "page" : undefined}
              onClick={(event) => { event.currentTarget.blur(); setView(v); }}>
              <span className="nav-icon" aria-hidden>{NAV_ICONS[v]}</span>
              {name}
            </button>
          ))}
        </nav>

        <div className="navlbl">Дані</div>
        <div className="nav">
          <button className="static" type="button"><span className="nav-icon" aria-hidden>◫</span>Угоди · 2026</button>
          <button className="static" type="button"><span className="nav-icon" aria-hidden>◌</span>All leads · 2026</button>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings static" type="button"><span className="nav-icon" aria-hidden>⚙</span>Налаштування</button>
        {onLogout ? <button className="logout" type="button" onClick={onLogout}>Вийти</button> : null}
      </div>
    </aside>
  );
}

function FilterSelect({ label: title, items, selected, choose, render, allLabel }: {
  label: string; items: string[]; selected: string | null;
  choose: (v: string | null) => void; render?: (v: string) => string; allLabel: string;
}) {
  return (
    <label className="filter-select">
      <span className="fl">{title}</span>
      <select value={selected ?? ""} onChange={(event) => choose(event.target.value || null)}>
        <option value="">{allLabel}</option>
        {items.map((value) => <option key={value} value={value}>{render ? render(value) : value}</option>)}
      </select>
    </label>
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
  const leadTotal = leads.reduce((sum, row) => sum + row.total, 0);
  const perMonth = months.map((month) => ({
    m: month,
    won: deals.filter((row) => row.month === month).reduce((sum, row) => sum + row.won, 0),
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
  const dealTotal = totals.pipelineCount + totals.wonCount + totals.lostCount;
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

  const blocks: EditableBlockDefinition[] = [
    {
      id: "dashboard-kpis",
      title: "Ключові показники",
      children: (
        <section className="quick-section" aria-labelledby="quick-metrics-title">
          <div className="section-heading compact-heading">
            <div><h2 id="quick-metrics-title">Ключові показники</h2><p>Зріз за вибраним періодом</p></div>
          </div>
          <div className="quick-grid">
            <article className="quick-card">
              <span className="metric-icon lead-icon" aria-hidden>◌</span>
              <div><small>Ліди</small><strong>{uah(leadTotal)}</strong><span>з бази All leads</span></div>
              <button type="button" className="card-menu" onClick={() => onViewChange("ld")} aria-label="Відкрити ліди">⋮</button>
            </article>
            <article className="quick-card">
              <span className="metric-icon pipeline-icon" aria-hidden>◫</span>
              <div><small>Пайплайн</small><strong>{short(totals.pipeline)} ₴</strong><span>{totals.pipelineCount} відкритих угод</span></div>
              <button type="button" className="card-menu" onClick={() => onViewChange("dl")} aria-label="Відкрити угоди">⋮</button>
            </article>
            <article className="quick-card">
              <span className="metric-icon rate-icon" aria-hidden>◔</span>
              <div><small>Win rate</small><strong>{winRate.toFixed(0)}%</strong><span>{totals.wonCount} виграно</span></div>
              <button type="button" className="card-menu" onClick={() => onViewChange("sr")} aria-label="Відкрити джерела">⋮</button>
            </article>
          </div>
        </section>
      ),
    },
    {
      id: "dashboard-revenue",
      title: "Джерела та динаміка",
      children: (
        <>
          <SourceCarousel rows={sourceRows} totalRevenue={totals.won} onOpenSources={() => onViewChange("sr")} />
          <div className="grid g21">
            <div className="card">
              <div className="ch">Виручка за місяцями <small>за місяцем створення угоди</small></div>
              <LineChart data={perMonth} />
            </div>
            <div className="card">
              <div className="ch">Виручка за джерелами</div>
              <Donut rows={sourceRows.map((row) => [row.source, row.won] as [string, number])} />
            </div>
          </div>
        </>
      ),
    },
    {
      id: "dashboard-clients",
      title: "Пріоритетні угоди",
      children: (
        <section className="priority-section">
          <div className="section-heading">
            <div><h2>Пріоритетні угоди</h2><p>Клієнти з найбільшим результатом і відкритим потенціалом</p></div>
            <button className="section-link" type="button" onClick={() => onViewChange("dl")}>Усі угоди <span>→</span></button>
          </div>
          <div className="grid g11">
            <div className="card">
              <div className="ch">Топ клієнтів <small>лише виграні угоди</small></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Компанія</th><th>Виграно</th><th>Виручка</th></tr></thead>
                <tbody>
                  {topRevenue.length === 0 ? <tr><td colSpan={3} className="empty">Немає виграних угод за фільтром</td></tr> : null}
                  {topRevenue.map((row) => <tr key={row.company}><td>{row.company}</td><td>{row.wonCount}</td><td>{uah(row.won)} ₴</td></tr>)}
                </tbody>
              </table></div>
            </div>
            <div className="card">
              <div className="ch">Топ відкритих угод <small>без виграних і програних</small></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Компанія</th><th>Відкрито</th><th>Пайплайн</th></tr></thead>
                <tbody>
                  {topOpenPipeline.length === 0 ? <tr><td colSpan={3} className="empty">Немає відкритих угод за фільтром</td></tr> : null}
                  {topOpenPipeline.map((row) => <tr key={row.company}><td>{row.company}</td><td>{row.openCount}</td><td>{uah(row.openPipeline)} ₴</td></tr>)}
                </tbody>
              </table></div>
            </div>
          </div>
        </section>
      ),
    },
    {
      id: "dashboard-funnel",
      title: "Воронка угод",
      children: <div className="grid g11">
        <div className="card">
          <div className="ch">Розподіл угод</div>
          <Bars rows={[["Відкриті", totals.pipelineCount], ["Виграні", totals.wonCount], ["Програні", totals.lostCount]]} />
        </div>
        <div className="card">
          <div className="ch">Наскрізна воронка</div>
          <Funnel steps={[
            ["Ліди", leadTotal],
            ["MQL + SQL", leads.reduce((sum, row) => sum + row.mql + row.sql_, 0)],
            ["Запити в CRM", totals.pipelineCount],
            ["Виграно", totals.wonCount],
          ]} />
          <div className="note">Угоди зараховані в місяць створення в Excel-файлі. Дані беруться тільки з баз «Угоди_2026» та «All leads».</div>
        </div>
      </div>,
    },
  ];

  return (
    <div className="dashboard-layout">
      <div className="dashboard-left">
        <section className="overview-hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">MOODua Analytics</span>
            <h1>Результати маркетингу<br />за {periodLabel}</h1>
            <p>Виграно {totals.wonCount} угод на {short(totals.won)} ₴</p>
            <button type="button" onClick={() => onViewChange("dl")}>Перейти до угод <span aria-hidden>→</span></button>
          </div>
          <div className="hero-sparkles" aria-hidden><i /><i /><i /></div>
        </section>
        <EditableBlocks editor={editor} blocks={blocks} metrics={metrics} chartSeries={chartSeries} />
      </div>
      <DashboardSummaryRail
        winRate={winRate}
        totals={totals}
        perMonth={perMonth}
        sourceRows={sourceRows}
        onOpenSources={() => onViewChange("sr")}
      />
    </div>
  );
}

function SourceCarousel({ rows, totalRevenue, onOpenSources }: {
  rows: DashboardSourceSummary[];
  totalRevenue: number;
  onOpenSources: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => trackRef.current?.scrollBy({ left: direction * 388, behavior: "smooth" });
  return (
    <section className="source-carousel">
      <div className="section-heading">
        <div><h2>Канали з потенціалом</h2><p>Джерела, де варто сфокусувати наступний бюджет</p></div>
        <div className="carousel-actions">
          <button type="button" onClick={() => scroll(-1)} aria-label="Попередні джерела">‹</button>
          <button type="button" onClick={() => scroll(1)} aria-label="Наступні джерела">›</button>
        </div>
      </div>
      <div className="source-track" ref={trackRef} tabIndex={0} aria-label="Карусель джерел">
        {rows.length === 0 ? <p className="empty source-empty">Немає даних за фільтром</p> : null}
        {rows.slice(0, 8).map((row, index) => {
          const closed = row.wonCount + row.lostCount;
          const rate = pct(row.wonCount, closed);
          const share = totalRevenue ? Math.max(4, Math.min(100, pct(row.won, totalRevenue))) : 4;
          const signal = Math.max(12, Math.min(100, rate));
          return (
            <article className="source-insight-card" key={row.source}>
              <div className="source-visual">
                <div className="source-card-head">
                  <span className="source-token" style={{ background: colour(row.source) }} />
                  <span className="source-order">0{index + 1}</span>
                  <button type="button" aria-label={"Відкрити " + row.source} onClick={onOpenSources}>↗</button>
                </div>
                <div className="source-signal" aria-hidden>
                  <i style={{ height: String(Math.max(24, signal * .54)) + "%" }} />
                  <i style={{ height: String(Math.max(34, share * .74)) + "%" }} />
                  <i style={{ height: String(Math.max(20, signal)) + "%" }} />
                  <i style={{ height: String(Math.max(30, share)) + "%" }} />
                </div>
                <span className="source-visual-caption">ефективність каналу</span>
              </div>
              <div className="source-card-body">
                <small>{row.source}</small>
                <strong>{short(row.won)} ₴</strong>
                <span>{row.wonCount} виграно · {rate.toFixed(0)}% win rate</span>
                <div className="source-progress"><i style={{ width: String(share) + "%" }} /></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DashboardSummaryRail({ winRate, totals, perMonth, sourceRows, onOpenSources }: {
  winRate: number;
  totals: Record<string, number>;
  perMonth: Array<{ m: string; won: number }>;
  sourceRows: DashboardSourceSummary[];
  onOpenSources: () => void;
}) {
  const rate = Math.max(0, Math.min(100, winRate));
  const max = Math.max(...perMonth.map((item) => item.won), 1);
  const totalClosed = totals.wonCount + totals.lostCount;
  return (
    <aside className="summary-rail" aria-label="Зведення періоду">
      <section className="summary-card">
        <div className="summary-heading"><h2>Статистика</h2><button type="button" aria-label="Більше дій">⋮</button></div>
        <div className="win-ring-wrap">
          <div className="win-ring" style={{ background: "conic-gradient(var(--teal) " + rate + "%, var(--rail-track) " + rate + "% 100%)" }}>
            <div><strong>{rate.toFixed(0)}%</strong><span>Win rate</span></div>
          </div>
        </div>
        <div className="summary-caption">
          <strong>{totals.wonCount} виграно з {totalClosed}</strong>
          <span>Угоди за активним фільтром</span>
        </div>
        <div className="rail-chart">
          <div className="rail-chart-head"><span>Виручка за місяцями</span><b>{short(totals.won)} ₴</b></div>
          <div className="mini-bars">
            {perMonth.length === 0 ? <span className="empty">Немає даних</span> : null}
            {perMonth.slice(-6).map((item) => (
              <div className="mini-bar" key={item.m}>
                <i style={{ height: String(Math.max(8, (item.won / max) * 100)) + "%" }} />
                <span>{label(item.m)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rail-section-head"><h3>Топ джерела</h3><button type="button" onClick={onOpenSources} aria-label="Відкрити всі джерела">+</button></div>
        <div className="rail-source-list">
          {sourceRows.slice(0, 3).map((row) => (
            <button className="rail-source-row" type="button" key={row.source} onClick={onOpenSources}>
              <span className="source-token" style={{ background: colour(row.source) }} />
              <span><strong>{row.source}</strong><small>{row.wonCount} виграно</small></span>
              <b>{short(row.won)} ₴</b>
            </button>
          ))}
          {sourceRows.length === 0 ? <p className="empty">Немає джерел</p> : null}
        </div>
        <button className="rail-all" type="button" onClick={onOpenSources}>Усі джерела <span>→</span></button>
      </section>
    </aside>
  );
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
function LineChart({ data }: { data: Array<{ m: string; won: number }> }) {
  const W = 640, H = 224, P = { t: 12, r: 16, b: 26, l: 48 };
  const mx = Math.max(...data.map((d) => d.won), 1);
  const X = (i: number) => P.l + (W - P.l - P.r) * (data.length > 1 ? i / (data.length - 1) : 0.5);
  const Y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / mx);
  const path = data.map((d, i) => `${i ? "L" : "M"}${X(i)},${Y(d.won)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Виручка по місяцях">
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
          <path d={`${path} L${X(data.length - 1)},${H - P.b} L${X(0)},${H - P.b} Z`} fill="var(--chart-fill)" />
          <path d={path} fill="none" stroke="var(--accent-deep)" strokeWidth={2.5} strokeLinejoin="round" />
        </>
      )}
      {data.map((d, i) => (
        <g key={d.m}>
          <circle cx={X(i)} cy={Y(d.won)} r={4} fill="#fff" stroke="var(--accent-deep)" strokeWidth={2} />
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
