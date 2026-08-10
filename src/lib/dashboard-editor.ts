/**
 * The persisted part of the dashboard editor deliberately contains only user
 * preferences — never dashboard data or React nodes.  That keeps localStorage
 * small and lets live data continue to come from the API on every page load.
 */
export const DASHBOARD_LAYOUT_VERSION = 1;
export const MAX_DASHBOARD_WIDGETS = 24;

export type DashboardWidgetFormat = "number" | "currency" | "percent";
export type DashboardChartType = "bar" | "line";

export type DashboardFormulaWidget = {
  id: string;
  kind: "formula";
  title: string;
  expression: string;
  format: DashboardWidgetFormat;
};

export type DashboardChartWidget = {
  id: string;
  kind: "chart";
  title: string;
  chartType: DashboardChartType;
  seriesId: string;
};

export type DashboardWidget = DashboardFormulaWidget | DashboardChartWidget;

export type DashboardLayoutConfig = {
  version: typeof DASHBOARD_LAYOUT_VERSION;
  order: string[];
  hidden: string[];
  collapsed: string[];
  widgets: DashboardWidget[];
};

type JsonRecord = Record<string, unknown>;

const WIDGET_ID = /^widget_[a-zA-Z0-9_-]{6,80}$/;
const METRIC_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
}

function uniqueStrings(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !allowed.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    output.push(entry);
  }
  return output;
}

function parseWidget(value: unknown, usedIds: Set<string>): DashboardWidget | null {
  if (!isRecord(value) || typeof value.id !== "string" || !WIDGET_ID.test(value.id) || usedIds.has(value.id)) {
    return null;
  }

  if (value.kind === "formula") {
    if (typeof value.expression !== "string" || value.expression.trim().length === 0 || value.expression.length > 180) {
      return null;
    }
    const format: DashboardWidgetFormat =
      value.format === "currency" || value.format === "percent" ? value.format : "number";
    usedIds.add(value.id);
    return {
      id: value.id,
      kind: "formula",
      title: cleanText(value.title, "Власна формула", 64),
      expression: value.expression.trim(),
      format,
    };
  }

  if (value.kind === "chart" && typeof value.seriesId === "string" && value.seriesId.length <= 80) {
    const chartType: DashboardChartType = value.chartType === "line" ? "line" : "bar";
    usedIds.add(value.id);
    return {
      id: value.id,
      kind: "chart",
      title: cleanText(value.title, "Власний графік", 64),
      chartType,
      seriesId: value.seriesId,
    };
  }

  return null;
}

/** A clean layout for a new dashboard or for a reset action. */
export function createDashboardLayout(staticBlockIds: readonly string[]): DashboardLayoutConfig {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    order: [...new Set(staticBlockIds)],
    hidden: [],
    collapsed: [],
    widgets: [],
  };
}

/**
 * Drops old/unknown ids, appends newly introduced blocks, and makes a malformed
 * localStorage value harmless. This is what makes config changes backwards
 * compatible when the dashboard evolves.
 */
export function normalizeDashboardLayout(value: unknown, staticBlockIds: readonly string[]): DashboardLayoutConfig {
  const staticIds = [...new Set(staticBlockIds.filter(Boolean))];
  if (!isRecord(value) || value.version !== DASHBOARD_LAYOUT_VERSION) {
    return createDashboardLayout(staticIds);
  }

  const usedWidgetIds = new Set(staticIds);
  const widgets = (Array.isArray(value.widgets) ? value.widgets : [])
    .map((widget) => parseWidget(widget, usedWidgetIds))
    .filter((widget): widget is DashboardWidget => widget !== null)
    .slice(0, MAX_DASHBOARD_WIDGETS);
  const validIds = new Set([...staticIds, ...widgets.map((widget) => widget.id)]);
  const order = uniqueStrings(value.order, validIds);
  for (const id of validIds) {
    if (!order.includes(id)) order.push(id);
  }

  return {
    version: DASHBOARD_LAYOUT_VERSION,
    order,
    hidden: uniqueStrings(value.hidden, validIds),
    collapsed: uniqueStrings(value.collapsed, validIds),
    widgets,
  };
}

