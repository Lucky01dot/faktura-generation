import puppeteer from "puppeteer";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

interface Supplier {
  name: string;
  ico: string;
  dic?: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email?: string;
  phone?: string;
  bankAccount: string;
  iban?: string;
  vatPayer: boolean;
  vatRate: number;
  currency: string;
  footer?: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
}

interface InvoiceInput {
  number?: string;
  issueDate?: string;
  dueDate?: string;
  dueDays?: number;
  paymentMethod?: string;
  variableSymbol?: string;
  pricePerUnit?: number;
  note?: string;
  client: {
    name: string;
    ico?: string;
    dic?: string;
    street: string;
    city: string;
    zip: string;
    country: string;
  };
  items?: InvoiceItem[];
}

interface Invoice extends Required<Omit<InvoiceInput, "dueDays" | "number" | "variableSymbol" | "note" | "pricePerUnit">> {
  number: string;
  variableSymbol: string;
  note?: string;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, path), "utf-8")) as T;
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function resolveInvoice(input: InvoiceInput): Invoice {
  const today = new Date();
  const issueDate = input.issueDate ?? toIso(today);

  const dueDate = (() => {
    if (input.dueDate) return input.dueDate;
    const d = new Date(issueDate);
    d.setDate(d.getDate() + (input.dueDays ?? 14));
    return toIso(d);
  })();

  // Auto-generate number: YYYYMM + 3-digit seq (looks at existing PDFs)
  const yyyymm = issueDate.slice(0, 7).replace("-", "");
  let seq = 1;
  try {
    const files = readdirSync(__dirname);
    const existing = files
        .filter((f) => f.startsWith(`faktura-${yyyymm}`) && f.endsWith(".pdf"))
        .map((f) => parseInt(f.slice(`faktura-${yyyymm}`.length, -4), 10))
        .filter((n) => !isNaN(n));
    if (existing.length > 0) seq = Math.max(...existing) + 1;
  } catch {}

  const number = input.number ?? `${yyyymm}${String(seq).padStart(3, "0")}`;
  const variableSymbol = input.variableSymbol ?? number;

  return {
    number,
    issueDate,
    dueDate,
    paymentMethod: input.paymentMethod ?? "Převodem",
    variableSymbol,
    note: input.note,
    client: input.client,
    items: input.items,
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatAmount(n: number, currency: string): string {
  const formatted = n.toLocaleString("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "Kč";
  return `${formatted}\u00a0${symbol}`;
}

const MONTHS_CS = [
  "leden","únor","březen","duben","květen","červen",
  "červenec","srpen","září","říjen","listopad","prosinec"
];

function monthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS_CS[parseInt(m, 10) - 1]} ${y}`;
}

function buildHtml(supplier: Supplier, invoice: Invoice): string {
  const subtotal = invoice.items.reduce(
      (sum, i) => sum + i.quantity * i.pricePerUnit,
      0
  );
  const vat = supplier.vatPayer ? subtotal * (supplier.vatRate / 100) : 0;
  const total = subtotal + vat;

  const itemRows = invoice.items
      .map(
          (item) => `
    <tr>
      <td>${item.description}</td>
      <td class="right">${item.quantity}${item.unit ? `\u00a0${item.unit}` : ""}</td>
      <td class="right">${formatAmount(item.pricePerUnit, supplier.currency)}</td>
      <td class="right">${formatAmount(item.quantity * item.pricePerUnit, supplier.currency)}</td>
    </tr>`
      )
      .join("");

  const vatRows = supplier.vatPayer
      ? `
    <tr class="subtotal-row">
      <td colspan="3">Základ DPH</td>
      <td class="right">${formatAmount(subtotal, supplier.currency)}</td>
    </tr>
    <tr class="subtotal-row">
      <td colspan="3">DPH ${supplier.vatRate}\u00a0%</td>
      <td class="right">${formatAmount(vat, supplier.currency)}</td>
    </tr>`
      : "";

  const nonVatNote = !supplier.vatPayer
      ? `<p class="non-vat-note">Fakturující osoba není plátcem DPH.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <title>Faktura – ${supplier.name} – ${monthYear(invoice.issueDate)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      padding: 2.5cm 2cm;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid #1a1a1a;
    }
    .header-left .invoice-title { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
    .header-left .invoice-number { font-size: 14px; color: #666; }
    .header-right { text-align: right; font-size: 12px; }
    .header-right .supplier-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .header-right p { color: #333; margin: 1px 0; }
    .parties { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .party { flex: 1; background: #f7f7f7; border-radius: 6px; padding: 1rem; }
    .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 8px; }
    .party-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .party p { color: #444; margin: 1px 0; }
    .payment-info { flex: 1; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1rem; }
    .payment-info table { width: 100%; }
    .payment-info td { padding: 3px 0; }
    .payment-info td:first-child { color: #777; width: 50%; }
    .payment-info td:last-child { font-weight: 600; text-align: right; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    .items-table thead tr { background: #1a1a1a; color: #fff; }
    .items-table thead th { padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
    .items-table thead th.right { text-align: right; }
    .items-table tbody tr:nth-child(even) { background: #f9f9f9; }
    .items-table tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    .items-table td.right { text-align: right; }
    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 1.5rem; }
    .totals-box { width: 280px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
    .totals-box table { width: 100%; border-collapse: collapse; }
    .subtotal-row td { padding: 5px 12px; color: #555; border-bottom: 1px solid #eee; }
    .subtotal-row td:last-child { text-align: right; }
    .total-row td { padding: 10px 12px; font-size: 14px; font-weight: 700; background: #1a1a1a; color: #fff; }
    .total-row td:last-child { text-align: right; }
    .note-box { background: #fffbf0; border-left: 3px solid #f0a500; border-radius: 4px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 12px; }
    .non-vat-note { font-size: 11px; color: #888; margin-bottom: 0.5rem; }
    .footer-note { font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 0.75rem; margin-top: 1rem; }
    @media print { body { padding: 1.5cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="invoice-title">FAKTURA</div>
      <div class="invoice-number">č.&nbsp;${invoice.number}</div>
    </div>
    <div class="header-right">
      <p class="supplier-name">${supplier.name}</p>
      <p>${supplier.street}</p>
      <p>${supplier.zip} ${supplier.city}</p>
      <p>${supplier.country}</p>
      ${supplier.ico ? `<p>IČO: ${supplier.ico}</p>` : ""}
      ${supplier.dic ? `<p>DIČ: ${supplier.dic}</p>` : ""}
      ${supplier.email ? `<p>${supplier.email}</p>` : ""}
      ${supplier.phone ? `<p>${supplier.phone}</p>` : ""}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Odběratel</div>
      <div class="party-name">${invoice.client.name}</div>
      <p>${invoice.client.street}</p>
      <p>${invoice.client.zip} ${invoice.client.city}</p>
      <p>${invoice.client.country}</p>
      ${invoice.client.ico ? `<p>IČO: ${invoice.client.ico}</p>` : ""}
      ${invoice.client.dic ? `<p>DIČ: ${invoice.client.dic}</p>` : ""}
    </div>
    <div class="payment-info">
      <div class="party-label">Platební údaje</div>
      <table>
        <tr><td>Datum vystavení</td><td>${formatDate(invoice.issueDate)}</td></tr>
        <tr><td>Datum splatnosti</td><td>${formatDate(invoice.dueDate)}</td></tr>
        <tr><td>Způsob platby</td><td>${invoice.paymentMethod}</td></tr>
        <tr><td>Variabilní symbol</td><td>${invoice.variableSymbol}</td></tr>
        ${supplier.bankAccount ? `<tr><td>Číslo účtu</td><td>${supplier.bankAccount}</td></tr>` : ""}
        ${supplier.iban ? `<tr><td>IBAN</td><td>${supplier.iban}</td></tr>` : ""}
      </table>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:55%;">Popis</th>
        <th class="right" style="width:12%;">Množství</th>
        <th class="right" style="width:18%;">Cena / j.</th>
        <th class="right" style="width:15%;">Celkem</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <table>
        ${vatRows}
        <tr class="total-row">
          <td>Celkem k úhradě</td>
          <td>${formatAmount(total, supplier.currency)}</td>
        </tr>
      </table>
    </div>
  </div>

  ${invoice.note ? `<div class="note-box">${invoice.note}</div>` : ""}
  ${nonVatNote}
  ${supplier.footer ? `<div class="footer-note">${supplier.footer}</div>` : ""}
</body>
</html>`;
}

async function generateInvoice(itemsOverride?: InvoiceItem[]) {
  const supplier = loadJson<Supplier>("./supplier.json");
  const input = loadJson<InvoiceInput>("./invoice.json");

  // Use override items (from CSV) or fall back to invoice.json items
  const rawItems = itemsOverride ?? input.items ?? [];

  // Apply root-level pricePerUnit to items that don't have their own
  input.items = rawItems.map((item) => ({
    ...item,
    pricePerUnit: item.pricePerUnit ?? input.pricePerUnit ?? 0,
  }));

  const invoice = resolveInvoice(input);

  console.log(`Generating invoice no. ${invoice.number}...`);
  console.log(`Issue date: ${formatDate(invoice.issueDate)}`);
  console.log(`Due date: ${formatDate(invoice.dueDate)}`);
  console.log(`Variable symbol: ${invoice.variableSymbol}`);

  const html = buildHtml(supplier, invoice);
  const supplierSlug = supplier.name.replace(/\s+/g, "_");
  const outputPath = resolve(__dirname, `faktura-${supplierSlug}-${invoice.number}.pdf`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  await browser.close();

  console.log(`Done: faktura-${supplierSlug}-${invoice.number}.pdf`);
}

export { generateInvoice };
export type { InvoiceItem };

// Only runs when executed directly, not when imported
// @ts-ignore
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/")) {
  generateInvoice().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}