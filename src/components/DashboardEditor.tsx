"use client";

import {
  createDashboardLayout,
  DASHBOARD_LAYOUT_VERSION,
  evaluateDashboardFormula,
  isFormulaMetricId,
  MAX_DASHBOARD_WIDGETS,
  normalizeDashboardLayout,
  readDashboardLayout,
  type DashboardChartType,
  type DashboardLayoutConfig,
  type DashboardWidget,
  type DashboardWidgetFormat,
  writeDashboardLayout,
} from "@/lib/dashboard-editor";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import styles from "./DashboardEditor.module.css";

export type DashboardEditorBlock = {
  /** Stable, machine-readable id. Do not use a title here. */
  id: string;
  title: string;
  children: ReactNode;
  description?: string;
  className?: string;
};

export type DashboardFormulaMetric = {
  /** ASCII identifier used in formulas, e.g. `revenue / spend * 100`. */
  id: string;
  label: string;
  value: number;
};

export type DashboardChartPoint = {
  label: string;
  value: number;
};

export type DashboardChartSeries = {
  id: string;
  label: string;
  points: DashboardChartPoint[];
};

export type DashboardEditorController = {
  config: DashboardLayoutConfig;
  isReady: boolean;
  isEditing: boolean;
  orderedIds: string[];
  hiddenIds: ReadonlySet<string>;
  collapsedIds: ReadonlySet<string>;
  setEditing: (value: boolean) => void;
  toggleEditing: () => void;
  move: (id: string, direction: -1 | 1) => void;
  canMove: (id: string, direction: -1 | 1) => boolean;
  toggleHidden: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  addFormula: (widget: Omit<Extract<DashboardWidget, { kind: "formula" }>, "id" | "kind">) => void;
  addChart: (widget: Omit<Extract<DashboardWidget, { kind: "chart" }>, "id" | "kind">) => void;
  removeWidget: (id: string) => void;
  reset: () => void;
};

export type UseDashboardEditorOptions = {
  dashboardId: string;
  /** ids of regular, code-defined blocks; custom widgets are managed automatically */
  blockIds: readonly string[];
  initialEditMode?: boolean;
  onConfigChange?: (config: DashboardLayoutConfig) => void;
};

function dedupeIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function widgetId(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `widget_${random.slice(0, 64)}`;
}

function updateList(items: string[], id: string): string[] {
  return items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
}

/**
 * SSR-safe state and persistence for a configurable dashboard. It stores only
 * a small layout config in localStorage; the API data itself is never cached.
 */
