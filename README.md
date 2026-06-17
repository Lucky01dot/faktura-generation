# Faktura generátor

Jednoduchý CLI nástroj pro generování faktur ve formátu PDF. Stačí upravit JSON soubory a spustit skript.

## Instalace

```bash
bun install
```

> Puppeteer při první instalaci stáhne Chromium (~170 MB) — jednou, pak už ne.

## Použití

### 1. Jednou: vyplň své údaje

Otevři `supplier.json` a vyplň:
- jméno, IČO, DIČ (pokud plátce DPH)
- adresu, e-mail, telefon
- číslo bankovního účtu
- `vatPayer`: `true` pokud jsi plátce DPH, jinak `false`
- `currency`: `"CZK"`, `"EUR"` nebo `"USD"`

### 2. Každý měsíc: vyplň fakturu

Otevři `invoice.json` a uprav:
- `number` — číslo faktury (např. `"202506001"`)
- `issueDate` / `dueDate` — datum vystavení a splatnosti (formát `YYYY-MM-DD`)
- `variableSymbol` — obvykle stejné jako číslo faktury
- `client` — údaje odběratele
- `items` — seznam položek s popisem, množstvím a cenou

### 3. Vygeneruj PDF

```bash
bun run invoice
```

Výstup: `faktura-202506001.pdf` ve stejné složce.

## Struktura souborů

```
faktura/
├── invoice.ts        # hlavní skript (neměníš)
├── supplier.json     # tvoje údaje (jednou vyplníš)
├── invoice.json      # data faktury (každý měsíc)
└── package.json
```

## Číslování faktur

Doporučené schéma: `YYYYMM###`
- `202506001` = první faktura, červen 2025
- `202506002` = druhá faktura, červen 2025
- `202507001` = první faktura, červenec 2025