export function dashboardLayoutStorageKey(dashboardId: string): string {
  return `moodua.dashboard-layout.${dashboardId}.v${DASHBOARD_LAYOUT_VERSION}`;
}

export function readDashboardLayout(dashboardId: string, staticBlockIds: readonly string[]): DashboardLayoutConfig {
  const fallback = createDashboardLayout(staticBlockIds);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(dashboardLayoutStorageKey(dashboardId));
    return raw ? normalizeDashboardLayout(JSON.parse(raw), staticBlockIds) : fallback;
  } catch {
    return fallback;
  }
}

export function writeDashboardLayout(dashboardId: string, config: DashboardLayoutConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dashboardLayoutStorageKey(dashboardId), JSON.stringify(config));
  } catch {
    // Storage can be disabled in private browser contexts. Editing still works
    // in-memory for the current visit, so this is intentionally non-fatal.
  }
}

export function isFormulaMetricId(value: string): boolean {
  return METRIC_ID.test(value);
}

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" };
type FormulaOperator = Extract<FormulaToken, { type: "operator" }>["value"];

function tokenizeFormula(expression: string): FormulaToken[] {
  if (!expression.trim()) throw new Error("Введіть формулу");
  if (expression.length > 180) throw new Error("Формула має бути до 180 символів");

  const tokens: FormulaToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const current = expression[index];
    if (/\s/.test(current)) {
      index += 1;
      continue;
    }
    const numberMatch = expression.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
    if (numberMatch) {
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) throw new Error("Некоректне число");
      tokens.push({ type: "number", value });
      index += numberMatch[0].length;
      continue;
    }
    const identifierMatch = expression.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: "identifier", value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }
    if (current === "+" || current === "-" || current === "*" || current === "/" || current === "(" || current === ")") {
      tokens.push({ type: "operator", value: current });
      index += 1;
      continue;
    }
    throw new Error(`Непідтримуваний символ: ${current}`);
  }
  return tokens;
}

/**
 * Safe arithmetic evaluator for user formulas. It supports only numbers,
 * approved metric ids, parentheses and + - * /. It never calls eval or runs
 * arbitrary JavaScript.
 */
export function evaluateDashboardFormula(expression: string, metrics: Readonly<Record<string, number>>): number {
  const tokens = tokenizeFormula(expression);
  let position = 0;

  const peek = () => tokens[position];
  const takeOperator = (operator: FormulaOperator): boolean => {
    const token = peek();
    if (token?.type === "operator" && token.value === operator) {
      position += 1;
      return true;
    }
    return false;
  };

  const parsePrimary = (): number => {
    const token = peek();
    if (!token) throw new Error("Формула завершена зарано");
    if (token.type === "number") {
      position += 1;
      return token.value;
    }
    if (token.type === "identifier") {
      position += 1;
      const value = metrics[token.value];
      if (!Number.isFinite(value)) throw new Error(`Невідома метрика: ${token.value}`);
      return value;
    }
    if (takeOperator("(")) {
      const value = parseExpression();
      if (!takeOperator(")")) throw new Error("Закрийте дужку");
      return value;
    }
    throw new Error("Очікується число, метрика або дужка");
  };

  const parseUnary = (): number => {
    if (takeOperator("+")) return parseUnary();
    if (takeOperator("-")) return -parseUnary();
    return parsePrimary();
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (true) {
      if (takeOperator("*")) value *= parseUnary();
      else if (takeOperator("/")) {
        const divisor = parseUnary();
        if (divisor === 0) throw new Error("Ділення на нуль");
        value /= divisor;
      } else break;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (true) {
      if (takeOperator("+")) value += parseTerm();
      else if (takeOperator("-")) value -= parseTerm();
      else break;
    }
    return value;
  };

  const result = parseExpression();
  if (position !== tokens.length) throw new Error("Некоректний порядок символів");
  if (!Number.isFinite(result)) throw new Error("Результат формули завеликий");
  return result;
}