export function useDashboardEditor({
  dashboardId,
  blockIds,
  initialEditMode = false,
  onConfigChange,
}: UseDashboardEditorOptions): DashboardEditorController {
  const rawBlockSignature = blockIds.filter(Boolean).join("\u0001");
  const staticBlockIds = useMemo(() => dedupeIds(blockIds), [rawBlockSignature]);
  const staticBlockSignature = staticBlockIds.join("\u0001");
  const [config, setConfig] = useState<DashboardLayoutConfig>(() => createDashboardLayout(staticBlockIds));
  const [isReady, setIsReady] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const callbackRef = useRef(onConfigChange);

  useEffect(() => {
    callbackRef.current = onConfigChange;
  }, [onConfigChange]);

  // localStorage is deliberately read only after hydration, so the server and
  // initial client render are identical.
  useEffect(() => {
    setIsReady(false);
    setConfig(readDashboardLayout(dashboardId, staticBlockIds));
    setIsReady(true);
  }, [dashboardId, staticBlockSignature]);

  useEffect(() => {
    if (!isReady) return;
    writeDashboardLayout(dashboardId, config);
    callbackRef.current?.(config);
  }, [config, dashboardId, isReady]);

  const updateConfig = useCallback(
    (update: (current: DashboardLayoutConfig) => DashboardLayoutConfig) => {
      setConfig((current) => normalizeDashboardLayout(update(current), staticBlockIds));
    },
    [staticBlockSignature]
  );

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      updateConfig((current) => {
        const from = current.order.indexOf(id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= current.order.length) return current;
        const order = [...current.order];
        [order[from], order[to]] = [order[to], order[from]];
        return { ...current, order };
      });
    },
    [updateConfig]
  );

  const canMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = config.order.indexOf(id);
      return index >= 0 && index + direction >= 0 && index + direction < config.order.length;
    },
    [config.order]
  );

  const toggleHidden = useCallback(
    (id: string) => updateConfig((current) => ({ ...current, hidden: updateList(current.hidden, id) })),
    [updateConfig]
  );
  const toggleCollapsed = useCallback(
    (id: string) => updateConfig((current) => ({ ...current, collapsed: updateList(current.collapsed, id) })),
    [updateConfig]
  );

  const addFormula = useCallback(
    (widget: Omit<Extract<DashboardWidget, { kind: "formula" }>, "id" | "kind">) => {
      updateConfig((current) => {
        if (current.widgets.length >= MAX_DASHBOARD_WIDGETS) return current;
        const nextWidget: DashboardWidget = { id: widgetId(), kind: "formula", ...widget };
        return {
          ...current,
          widgets: [...current.widgets, nextWidget],
          order: [...current.order, nextWidget.id],
        };
      });
    },
    [updateConfig]
  );

  const addChart = useCallback(
    (widget: Omit<Extract<DashboardWidget, { kind: "chart" }>, "id" | "kind">) => {
      updateConfig((current) => {
        if (current.widgets.length >= MAX_DASHBOARD_WIDGETS) return current;
        const nextWidget: DashboardWidget = { id: widgetId(), kind: "chart", ...widget };
        return {
          ...current,
          widgets: [...current.widgets, nextWidget],
          order: [...current.order, nextWidget.id],
        };
      });
    },
    [updateConfig]
  );

  const removeWidget = useCallback(
    (id: string) => {
      updateConfig((current) => {
        if (!current.widgets.some((widget) => widget.id === id)) return current;
        return {
          ...current,
          widgets: current.widgets.filter((widget) => widget.id !== id),
          order: current.order.filter((item) => item !== id),
          hidden: current.hidden.filter((item) => item !== id),
          collapsed: current.collapsed.filter((item) => item !== id),
        };
      });
    },
    [updateConfig]
  );

  const reset = useCallback(() => {
    setConfig(createDashboardLayout(staticBlockIds));
  }, [staticBlockSignature]);

  return {
    config,
    isReady,
    isEditing,
    orderedIds: config.order,
    hiddenIds: useMemo(() => new Set(config.hidden), [config.hidden]),
    collapsedIds: useMemo(() => new Set(config.collapsed), [config.collapsed]),
    setEditing: setIsEditing,
    toggleEditing: () => setIsEditing((current) => !current),
    move,
    canMove,
    toggleHidden,
    toggleCollapsed,
    addFormula,
    addChart,
    removeWidget,
    reset,
  };
}

export type DashboardEditorProps = {
  dashboardId: string;
  blocks: DashboardEditorBlock[];
  metrics?: DashboardFormulaMetric[];
  chartSeries?: DashboardChartSeries[];
  className?: string;
  showToolbar?: boolean;
  initialEditMode?: boolean;
  onConfigChange?: (config: DashboardLayoutConfig) => void;
};

/**
 * Drop-in renderer for dashboard blocks. For placing the edit button in an
 * existing top bar, use `useDashboardEditor` with `DashboardEditToolbar` and
 * `DashboardEditableBlock` instead.
 */
