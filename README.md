# Invoice Generator

CLI tool for generating PDF invoices from JSON config files. Supports manual item entry or automatic parsing from a Jira timesheet CSV.

> The invoice template is in **Czech** (labels, date format, currency) as it is intended for Czech freelancers.

## Requirements

- [Bun](https://bun.sh) runtime

## Installation

```bash
git clone https://github.com/Lucky01dot/faktura-generation.git
cd faktura-generation
bun install
```

> Puppeteer downloads Chromium (~170 MB) on first install — only once.

## Setup

Copy the example config files and fill in your details:

```bash
cp supplier.example.json supplier.json
cp invoice.example.json invoice.json
```

**`supplier.json`** — your personal/business details. Fill this in once and don't touch it again:
- `name`, `ico`, `street`, `city`, `zip`, `country`
- `email`, `phone`
- `bankAccount`, `iban`
- `vatPayer` — set to `true` only if you are a VAT payer
- `footer` — small print at the bottom of the invoice

**`invoice.json`** — update this each month:
- `issueDate` — invoice date in `YYYY-MM-DD` format
- `pricePerUnit` — your hourly rate (applies to all items)
- `client` — client details (usually stays the same)

---

## Usage

### Option A — manual items

Add items directly to `invoice.json`:

```jsonc
{
  "issueDate": "2025-06-30",
  "pricePerUnit": 210,
  "client": { ... },
  "items": [
    {
      "description": "Web development – June 2025",
      "quantity": 20,
      "unit": "hrs"
    }
  ]
}
```

Then run:

```bash
bun run invoice
```

### Option B — CSV from Jira timesheet

```bash
bun run timesheet timesheet.csv
```

The script will:
1. Parse the CSV and sum hours per issue (WZ-27, WZ-28, ...)
2. Print a summary to the terminal
3. Pass items directly to the generator — `invoice.json` is not modified
4. Generate the PDF

Expected CSV format (Jira timesheet export):
```
"issue","Time spent","01 Mon","02 Tue",...
"WZ-27","10h","","5h",...
```

---

## Output

The generated PDF is saved in the project folder:

```
faktura-your_name-202506001.pdf
```

---

## Auto-generated fields

You don't need to set these manually — they are calculated automatically:

| Field | Logic |
|---|---|
| `issueDate` | today's date (if omitted in `invoice.json`) |
| `dueDate` | `issueDate` + 14 days (override with `dueDays`) |
| `number` | `YYYYMM` + sequence based on existing PDFs in folder |
| `variableSymbol` | same as invoice number |

To override any of these, simply add the field to `invoice.json`.

---

## File structure

```
├── invoice.ts                # PDF generator (do not modify)
├── parse-timesheet.ts        # CSV parser (do not modify)
├── supplier.json             # your details — gitignored, never committed
├── invoice.json              # updated each month — gitignored, never committed
├── supplier.example.json     # template for supplier.json
├── invoice.example.json      # template for invoice.json
└── package.json
```