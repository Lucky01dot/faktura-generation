# Faktura generátor

CLI nástroj pro generování faktur ve formátu PDF. Každý měsíc buď ručně upravíš `invoice.json`, nebo nahraješ CSV z Jira/timesheet a skript vše spočítá sám.

## Instalace

```bash
bun install
```

> Puppeteer při první instalaci stáhne Chromium (~170 MB) — jednou, pak už ne.

---

## Použití

### Varianta A — ruční zadání hodin

Otevři `invoice.json` a změň:
- `issueDate` — datum vystavení (splatnost +14 dní automaticky)
- `items` — seznam položek s počtem hodin

```bash
bun run invoice
```

### Varianta B — CSV z timesheetu

Dej CSV soubor do složky (nebo zadej cestu jako argument) a spusť:

```bash
bun run timesheet timesheet.csv
```

Skript automaticky:
1. Načte CSV a sečte hodiny per issue (WZ-27, WZ-28, ...)
2. Vypíše přehled do terminálu
3. Předá items přímo do generátoru — `invoice.json` se nemění
4. Vygeneruje PDF

Očekávaný formát CSV (export z Jira):
```
"issue","Time spent","01 Mon","02 Tue",...
"WZ-27","10h","","5h",...
```

---

## Co se generuje automaticky

| Pole | Logika |
|---|---|
| `issueDate` | dnešní datum (pokud není v `invoice.json`) |
| `dueDate` | issueDate + 14 dní (nebo `dueDays: X`) |
| `number` | `YYYYMM` + pořadové číslo podle existujících PDF |
| `variableSymbol` | = číslo faktury |

Chceš-li cokoliv přepsat, přidej pole ručně do `invoice.json`.

---

## Struktura souborů

```
faktura/
├── invoice.ts           # generátor PDF (neměníš)
├── parse-timesheet.ts   # CSV parser (neměníš)
├── supplier.json        # tvoje údaje (neměníš)
├── invoice.json         # měníš každý měsíc
└── package.json
```

---

## invoice.json — přehled polí

```jsonc
{
  "issueDate": "2025-06-30",   // datum vystavení (optional, default: dnes)
  "dueDays": 14,               // splatnost ve dnech (optional, default: 14)
  "pricePerUnit": 210,         // hodinová sazba — platí pro všechny položky
  "note": "Děkujeme za spolupráci.",
  "client": { ... },           // údaje odběratele (nemění se)
  "items": [                   // volitelné — vyplníš ručně při variantě A; při CSV se nepoužívá
    {
      "description": "WZ-27",
      "quantity": 10,
      "unit": "hod",
    }
  ]
}
```

---

## supplier.json — klíčové položky

- `vatPayer: false` — nejsi plátce DPH (hranice je 2 000 000 Kč/rok)
- `pricePerUnit` se nastavuje v `invoice.json`, ne zde
- `footer` — zobrazí se pod fakturou drobným písmem