export function DashboardEditor({
  dashboardId,
  blocks,
  metrics = [],
  chartSeries = [],
  className,
  showToolbar = true,
  initialEditMode,
  onConfigChange,
}: DashboardEditorProps) {
  const blockIds = blocks.map((block) => block.id);
  const editor = useDashboardEditor({ dashboardId, blockIds, initialEditMode, onConfigChange });
  const blockMap = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);
  const widgetMap = useMemo(() => new Map(editor.config.widgets.map((widget) => [widget.id, widget])), [editor.config.widgets]);

  return (
    <section className={[styles.editor, className].filter(Boolean).join(" ")} data-layout-version={DASHBOARD_LAYOUT_VERSION}>
      {showToolbar ? <DashboardEditToolbar editor={editor} /> : null}
      <div className={styles.stack}>
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
                className={block.className}
              >
                {block.children}
              </DashboardEditableBlock>
            );
          }
          const widget = widgetMap.get(id);
          if (!widget) return null;
          return (
            <DashboardEditableBlock
              key={widget.id}
              editor={editor}
              id={widget.id}
              title={widget.title}
              removable
            >
              <DashboardCustomWidget widget={widget} metrics={metrics} chartSeries={chartSeries} />
            </DashboardEditableBlock>
          );
        })}
      </div>
      {editor.isEditing ? <DashboardWidgetComposer editor={editor} metrics={metrics} chartSeries={chartSeries} /> : null}
    </section>
  );
}

export function DashboardEditToolbar({ editor, className }: { editor: DashboardEditorController; className?: string }) {
  return (
    <div className={[styles.toolbar, className].filter(Boolean).join(" ")}>
      <button type="button" className={styles.editButton} onClick={editor.toggleEditing} aria-pressed={editor.isEditing}>
        {editor.isEditing ? "Готово" : "Редагувати"}
      </button>
      {editor.isEditing ? (
        <>
          <span className={styles.saved} aria-live="polite">
            {editor.isReady ? "Зміни збережено в цьому браузері" : "Завантажую макет…"}
          </span>
          <button type="button" className={styles.resetButton} onClick={editor.reset}>
            Скинути макет
          </button>
        </>
      ) : null}
    </div>
  );
}

