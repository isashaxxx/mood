/**
 * The CRM dictionary changed around July 2026: Ukrainian labels were replaced
 * with English ones. Both live in the data, so both are mapped here.
 *
 * Instagram is deliberately NOT collapsed. Before July there was a single
 * "Інстаграм" value with no paid/organic split, and inventing one would be a
 * lie. Those deals stay in their own bucket until someone re-tags them.
 */
export const SOURCE_MAP: Record<string, string> = {
  "Гугл пошук": "Google Organic",
  "Google organic": "Google Organic",
  "Google Organic": "Google Organic",
  "Google CPC": "Google PPC",
  "Google PPC": "Google PPC",
  "Інстаграм": "Instagram (не розділено)",
  "Instagram Organic": "Instagram Organic",
  "Instagram Paid": "Instagram Paid",
  "Рекомендація": "Referrals",
  "Refferals": "Referrals",
  "Referrals": "Referrals",
  "Івент": "Events",
  "Event": "Events",
  "Events": "Events",
  "Lost client": "Lost clients",
  "Lost clients": "Lost clients",
  "Лінкдін": "LinkedIn",
  "LinkedIn": "LinkedIn",
  "Email": "Email",
  "Threads": "Інше",
  "Hurma": "Інше",
  "Direct": "Інше",
  "Чати HR": "Інше",
  "HR-чати\\канали в телеграм": "Інше",
  "HR-chats\\telegram channels": "Інше",
  "Employer Brand Community": "Інше",
  "Created manually": "Не вказано",
  "UniTalk": "Не вказано",
  "Binotel": "Не вказано",
};

/** Outbound is sales-generated demand. It never enters marketing reporting. */
export const OUTBOUND_SOURCES = new Set(["Аутбаунд", "Outbound", "Аутбаунд сейлз", "Outbound sales"]);

export const UNSET = "Не вказано";

export type Normalised = { source: string; isOutbound: boolean; unknown: boolean };

export function normaliseSource(raw: string | null | undefined): Normalised {
  const v = (raw ?? "").trim();
  if (!v) return { source: UNSET, isOutbound: false, unknown: false };
  if (OUTBOUND_SOURCES.has(v)) return { source: "Outbound", isOutbound: true, unknown: false };
  const mapped = SOURCE_MAP[v];
  // An unmapped value is surfaced in the sync log rather than silently bucketed,
  // so a new dropdown option in NetHunt never quietly vanishes from reports.
  return { source: mapped ?? "Інше", isOutbound: false, unknown: !mapped };
}

export const PAID_SOURCES = new Set(["Instagram Paid", "Google PPC"]);
export const SOURCE_COLORS: Record<string, string> = {
  "Google Organic": "#95A4FC",
  "Google PPC": "#3BB9BE",
  "Instagram Paid": "#C6C7F8",
  "Instagram Organic": "#B1E3FF",
  "Instagram (не розділено)": "#A8C5DA",
  Referrals: "#BAEDBD",
  Events: "#FFE9B8",
  "Lost clients": "#E5ECF6",
  LinkedIn: "#7C6BB0",
  Email: "#F191A0",
  "Інше": "#D9DEE4",
  "Не вказано": "#EFF2F5",
};

export const WON = "Виграні";
export const LOST = "Програні";
export const OPEN_STAGES = ["Запит", "Пропозиція зроблена", "Переговори", "Очікуємо оплату"];
