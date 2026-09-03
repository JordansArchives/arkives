// Arkives — Formatting helpers and pipeline constants (money, dates, status mapping).


const PIPELINE_STATUSES = ["Lead", "Qualifying", "Rates Sent", "Negotiating", "Contract", "Active", "Completed", "Declined"];

const STATUS_MAP = {
  "SIGNED": "Active",
  "ACTIVE - In Production": "Active",
  "ACTIVE — In Production": "Active",
  "Revised Contract Drafted": "Contract",
  "Follow-Up Sent": "Negotiating",
  "Rates Sent": "Rates Sent",
  "Counter Sent": "Negotiating",
  "Questions Sent": "Qualifying",
  "Meeting Scheduled": "Qualifying",
  "Cold": "Lead",
  "Declined": "Declined",
  "Pointed to Shawn": "Qualifying",
  "Completed": "Completed"
};

function mapStatus(raw) {
  if (!raw) return "Lead";
  for (const key of Object.keys(STATUS_MAP)) {
    if (raw.toUpperCase().includes(key.toUpperCase())) return STATUS_MAP[key];
  }
  return "Lead";
}

function parseValue(val) {
  if (typeof val === "number") return val;
  if (!val || val === "TBD") return 0;
  const str = String(val).replace(/[^0-9.-]/g, "");
  const nums = str.split("-").map(Number).filter(n => !isNaN(n));
  return nums.length > 0 ? nums[0] : 0;
}

function formatCurrency(num, allowZero) {
  if (num === 0 && !allowZero) return "TBD";
  return "$" + num.toLocaleString("en-US");
}

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Alias used by simplified dashboard
function formatDate(d) {
  if (!d) return '';
  d = (d instanceof Date) ? d : new Date(d);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function fmtNum(n) {
  if (n == null) return "--";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

export { PIPELINE_STATUSES, STATUS_MAP, fmtDate, fmtDateShort, fmtNum, formatCurrency, formatDate, mapStatus, parseValue, todayISO, todayStr };
