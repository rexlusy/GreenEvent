// SWDM v4: kWh/GB for data centre, network and user device, respectively.
export const ENERGY_INTENSITIES = [0.055, 0.059, 0.080];
export const GRID_INTENSITY = 494; // g CO2e/kWh
export const DIGITAL_FACTOR = ENERGY_INTENSITIES.reduce((sum, value) => sum + value, 0) * GRID_INTENSITY / 1000;

export function summarizeImpact(rows) {
  const totals = {
    A: { paper: null, sheets: null, digital: null, transfer: null, total: null },
    B: { paper: null, sheets: null, digital: null, transfer: null, total: null },
  };
  for (const row of rows) {
    const result = totals[row.scenario];
    if (row.kind === "paper") {
      result.paper = Number(row.paper_kg_co2e);
      result.sheets = Number(row.sheets);
    } else {
      result.transfer = Number(row.transfer_gb);
      result.digital = result.transfer * DIGITAL_FACTOR;
    }
  }
  for (const result of Object.values(totals)) {
    if (result.paper !== null && result.digital !== null) result.total = result.paper + result.digital;
  }
  const { A, B } = totals;
  const difference = A.total !== null && B.total !== null ? A.total - B.total : null;
  return { totals, difference, percent: difference !== null && A.total > 0 ? 100 * difference / A.total : null };
}