export function DashboardEditableBlock({
  editor,
  id,
  title,
  description,
  children,
  className,
  removable = false,
}: {
  editor: DashboardEditorController;
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  removable?: boolean;
}) {
  const hidden = editor.hiddenIds.has(id);
  const collapsed = editor.collapsedIds.has(id);
  if (hidden && !editor.isEditing) return null;

  return (
    <section
      className={[styles.block, className, hidden ? styles.hiddenBlock : "", editor.isEditing ? styles.editingBlock : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
      data-dashboard-block={id}
    >
      {editor.isEditing ? (
        <div className={styles.blockTools}>
          <div className={styles.blockLabel}>
            <strong>{title}</strong>
            {description ? <span>{description}</span> : null}
          </div>
          <div className={styles.toolButtons}>
            <button type="button" onClick={() => editor.move(id, -1)} disabled={!editor.canMove(id, -1)} aria-label={`Перемістити «${title}» вище`}>
              ↑
            </button>
            <button type="button" onClick={() => editor.move(id, 1)} disabled={!editor.canMove(id, 1)} aria-label={`Перемістити «${title}» нижче`}>
              ↓
            </button>
            <button type="button" onClick={() => editor.toggleCollapsed(id)} aria-expanded={!collapsed}>
              {collapsed ? "Розгорнути" : "Згорнути"}
            </button>
            <button type="button" onClick={() => editor.toggleHidden(id)} aria-pressed={hidden}>
              {hidden ? "Показати" : "Сховати"}
            </button>
            {removable ? (
              <button type="button" className={styles.removeButton} onClick={() => editor.removeWidget(id)} aria-label={`Видалити «${title}»`}>
                Видалити
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {hidden ? <p className={styles.hiddenMessage}>Блок приховано. Натисніть «Показати», щоб повернути його.</p> : null}
      {!hidden && collapsed ? (
        <button type="button" className={styles.expandButton} onClick={() => editor.toggleCollapsed(id)} aria-expanded="false">
          Розгорнути «{title}»
        </button>
      ) : null}
      {!hidden && !collapsed ? children : null}
    </section>
  );
}

export type DashboardCustomWidgetProps = {
  widget: DashboardWidget;
  metrics: DashboardFormulaMetric[];
  chartSeries: DashboardChartSeries[];
};

/** Renders a saved formula or chart widget inside a custom DashboardEditableBlock. */
export function DashboardCustomWidget({
  widget,
  metrics,
  chartSeries,
}: DashboardCustomWidgetProps) {
  if (widget.kind === "formula") {
    const values = Object.fromEntries(
      metrics.filter((metric) => isFormulaMetricId(metric.id)).map((metric) => [metric.id, metric.value])
    );
    try {
      const value = evaluateDashboardFormula(widget.expression, values);
      return (
        <div className={styles.widgetCard}>
          <div className={styles.widgetTitle}>{widget.title}</div>
          <div className={styles.formulaValue}>{formatWidgetValue(value, widget.format)}</div>
          <code className={styles.expression}>{widget.expression}</code>
        </div>
      );
    } catch (error) {
      return (
        <div className={[styles.widgetCard, styles.widgetError].join(" ")} role="status">
          <div className={styles.widgetTitle}>{widget.title}</div>
          <p>Формула потребує уваги: {error instanceof Error ? error.message : "невідома помилка"}</p>
          <code className={styles.expression}>{widget.expression}</code>
        </div>
      );
    }
  }

  const series = chartSeries.find((item) => item.id === widget.seriesId);
  return (
    <div className={styles.widgetCard}>
      <div className={styles.widgetTitle}>{widget.title}</div>
      {series ? <SimpleChart series={series} type={widget.chartType} /> : <p className={styles.noData}>Для графіка більше немає вибраного набору даних.</p>}
    </div>
  );
}

export type DashboardWidgetComposerProps = {
  editor: DashboardEditorController;
  metrics: DashboardFormulaMetric[];
  chartSeries: DashboardChartSeries[];
};

/**
 * Standalone composer for an existing dashboard layout. Pair it with
 * `useDashboardEditor` and place it after the current blocks when the header
 * needs to keep its own markup.
 */
export function DashboardWidgetComposer({
  editor,
  metrics,
  chartSeries,
}: DashboardWidgetComposerProps) {
  const formulaMetrics = metrics.filter((metric) => isFormulaMetricId(metric.id));
  const [kind, setKind] = useState<"formula" | "chart">("formula");
  const [title, setTitle] = useState("");
  const [expression, setExpression] = useState("");
  const [format, setFormat] = useState<DashboardWidgetFormat>("number");
  const [seriesId, setSeriesId] = useState("");
  const [chartType, setChartType] = useState<DashboardChartType>("bar");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seriesId && chartSeries[0]) setSeriesId(chartSeries[0].id);
  }, [chartSeries, seriesId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (kind === "formula") {
      const values = Object.fromEntries(formulaMetrics.map((metric) => [metric.id, metric.value]));
      try {
        evaluateDashboardFormula(expression, values);
        editor.addFormula({ title: title.trim() || "Власна формула", expression: expression.trim(), format });
        setTitle("");
        setExpression("");
      } catch (formulaError) {
        setError(formulaError instanceof Error ? formulaError.message : "Перевірте формулу");
      }
      return;
    }
    if (!seriesId || !chartSeries.some((series) => series.id === seriesId)) {
      setError("Оберіть набір даних для графіка");
      return;
    }
    editor.addChart({ title: title.trim() || "Власний графік", seriesId, chartType });
    setTitle("");
  }

  const atLimit = editor.config.widgets.length >= MAX_DASHBOARD_WIDGETS;
  return (
    <form className={styles.composer} onSubmit={submit}>
      <div className={styles.composerHeading}>
        <div>
          <strong>Додати свій блок</strong>
          <span>Формули рахуються лише з доступних метрик; дані не зберігаються в браузері.</span>
        </div>
        <span className={styles.counter}>{editor.config.widgets.length}/{MAX_DASHBOARD_WIDGETS}</span>
      </div>
      <div className={styles.formGrid}>
        <label>
          Тип
          <select value={kind} onChange={(event) => setKind(event.target.value as "formula" | "chart")}>
            <option value="formula">Формула</option>
            <option value="chart">Графік</option>
          </select>
        </label>
        <label>
          Назва
          <input value={title} maxLength={64} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "formula" ? "Наприклад, ROMI" : "Наприклад, Ліди за місяцями"} />
        </label>
        {kind === "formula" ? (
          <>
            <label className={styles.wideField}>
              Формула
              <input
                value={expression}
                maxLength={180}
                onChange={(event) => setExpression(event.target.value)}
                placeholder="revenue / spend * 100"
                aria-describedby="formula-help"
              />
            </label>
            <label>
              Формат
              <select value={format} onChange={(event) => setFormat(event.target.value as DashboardWidgetFormat)}>
                <option value="number">Число</option>
                <option value="currency">Гривні</option>
                <option value="percent">Відсотки</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              Дані
              <select value={seriesId} onChange={(event) => setSeriesId(event.target.value)} disabled={!chartSeries.length}>
                {!chartSeries.length ? <option value="">Немає доступних даних</option> : null}
                {chartSeries.map((series) => <option key={series.id} value={series.id}>{series.label}</option>)}
              </select>
            </label>
            <label>
              Вигляд
              <select value={chartType} onChange={(event) => setChartType(event.target.value as DashboardChartType)}>
                <option value="bar">Стовпчики</option>
                <option value="line">Лінія</option>
              </select>
            </label>
          </>
        )}
      </div>
      {kind === "formula" ? (
        <p id="formula-help" className={styles.help}>
          Доступні метрики: {formulaMetrics.length ? formulaMetrics.map((metric) => `${metric.label} — ${metric.id}`).join(" · ") : "додайте metrics під час підключення"}. Підтримуються +, −, ×, ÷ і дужки.
        </p>
      ) : null}
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      <button type="submit" className={styles.addButton} disabled={atLimit || (kind === "chart" && !chartSeries.length)}>
        {atLimit ? "Досягнуто ліміт блоків" : kind === "formula" ? "Додати формулу" : "Додати графік"}
      </button>
    </form>
  );
}

function formatWidgetValue(value: number, format: DashboardWidgetFormat): string {
  if (format === "currency") return `${value.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴`;
  if (format === "percent") return `${value.toLocaleString("uk-UA", { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString("uk-UA", { maximumFractionDigits: 2 });
}

function SimpleChart({ series, type }: { series: DashboardChartSeries; type: DashboardChartType }) {
  const points = series.points.filter((point) => Number.isFinite(point.value)).slice(-24);
  if (!points.length) return <p className={styles.noData}>Немає значень для побудови графіка.</p>;

  const width = 560;
  const height = 200;
  const padding = { top: 14, right: 12, bottom: 32, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.value), 0, 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = max - min || 1;
  const y = (value: number) => padding.top + ((max - value) / range) * chartHeight;
  const x = (index: number) => padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const baseline = y(0);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.label}: ${type === "bar" ? "стовпчиковий" : "лінійний"} графік`}>
        {[0, 0.5, 1].map((ratio) => {
          const value = min + (max - min) * ratio;
          const yy = y(value);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={yy} y2={yy} className={styles.gridLine} />
              <text x={padding.left - 7} y={yy + 4} textAnchor="end" className={styles.axisText}>{formatAxis(value)}</text>
            </g>
          );
        })}
        {type === "bar"
          ? points.map((point, index) => {
              const barWidth = Math.max(8, Math.min(34, chartWidth / Math.max(points.length, 1) - 8));
              const yy = y(point.value);
              return <rect key={`${point.label}-${index}`} x={x(index) - barWidth / 2} y={Math.min(yy, baseline)} width={barWidth} height={Math.max(1, Math.abs(baseline - yy))} rx={4} className={styles.bar} />;
            })
          : <path d={line} fill="none" className={styles.line} />}
        {type === "line" ? points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={3.5} className={styles.point} />) : null}
        {tickIndexes.map((index) => <text key={index} x={x(index)} y={height - 9} textAnchor="middle" className={styles.axisText}>{points[index]?.label}</text>)}
      </svg>
      <div className={styles.chartCaption}>{series.label}</div>
    </div>
  );
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return Math.round(value).toString();
}
