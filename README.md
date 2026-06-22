# Invoice Generator

CLI tool for generating PDF invoices. Each month either manually fill in `invoice.json`, or import a CSV from Jira/timesheet and the script calculates everything automatically.

## Installation

```bash
bun install
```

> Puppeteer downloads Chromium (~170 MB) on first install — only once.

---

## Usage

### Option A — manual items

Open `invoice.json` and set:
- `issueDate` — issue date (due date +14 days automatically)
- `items` — list of items with hours

```bash
bun run invoice
```

### Option B — CSV from timesheet

Pass the CSV file as an argument (or place it in the folder as `timesheet.csv`):

```bash
bun run timesheet timesheet.csv
```

The script will:
1. Parse the CSV and sum hours per issue (WZ-27, WZ-28, ...)
2. Print a summary to the terminal
3. Pass items directly to the generator — `invoice.json` is not modified
4. Generate the PDF

Expected CSV format (Jira export):
```
"issue","Time spent","01 Mon","02 Tue",...
"WZ-27","10h","","5h",...
```

---

## Auto-generated fields

| Field | Logic |
|---|---|
| `issueDate` | today's date (if not set in `invoice.json`) |
| `dueDate` | issueDate + 14 days (or `dueDays: X`) |
| `number` | `YYYYMM` + sequence number based on existing PDFs |
| `variableSymbol` | = invoice number |

To override any field, add it manually to `invoice.json`.

---

## File structure

```
faktura/
├── invoice.ts           # PDF generator (do not modify)
├── parse-timesheet.ts   # CSV parser (do not modify)
├── supplier.json        # your details (do not modify)
├── invoice.json         # update each month
└── package.json
```

---

## invoice.json — field reference

```jsonc
{
  "issueDate": "2025-06-30",   // issue date (optional, default: today)
  "dueDays": 14,               // days until due (optional, default: 14)
  "pricePerUnit": 210,         // hourly rate — applies to all items
  "note": "Thank you for your business.",
  "client": { ... },           // client details (rarely changes)
  "items": [                   // optional — fill manually for Option A; not used with CSV
    {
      "description": "WZ-27",
      "quantity": 10,
      "unit": "hod",
    }
  ]
}
```

---

## supplier.json — key fields

- `vatPayer: false` — not a VAT payer (threshold is 2,000,000 CZK/year)
- `pricePerUnit` is set in `invoice.json`, not here
- `footer` — displayed at the bottom of the invoice in small print