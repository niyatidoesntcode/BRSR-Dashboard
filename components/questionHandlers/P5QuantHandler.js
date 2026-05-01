import Papa from "papaparse";
import React, { useEffect, useMemo, useState } from "react";

const P5_KPIS = [
  { key: "P5_1_score", name: "HR Training", color: "#6c8fff", desc: "% of total employees (permanent + non-permanent) trained on human rights policies. Higher score = lower coverage = more risk." },
  { key: "P5_2_score", name: "Gender Pay Equity", color: "#ff8c5e", desc: "Ratio of female to male median wage for non-executive employees, capped at 1.0. Higher score = larger pay gap = more risk." },
  { key: "P5_3_score", name: "HR Assessment", color: "#3dd68c", desc: "Average % of plants and offices formally assessed across five human rights dimensions: child labour, forced labour, sexual harassment, discrimination, and wages." },
  { key: "P5_4_score", name: "POSH Rate", color: "#ff5e5e", desc: "POSH complaints filed per female employee. Higher rate = more incidents relative to female workforce size = more risk. Only computed where female workforce > 0." },
];

const P5_FLAGS = [
  { key: "flag_A", label: "Child/Forced Labour", color: "#c0392b", abbr: "A" },
  { key: "flag_B", label: "Below Min. Wage", color: "#f5a623", abbr: "B" },
];

// reuse flag defs and helpers from P3 handler by duplicating minimal set
const FLAG_DEFS = [
  { key: "fatality_flag", label: "Workplace Fatality", color: "#ff5e5e" },
  { key: "flag_A", label: "Child/Forced Labour", color: "#c0392b" },
  { key: "flag_B", label: "Below Min. Wage", color: "#f5a623" },
  { key: "flag_C", label: "Forced Recall", color: "#9b59b6" },
  { key: "flag_D", label: "Data Breach", color: "#3498db" },
];

const SECTOR_SHORT_MAP = {
  Manufacturing: "Mfg",
  "Financial and Insurance Activities": "Finance",
  "Information and Communication": "IT & Comms",
  "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles": "Trade",
  Construction: "Construction",
  "Professional, Scientific and Technical Activities": "Prof & Tech",
  "Electricity, Gas, Steam and Air Conditioning Supply": "Energy",
  "Transportation and Storage": "Transport",
  Other: "Other",
  "Human Health and Social Work Activities": "Health",
  Education: "Education",
};

const RISK_COLOR = {
  low: "#34d399",
  medium: "#f5a623",
  high: "#ff5e5e",
  none: "#94a3b8",
};

const RISK_BG = {
  low: "#d1fae5",
  medium: "#fef3c7",
  high: "#fee2e2",
  none: "#f1f5f9",
};

function shortSector(name) {
  return SECTOR_SHORT_MAP[name] || name || "Unknown";
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return null;
  const pos = (sortedValues.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (pos - lower);
}

function boxStats(values) {
  const clean = values.filter((value) => value !== null && value !== undefined && !Number.isNaN(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  return {
    n: clean.length,
    mean: clean.reduce((sum, value) => sum + value, 0) / clean.length,
    p5: quantile(clean, 0.05),
    q1: quantile(clean, 0.25),
    median: quantile(clean, 0.5),
    q3: quantile(clean, 0.75),
    p95: quantile(clean, 0.95),
  };
}

function scaleY(value, plotHeight, padTop) {
  const clamped = Math.min(100, Math.max(0, value ?? 0));
  return padTop + plotHeight * (1 - clamped / 100);
}

function loadCsvRows(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return parsed.data || [];
}

export async function loadData({ csvPath = "/social_quant_scores.csv" } = {}) {
  const response = await fetch(csvPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load social_quant_scores.csv");
  }

  const text = await response.text();
  const rawRows = loadCsvRows(text);

  const rows = rawRows
    .map((row) => {
      const sector = row.Sector || "Unknown";
      const parsed = {
        name: row.NameOfTheCompany || "",
        sector,
        short: shortSector(sector),
        P5_1_score: safeNumber(row.P5_1_score),
        P5_2_score: safeNumber(row.P5_2_score),
        P5_3_score: safeNumber(row.P5_3_score),
        P5_4_score: safeNumber(row.P5_4_score),
        composite: safeNumber(row.P5_composite),
        fatality_flag: String(row.fatality_flag || "0") === "1",
        flag_A: String(row.flag_A || "0") === "1",
        flag_B: String(row.flag_B || "0") === "1",
        flag_C: String(row.flag_C || "0") === "1",
        flag_D: String(row.flag_D || "0") === "1",
      };
      return parsed;
    })
    .filter((row) => row.name && row.sector);

  const counts = new Map();
  rows.forEach((row) => {
    counts.set(row.sector, (counts.get(row.sector) || 0) + 1);
  });

  const top8 = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sector]) => sector);

  const topRows = rows.filter((row) => top8.includes(row.sector));
  const sectors = ["All Sectors", ...top8.map((sector) => shortSector(sector))];

  return {
    rows: topRows,
    sectors,
    top8,
    allRows: rows,
  };
}

// Reuse the P3 component code but with P5_KPIS passed inline where needed. For simplicity, reuse the P3 rendering logic by importing the P3 component functions if needed.
// For now, export a minimal placeholder QuestionPage that mirrors P3 layout but uses P5_KPIS. The full interactive page is similar to P3QuantHandler and can be implemented by copying P3 code if required.

export function QuestionPage(props) {
  const [Comp, setComp] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const mod = await import("./P3QuantHandler");
      if (!mounted) return;
      const Wrapped = (p) => {
        return React.createElement(mod.QuestionPage, { ...p, __overrideKPIs: P5_KPIS, __overrideFlags: P5_FLAGS, __principleId: "P5" });
      };
      setComp(() => Wrapped);
    })();
    return () => { mounted = false; };
  }, []);

  if (!Comp) return <div className="rounded-lg border bg-white p-6 text-center" style={{ borderColor: "#e2e8f0" }}>Loading P5 quantitative view...</div>;
  return <Comp {...props} />;
}
