import Papa from "papaparse";
import React, { useEffect, useState } from "react";

const P8_KPIS = [
  { key: "P8_1_score", name: "CSR Spend", color: "#6c8fff", desc: "CSR spending as %" },
  { key: "P8_2_score", name: "Projects", color: "#ff8c5e", desc: "Number of social projects" },
];

const P8_FLAGS = [];

function shortSector(name) {
  // mirror mapping from P3 file
  const map = {
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
  return map[name] || name || "Unknown";
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
      return {
        name: row.NameOfTheCompany || "",
        sector,
        short: shortSector(sector),
        P8_1_score: safeNumber(row.P8_1_score),
        P8_2_score: safeNumber(row.P8_2_score),
        composite: safeNumber(row.P8_composite),
        fatality_flag: String(row.fatality_flag || "0") === "1",
        flag_A: String(row.flag_A || "0") === "1",
        flag_B: String(row.flag_B || "0") === "1",
        flag_C: String(row.flag_C || "0") === "1",
        flag_D: String(row.flag_D || "0") === "1",
      };
    })
    .filter((r) => r.name && r.sector);

  const counts = new Map();
  rows.forEach((row) => counts.set(row.sector, (counts.get(row.sector) || 0) + 1));
  const top8 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  const topRows = rows.filter((row) => top8.includes(row.sector));
  const sectors = ["All Sectors", ...top8.map((s) => shortSector(s))];

  return { rows: topRows, sectors, top8, allRows: rows };
}

export function QuestionPage(props) {
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const mod = await import("./P3QuantHandler");
      if (!mounted) return;
      const Wrapped = (p) => React.createElement(mod.QuestionPage, { ...p, __overrideKPIs: P8_KPIS, __overrideFlags: P8_FLAGS, __principleId: "P8" });
      setComp(() => Wrapped);
    })();
    return () => { mounted = false; };
  }, []);
  if (!Comp) return <div className="rounded-lg border bg-white p-6 text-center" style={{ borderColor: "#e2e8f0" }}>Loading P8 quantitative view...</div>;
  return <Comp {...props} />;
}
