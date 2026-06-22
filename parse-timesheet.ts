import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
// @ts-ignore
import { generateInvoice } from "./invoice.ts";
import type { InvoiceItem } from "./invoice.ts";

// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

interface TimesheetRow {
    issue: string;
    totalHours: number;
}

function parseHours(value: string): number {
    if (!value || value.trim() === "") return 0;
    const match = value.trim().match(/^(\d+(?:\.\d+)?)h$/);
    return match ? parseFloat(match[1]) : 0;
}

function parseTimesheet(csvPath: string): TimesheetRow[] {
    const content = readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, ""); // strip BOM
    const lines = content.trim().split("\n");

    // skip header and last summary row (empty issue)
    const dataLines = lines.slice(1).filter((line) => {
        const firstCell = line.split(",")[0].replace(/"/g, "").trim();
        return firstCell !== "";
    });

    return dataLines.map((line) => {
        const cells = line.split(",").map((c) => c.replace(/"/g, "").trim());
        const issue = cells[0];
        const totalHours = parseHours(cells[1]);
        return { issue, totalHours };
    });
}

async function main() {
    const csvPath = process.argv[2]
        ? resolve(process.cwd(), process.argv[2])
        : resolve(__dirname, "timesheet.csv");

    console.log(`Načítám timesheet: ${csvPath}`);

    const rows = parseTimesheet(csvPath);

    if (rows.length === 0) {
        console.error("Žádné položky nenalezeny v CSV.");
        process.exit(1);
    }

    // Load pricePerUnit from invoice.json for the summary print
    const invoiceConfig = JSON.parse(
        readFileSync(resolve(__dirname, "invoice.json"), "utf-8")
    );
    const pricePerUnit: number = invoiceConfig.pricePerUnit ?? 210;

    console.log(`\nNalezené položky:`);
    rows.forEach((r) => {
        console.log(`${r.issue.padEnd(10)} ${r.totalHours}h  →  ${r.totalHours * pricePerUnit} Kč`);
    });
    const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
    console.log(`${"".padEnd(10)} ────`);
    console.log(`${"Celkem".padEnd(10)} ${totalHours}h  →  ${totalHours * pricePerUnit} Kč\n`);

    // Build items and pass directly to generateInvoice — invoice.json stays untouched
    const items: InvoiceItem[] = rows.map((r) => ({
        description: r.issue,
        quantity: r.totalHours,
        unit: "hod",
        pricePerUnit,
    }));

    await generateInvoice(items);
}

main().catch((err) => {
    console.error("Chyba:", err.message);
    process.exit(1);
});