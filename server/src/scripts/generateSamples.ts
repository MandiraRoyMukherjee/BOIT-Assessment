import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makePdf } from "../testUtils/makePdf.js";

/**
 * Regenerates samples/*. All data is synthetic: fictional companies, people and numbers.
 * Planted differences between the documents (for demos):
 *   - Company name:   "Northwind Trading Ltd" (form) vs "Northwind Trade Limited" (licence, bank, accounts)
 *   - Address:        "14 Harbour Road" (form) vs "41 Harbour Road" (licence)
 *   - Annual revenue: 2,450,000 (form) vs 1,980,000 (accounts)
 *   - Licence number: GL-20418 (form) vs GL-20481 (licence)
 *   - Missing:        the licence has no Registration number; the form has no Licence expiry date
 */
const outDir = fileURLToPath(new URL("../../../samples/", import.meta.url));
mkdirSync(outDir, { recursive: true });

writeFileSync(
  `${outDir}application-form.txt`,
  [
    "SYNTHETIC SAMPLE - NOT REAL DATA",
    "Business Licence Application Form",
    "Company name: Northwind Trading Ltd",
    "Registration number: NW-7782341",
    "Registered address: 14 Harbour Road, Portsmouth, PO1 2AB",
    "Director: Alicia Moreno",
    "Licence number: GL-20418",
    "Annual revenue: GBP 2,450,000",
    "Application date: 2026-01-15",
    "Business activity: Import and wholesale of kitchenware",
    "",
  ].join("\n"),
);

writeFileSync(
  `${outDir}licence-certificate.pdf`,
  makePdf([
    [
      "SYNTHETIC SAMPLE - NOT REAL DATA",
      "General Trading Licence",
      "Company name: Northwind Trade Limited",
      "Registered address: 41 Harbour Road, Portsmouth, PO1 2AB",
      "Licence number: GL-20481",
      "Licence holder: Alicia Moreno",
      "Issue date: 2026-02-01",
      "Expiry date: 2027-01-31",
    ],
    ["Conditions", "Licence holder must notify the authority of any change of address within 30 days."],
  ]),
);

writeFileSync(
  `${outDir}bank-statement.csv`,
  [
    "Account holder,Date,Description,Amount,Balance",
    "Northwind Trade Limited,2026-01-03,Customer payment - Harbourside Stores,45200.00,152300.00",
    "Northwind Trade Limited,2026-01-09,Supplier payment - Kitchen Imports Co,-31800.00,120500.00",
    "Northwind Trade Limited,2026-01-17,Rent - 14 Harbour Road,-4200.00,116300.00",
    "Northwind Trade Limited,2026-01-28,Customer payment - Seaview Cafe,18750.00,135050.00",
    "",
  ].join("\n"),
);

writeFileSync(
  `${outDir}financial-summary.txt`,
  [
    "SYNTHETIC SAMPLE - NOT REAL DATA",
    "Annual Accounts Summary (year ended 2025-12-31)",
    "Company name: Northwind Trade Limited",
    "Registration number: NW-7782341",
    "Annual revenue: GBP 1,980,000",
    "Net profit: GBP 212,400",
    "Total liabilities: GBP 640,000",
    "",
  ].join("\n"),
);

console.log(`Samples written to ${outDir}`);
