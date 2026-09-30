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
    const v = value.trim();
    // "27h 30m" or "27h30m"
    const hmMatch = v.match(/^(\d+)h\s*(\d+)m$/);
    if (hmMatch) return parseInt(hmMatch[1]) + parseInt(hmMatch[2]) / 60;
    // "27h"
    const hMatch = v.match(/^(\d+(?:\.\d+)?)h$/);
    if (hMatch) return parseFloat(hMatch[1]);
    // "30m"
    const mMatch = v.match(/^(\d+)m$/);
    if (mMatch) return parseInt(mMatch[1]) / 60;
    return 0;
}

function parseTimesheet(csvPath: string): TimesheetRow[] {
    const content = readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");
    const lines = content.trim().split("\n");

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

async function promptServiceTypes(rows: TimesheetRow[]): Promise<Record<string, string>> {
    const prefixes = [...new Set(rows.map((r) => r.issue.replace(/-\d+$/, "")))];

    const map: Record<string, string> = {};
    for (const prefix of prefixes) {
        process.stdout.write(`Service type for "${prefix}" issues: `);
        const answer = await new Promise<string>((res) => {
            let buf = "";
            process.stdin.resume();
            process.stdin.setEncoding("utf-8");
            process.stdin.on("data", function handler(chunk: string) {
                buf += chunk;
                if (buf.includes("\n")) {
                    process.stdin.removeListener("data", handler);
                    process.stdin.pause();
                    res(buf.split("\n")[0].trim());
                }
            });
        });
        map[prefix] = answer;
    }

    return map;
}

async function main() {
    const csvPath = process.argv[2]
        ? resolve(process.cwd(), process.argv[2])
        : resolve(__dirname, "timesheet.csv");

    console.log(`Loading timesheet: ${csvPath}`);

    const rows = parseTimesheet(csvPath);

    if (rows.length === 0) {
        console.error("No items found in CSV.");
        process.exit(1);
    }

    const invoiceConfig = JSON.parse(
        readFileSync(resolve(__dirname, "invoice.json"), "utf-8")
    );
    const pricePerUnit: number = invoiceConfig.pricePerUnit ?? 210;

    console.log(`\nItems found:`);
    rows.forEach((r) => {
        console.log(`${r.issue.padEnd(10)} ${r.totalHours}h  →  ${r.totalHours * pricePerUnit} CZK`);
    });
    const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
    console.log(`${"".padEnd(10)} ────`);
    console.log(`${"Total".padEnd(10)} ${totalHours}h  →  ${totalHours * pricePerUnit} CZK\n`);

    const serviceTypes = await promptServiceTypes(rows);

    const items: InvoiceItem[] = rows.map((r) => {
        const prefix = r.issue.replace(/-\d+$/, "");
        const serviceType = serviceTypes[prefix] ?? prefix;
        return {
            description: `${serviceType} ${r.issue}`,
            quantity: r.totalHours,
            unit: "hod",
            pricePerUnit,
        };
    });

    await generateInvoice(items);
}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});