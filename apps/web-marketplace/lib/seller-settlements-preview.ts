/**
 * Isolated seller settlement DESIGN PREVIEW. Nothing here is operational or
 * sourced from the server. Never feed these rows to real settlement APIs.
 */
export type DemoSettlementStatus = "SETTLED" | "PENDING" | "ELIGIBLE";
export type DemoSettlementRow = Readonly<{
  id: string;
  date: string;
  amountToman: number;
  related: string;
  status: DemoSettlementStatus;
  eligibleOrderCount: number;
}>;

export const demoSettlementRows: readonly DemoSettlementRow[] = [
  { id: "ST-1405-001", date: "۱۴۰۵/۰۸/۲۱", amountToman: 420000, related: "سفارش نمونه HN-4091", status: "SETTLED", eligibleOrderCount: 0 },
  { id: "ST-1405-002", date: "۱۴۰۵/۰۸/۲۰", amountToman: 640000, related: "سفارش نمونه HN-4090", status: "PENDING", eligibleOrderCount: 0 },
  { id: "ST-1405-003", date: "۱۴۰۵/۰۸/۱۹", amountToman: 310000, related: "گروه ۴ سفارش نمونه", status: "ELIGIBLE", eligibleOrderCount: 4 },
  { id: "ST-1405-004", date: "۱۴۰۵/۰۸/۱۸", amountToman: 1470000, related: "تجمیع چند سفارش نمونه", status: "SETTLED", eligibleOrderCount: 0 },
];

export const demoSettlementStatusLabels: Record<DemoSettlementStatus, string> = {
  SETTLED: "تسویه‌شده",
  PENDING: "در انتظار تسویه",
  ELIGIBLE: "قابل تسویه",
};

export const demoSettlementSummary = {
  settledToman: demoSettlementRows.filter((row) => row.status === "SETTLED")
    .reduce((total, row) => total + row.amountToman, 0),
  pendingToman: demoSettlementRows.filter((row) => row.status === "PENDING")
    .reduce((total, row) => total + row.amountToman, 0),
  eligibleOrders: demoSettlementRows.filter((row) => row.status === "ELIGIBLE")
    .reduce((total, row) => total + row.eligibleOrderCount, 0),
};

export function formatDemoToman(amount: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}
