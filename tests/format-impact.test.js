import assert from "node:assert/strict";
import test from "node:test";
import { csv, parseWib, safeNext, wibInput } from "../lib/format.js";
import { DIGITAL_FACTOR, summarizeImpact } from "../lib/impact.js";

test("WIB forms round-trip and reject impossible dates", () => {
  assert.equal(parseWib("2026-11-14T00:05"), "2026-11-13T17:05:00.000Z");
  assert.equal(wibInput("2026-11-13T17:05:00.000Z"), "2026-11-14T00:05");
  for (const invalid of ["2026-02-29T12:00", "2026-11-14T24:00", "2026-11-14"]) {
    assert.throws(() => parseWib(invalid));
  }
});

test("login continuation is limited to local application paths", () => {
  assert.equal(safeNext("/presensi/10000000-0000-4000-8000-000000000001"), "/presensi/10000000-0000-4000-8000-000000000001");
  for (const invalid of ["//example.com", "https://example.com", "/kegiatan/../..", "/panitia?next=elsewhere"]) {
    assert.equal(safeNext(invalid), "");
  }
});

test("CSV keeps quotes and line breaks and neutralizes spreadsheet formulas", () => {
  assert.equal(csv([["Nama", 'A "B"', "=1+1", "A\nB", 0]]), '\ufeff"Nama","A ""B""","\'=1+1","A\nB","0"\r\n');
});

test("impact distinguishes missing data from a documented zero", () => {
  assert.ok(Math.abs(DIGITAL_FACTOR - 0.095836) < 1e-12);
  const rows = [
    { scenario: "A", kind: "paper", sheets: 100, paper_kg_co2e: 0.523908 },
    { scenario: "A", kind: "digital", transfer_gb: 0 },
    { scenario: "B", kind: "paper", sheets: 0, paper_kg_co2e: 0 },
  ];
  assert.equal(summarizeImpact(rows).difference, null);
  assert.equal(summarizeImpact(rows).totals.B.digital, null);
  rows.push({ scenario: "B", kind: "digital", transfer_gb: 1 });
  const result = summarizeImpact(rows);
  assert.ok(Math.abs(result.totals.B.total - 0.095836) < 1e-12);
  assert.ok(Math.abs(result.difference - 0.428072) < 1e-12);
  const noBaseline = summarizeImpact(rows.map(row => row.scenario === "A" ? { ...row, paper_kg_co2e: 0 } : row));
  assert.equal(noBaseline.percent, null);
  assert.ok(noBaseline.difference < 0);
});
