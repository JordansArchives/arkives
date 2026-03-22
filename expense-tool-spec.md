# Expense Tracking Tool Specification

## Architecture
- Frontend form in app.js → calls FastAPI backend endpoints
- Backend reads/writes Google Sheets via the Pipedream connector (using subprocess calls to the workspace CLI tools)
- Data persists in Google Sheets (same spreadsheet Jordan already uses)
- On each Expenses tab open, frontend fetches live journal data from backend

## Google Sheets Structure
- Spreadsheet ID: `13laAHAH0ZoPvuFEoETVWj-y9AoZM33_goosc7qpPVqI`
- Personal Journal (worksheet ID: 0): Row 1=title, Row 2=empty, Row 3=headers `DATE | ACCOUNT | AMOUNT | NOTES`
- Business Journal (worksheet ID: 1647441220): Same structure
- Date format: `M/D/YYYY` (e.g., `3/12/2026`)
- Amount format: ` $ XX.XX ` (with spaces, dollar sign, and decimals)
- Negative amounts: ` $ (XX.XX)` (parentheses for negatives/refunds)

## Personal Categories (ACCOUNT column values)
- LEASURE EXPENSES
- LIVING EXPENSES
- GAS EXPENSES
- GROCERIES EXPENSES
- THERAPY EXPENSE
- OTHER EXPENSES
- OTHER REVENUE
- WORK REVENUE

## Business Categories (ACCOUNT column values)
- HARDWARE EXPENSE
- SOFTWARE EXPENSE
- AD EXPENSE
- GENERAL EXPENSE
- TRAVEL EXPENSE
- EMPLOYEE EXPENSE
- WORK REVENUE
- PROGRAM REVENUE

## Backend Endpoints Needed

### POST /api/expense/add
Adds a new row to the appropriate journal sheet.
Request body:
```json
{
  "type": "personal" | "business",
  "category": "LEASURE EXPENSES",
  "amount": 47.50,
  "notes": "Dinner with friends",
  "date": "2026-03-12"  // optional, defaults to today
}
```
Backend transforms to sheet format and appends row.

### GET /api/expense/journal?type=personal&months=3
Fetches recent journal entries from the sheet.
Returns JSON array of entries with date, category, amount, notes.

### GET /api/expense/summary
Returns computed summaries: monthly totals by category, net income data.

## Frontend Changes

### 1. Add Entry Modal
- Floating action button "+ Add Entry" at top of Expenses tab
- Modal with: Type toggle (Personal/Business), Category dropdown (populated based on type), Amount input, Notes input, Date picker (defaults to today)
- Submit button calls POST /api/expense/add
- On success: close modal, refresh the transaction list
- Hand-drawn sketch style icons consistent with rest of Arkives

### 2. Recent Transactions Section
- New collapsible section "Recent Transactions" showing last 30 entries
- Each row: Date | Category tag | Amount | Notes
- Color coding: expenses in red, revenue in green
- Filter buttons: All / Personal / Business / This Month

### 3. Live Data Mode
- "Refresh" button next to "Google Sheets Connected" badge
- On Expenses tab load: fetch live data from /api/expense/journal
- Update the Net Income Summary table and chart with live numbers
- Show "Last synced: X minutes ago" indicator

### 4. Update renderExpenses()
- Keep KPI cards, Net Income Summary, P&L chart, subscription sections
- Add the new "Add Entry" button + modal
- Add "Recent Transactions" collapsible section after the chart
- Transaction list shows real journal entries from the API
