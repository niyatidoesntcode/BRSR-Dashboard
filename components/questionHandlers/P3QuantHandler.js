import Papa from "papaparse";
import React, { useEffect, useMemo, useState } from "react";

const P3_KPIS = [
  {
    key: "P3_1_score",
    name: "Benefit Coverage",
    color: "#6c8fff",
    desc: "Avg health + accident insurance % for permanent employees",
  },
  {
    key: "P3_2_score",
    name: "Worker Gap",
    color: "#ff8c5e",
    desc: "Employee benefit coverage minus worker coverage",
  },
  {
    key: "P3_3_score",
    name: "Wellbeing Spend",
    color: "#3dd68c",
    desc: "Wellbeing expenditure as % of revenue",
  },
  {
    key: "P3_4_score",
    name: "Safety (LTIFR)",
    color: "#ff5e5e",
    desc: "Lost Time Injury Frequency Rate per million person-hours",
  },
  {
    key: "P3_5_score",
    name: "Training",
    color: "#f5c842",
    desc: "Avg H&S + skill upgradation training coverage",
  },
  {
    key: "P3_6_score",
    name: "Career Dev",
    color: "#b57bff",
    desc: "% employees with performance/career dev review",
  },
];

const FLAG_DEFS = [
  { key: "fatality_flag", label: "Workplace Fatality", color: "#ff5e5e", abbr: "⚑" },
  { key: "flag_A", label: "Child/Forced Labour", color: "#c0392b", abbr: "A" },
  { key: "flag_B", label: "Below Min. Wage", color: "#f5a623", abbr: "B" },
  { key: "flag_C", label: "Forced Recall", color: "#9b59b6", abbr: "C" },
  { key: "flag_D", label: "Data Breach", color: "#3498db", abbr: "D" },
];

const KPI_BY_NAME = Object.fromEntries(P3_KPIS.map((kpi) => [kpi.name, kpi]));
const KPI_BY_KEY = Object.fromEntries(P3_KPIS.map((kpi) => [kpi.key, kpi]));

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

function rowHasAnyFlag(row, flags) {
  if (!flags || !flags.length) return false;
  return flags.some((flag) => Boolean(row[flag.key]));
}

function rowFlagTokens(row, flags) {
  if (!flags || !flags.length) return "";
  return flags.filter((flag) => row[flag.key]).map((flag) => flag.abbr || flag.label).join(" ");
}

function riskTier(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return "none";
  if (score < 35) return "low";
  if (score <= 65) return "medium";
  return "high";
}

function tierColor(score) {
  return RISK_COLOR[riskTier(score)];
}

function fmtNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
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

function hashJitter(seed, range) {
  let h = 5381;
  for (let i = 0; i < String(seed).length; i += 1) {
    h = ((h << 5) + h + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return ((h % 10000) / 10000 - 0.5) * range;
}

function scaleY(value, plotHeight, padTop) {
  const clamped = Math.min(100, Math.max(0, value ?? 0));
  return padTop + plotHeight * (1 - clamped / 100);
}

function sectorOrderByMedian(rows, valueKey) {
  const sectorMap = new Map();
  rows.forEach((row) => {
    if (!sectorMap.has(row.short)) sectorMap.set(row.short, []);
    sectorMap.get(row.short).push(row);
  });

  return [...sectorMap.entries()]
    .map(([sector, sectorRows]) => ({
      sector,
      median: boxStats(sectorRows.map((row) => row[valueKey]))?.median ?? 0,
    }))
    .sort((a, b) => b.median - a.median)
    .map((entry) => entry.sector);
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
        P3_1_score: safeNumber(row.P3_1_score),
        P3_2_score: safeNumber(row.P3_2_score),
        P3_3_score: safeNumber(row.P3_3_score),
        P3_4_score: safeNumber(row.P3_4_score),
        P3_5_score: safeNumber(row.P3_5_score),
        P3_6_score: safeNumber(row.P3_6_score),
        composite: safeNumber(row.P3_composite),
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

function StatCard({ label, value, sublabel, color }) {
  return (
    <div className="bg-white border rounded-lg" style={{ borderColor: "#e2e8f0", padding: "18px 22px" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "#94a3b8" }}>
        {label}
      </div>
      <div className="mt-1 text-[26px] font-bold leading-tight" style={{ color: color || "#176fb3" }}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

function Panel({ title, subtitle, children, className = "", headerRight = null, minHeight = 0 }) {
  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${className}`} style={{ borderColor: "#e2e8f0", minHeight }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e2e8f0" }}>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#1a2333" }}>
            {title}
          </div>
          {subtitle ? (
            <div className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function MiniLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-end text-[11px]" style={{ color: "#64748b" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color, border: item.border ? `1px solid ${item.color}` : "none" }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function GroupedFlagBars({ rows, mode }) {
  const sectorMap = new Map();
  rows.forEach((row) => {
    if (!sectorMap.has(row.short)) sectorMap.set(row.short, []);
    sectorMap.get(row.short).push(row);
  });

  const sectorData = [...sectorMap.entries()]
    .map(([sector, sectorRows]) => {
      const flagCounts = Object.fromEntries(FLAG_DEFS.map((flag) => [flag.key, 0]));
      sectorRows.forEach((row) => {
        FLAG_DEFS.forEach((flag) => {
          if (row[flag.key]) flagCounts[flag.key] += 1;
        });
      });
      const totals = Object.values(flagCounts).reduce((sum, value) => sum + value, 0);
      return {
        sector,
        totalFlags: totals,
        totalCompanies: sectorRows.length,
        flagCounts,
        flagRates: Object.fromEntries(
          FLAG_DEFS.map((flag) => [flag.key, sectorRows.length > 0 ? (flagCounts[flag.key] / sectorRows.length) * 100 : 0])
        ),
      };
    })
    .sort((a, b) => {
      const left = mode === "abs" ? a.totalFlags : Object.values(a.flagRates).reduce((sum, value) => sum + value, 0);
      const right = mode === "abs" ? b.totalFlags : Object.values(b.flagRates).reduce((sum, value) => sum + value, 0);
      return right - left;
    });

  const barWidth = 12;
  const groupGap = 20;
  const sectorGap = 22;
  const slotWidth = 120;
  const chartWidth = Math.max(480, sectorData.length * slotWidth + 40);
  const chartHeight = 300;
  const padTop = 26;
  const padBottom = 56;
  const padLeft = 26;
  const padRight = 18;
  const plotHeight = chartHeight - padTop - padBottom;

  const maxValue = Math.max(
    1,
    ...sectorData.flatMap((entry) =>
      FLAG_DEFS.map((flag) => (mode === "abs" ? entry.flagCounts[flag.key] : entry.flagRates[flag.key]))
    )
  );

  const yTicks = mode === "abs"
    ? [0, Math.ceil(maxValue / 4), Math.ceil(maxValue / 2), Math.ceil((maxValue * 3) / 4), Math.ceil(maxValue)]
    : [0, 25, 50, 75, 100];

  const scale = (value) => (value / (mode === "abs" ? maxValue : 100)) * plotHeight;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width={chartWidth} height={chartHeight} style={{ display: "block" }}>
        {yTicks.map((tick) => {
          const y = padTop + plotHeight - scale(tick);
          return (
            <g key={tick}>
              <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} stroke="#e8edf4" strokeWidth="1" />
              <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize="8.5" fill="#94a3b8">
                {mode === "abs" ? tick : `${tick}%`}
              </text>
            </g>
          );
        })}

        {sectorData.map((entry, index) => {
          const groupX = padLeft + index * slotWidth + 8;
          const xCenter = groupX + (FLAG_DEFS.length * (barWidth + groupGap)) / 2;
          return (
            <g key={entry.sector}>
              {FLAG_DEFS.map((flag, flagIndex) => {
                const value = mode === "abs" ? entry.flagCounts[flag.key] : entry.flagRates[flag.key];
                const barHeight = scale(value);
                const x = groupX + flagIndex * (barWidth + groupGap);
                const y = padTop + plotHeight - barHeight;
                return (
                  <g key={flag.key}>
                    <rect x={x} y={y} width={barWidth} height={Math.max(0, barHeight)} fill={flag.color} rx={2} />
                    {value > 0 ? (
                      <text x={x + barWidth / 2} y={Math.max(padTop + 8, y - 3)} textAnchor="middle" fontSize="8" fill="#64748b">
                        {mode === "abs" ? value : `${value.toFixed(1)}%`}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              <text
                x={xCenter}
                y={chartHeight - 18}
                textAnchor="middle"
                fontSize="9"
                fill="#475569"
                transform={`rotate(30 ${xCenter} ${chartHeight - 18})`}
              >
                {entry.sector}
              </text>
            </g>
          );
        })}

        <line x1={padLeft} y1={padTop + plotHeight} x2={chartWidth - padRight} y2={padTop + plotHeight} stroke="#e2e8f0" strokeWidth="1" />
        <text x={chartWidth / 2} y={chartHeight - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          Sector (higher = riskier)
        </text>
      </svg>
    </div>
  );
}

function SectorStatCards({ rows, effectiveKpis = P3_KPIS, effectiveFlags = FLAG_DEFS, principleName = "P3" }) {
  const hasFlags = effectiveFlags.length > 0;
  const totalCompanies = rows.length;
  const avgComposite = rows.length > 0 ? rows.filter((row) => row.composite !== null).reduce((sum, row) => sum + row.composite, 0) / rows.filter((row) => row.composite !== null).length : null;
  const totalFlagged = rows.filter((row) => rowHasAnyFlag(row, effectiveFlags)).length;
  const means = effectiveKpis.map((kpi) => {
    const values = rows.map((row) => row[kpi.key]).filter((value) => value !== null);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return { ...kpi, mean };
  }).filter((kpi) => kpi.mean !== null);
  const highestRisk = means.sort((a, b) => b.mean - a.mean)[0];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${hasFlags ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-4`}>
      <StatCard label="Total companies in selected sectors" value={totalCompanies.toLocaleString()} sublabel="Top 8 sectors only" color="#176fb3" />
      <StatCard label={`Avg ${principleName} composite`} value={fmtNumber(avgComposite, 1)} sublabel={`Risk tier: ${riskTier(avgComposite) === "none" ? "—" : riskTier(avgComposite)}`} color={tierColor(avgComposite)} />
      {hasFlags ? <StatCard label="Total flagged companies" value={totalFlagged.toLocaleString()} sublabel="selected sectors" color="#ff5e5e" /> : null}
      <StatCard label="Highest risk KPI" value={highestRisk ? highestRisk.name : "—"} sublabel={highestRisk ? `mean score ${highestRisk.mean.toFixed(1)}` : ""} color={highestRisk ? highestRisk.color : "#94a3b8"} />
    </div>
  );
}

function Box({ cx, stats, color, boxW, padTop, plotHeight }) {
  if (!stats) return null;
  const y5 = scaleY(stats.p5, plotHeight, padTop);
  const y1 = scaleY(stats.q1, plotHeight, padTop);
  const yMed = scaleY(stats.median, plotHeight, padTop);
  const y3 = scaleY(stats.q3, plotHeight, padTop);
  const y95 = scaleY(stats.p95, plotHeight, padTop);
  const cap = 6;

  return (
    <g>
      <line x1={cx} y1={y5} x2={cx} y2={y95} stroke={color} strokeOpacity="0.45" strokeWidth="1.5" />
      <line x1={cx - cap} y1={y5} x2={cx + cap} y2={y5} stroke={color} strokeWidth="1.5" />
      <line x1={cx - cap} y1={y95} x2={cx + cap} y2={y95} stroke={color} strokeWidth="1.5" />
      <rect x={cx - boxW / 2} y={y3} width={boxW} height={Math.max(2, y1 - y3)} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.5" rx="2" />
      <line x1={cx - boxW / 2} y1={yMed} x2={cx + boxW / 2} y2={yMed} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function SectorBoxPlots({ rows, activeKpis, selectedSectors, effectiveKpis = P3_KPIS, effectiveFlags = FLAG_DEFS, principleName = "P3" }) {
  const showComposite = activeKpis.length === effectiveKpis.length && selectedSectors.includes("All Sectors");
  const visibleKpis = showComposite ? effectiveKpis : effectiveKpis.filter((kpi) => activeKpis.includes(kpi.name));
  const highlightFlag = effectiveFlags[0] || null;
  const sectors = sectorOrderByMedian(rows, "composite");
  const [viewportWidth, setViewportWidth] = useState(1280);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth || 1280);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pad = { left: 48, right: 28, top: 28, bottom: 60 };
  const plotHeight = 220;
  const boxWidth = showComposite ? 38 : 18;
  const minSectorSlot = showComposite ? 92 : visibleKpis.length * 22 + 28;
  const maxSectorSlot = showComposite ? 330 : Math.max(minSectorSlot, visibleKpis.length * 48 + 56);
  const targetPlotWidth = Math.max(560, viewportWidth - 420);
  const autoSectorSlot = Math.floor(targetPlotWidth / Math.max(sectors.length, 1));
  const sectorSlot = Math.max(minSectorSlot, Math.min(maxSectorSlot, autoSectorSlot));
  const width = sectors.length * sectorSlot + pad.left + pad.right;
  const height = plotHeight + pad.top + pad.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  const sectorMap = new Map();
  rows.forEach((row) => {
    if (!sectorMap.has(row.short)) sectorMap.set(row.short, []);
    sectorMap.get(row.short).push(row);
  });

  return (
    <Panel
      title={showComposite ? `${principleName} Composite Risk Score by Sector` : "KPI Risk Scores by Sector"}
      subtitle={showComposite ? `Composite · box = IQR · line = median${highlightFlag ? ` · dots = ${highlightFlag.label.toLowerCase()}` : ""}` : "box = IQR · line = median · select chips above to filter KPIs"}
    >
      <div className="overflow-x-auto px-4 pb-4 pt-1">
        <svg viewBox={`0 0 ${width} ${height}`} width={Math.max(width, targetPlotWidth)} height={height} style={{ display: "block" }}>
          {yTicks.map((tick) => {
            const y = scaleY(tick, plotHeight, pad.top);
            return (
              <g key={tick}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f0f4f8" strokeWidth="1" />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {tick}
                </text>
              </g>
            );
          })}

          <rect x={pad.left} y={scaleY(100, plotHeight, pad.top)} width={width - pad.left - pad.right} height={scaleY(65, plotHeight, pad.top) - scaleY(100, plotHeight, pad.top)} fill="#fee2e2" fillOpacity="0.12" />
          <rect x={pad.left} y={scaleY(65, plotHeight, pad.top)} width={width - pad.left - pad.right} height={scaleY(35, plotHeight, pad.top) - scaleY(65, plotHeight, pad.top)} fill="#fef3c7" fillOpacity="0.16" />
          <line x1={pad.left} y1={scaleY(50, plotHeight, pad.top)} x2={width - pad.right} y2={scaleY(50, plotHeight, pad.top)} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth="0.8" />

          {sectors.map((sector, sectorIndex) => {
            const sectorRows = sectorMap.get(sector) || [];
            const centerX = pad.left + sectorIndex * sectorSlot + sectorSlot / 2;

            if (showComposite) {
              const stats = boxStats(sectorRows.map((row) => row.composite));
              const color = RISK_COLOR[riskTier(stats?.median ?? null)];
              const flaggedRows = highlightFlag ? sectorRows.filter((row) => row[highlightFlag.key]) : [];
              const isEnergy = sector === "Energy" && highlightFlag?.key === "fatality_flag";
              return (
                <g key={sector}>
                  <Box cx={centerX} stats={stats} color={color} boxW={boxWidth} padTop={pad.top} plotHeight={plotHeight} />
                  {flaggedRows.map((row, idx) => (
                    <circle
                      key={`${row.name}-${idx}`}
                      cx={centerX + hashJitter(row.name, boxWidth * 2)}
                      cy={scaleY(row.composite ?? 90, plotHeight, pad.top)}
                      r={3}
                      fill="#ff5e5e"
                      fillOpacity="0.85"
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                  ))}
                  {isEnergy && stats ? (
                    <text x={centerX} y={pad.top - 8} textAnchor="middle" fontSize="8" fill="#ff5e5e">
                      ⚑ Scores capped at 90 — fatality flag floor
                    </text>
                  ) : null}
                  <text x={centerX} y={height - pad.bottom + 14} textAnchor="middle" fontSize="9.5" fill="#475569">
                    {sector}
                  </text>
                  {stats ? (
                    <text x={centerX} y={height - pad.bottom + 27} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
                      med {stats.median.toFixed(0)} · n={stats.n}
                    </text>
                  ) : null}
                </g>
              );
            }

            const slot = 22;
            const groupWidth = visibleKpis.length * slot;
            const start = centerX - groupWidth / 2;
            return (
              <g key={sector}>
                {visibleKpis.map((kpi, kpiIndex) => {
                  const cx = start + kpiIndex * slot + slot / 2;
                  const stats = boxStats(sectorRows.map((row) => row[kpi.key]));
                  return <Box key={kpi.key} cx={cx} stats={stats} color={kpi.color} boxW={boxWidth} padTop={pad.top} plotHeight={plotHeight} />;
                })}
                <text x={centerX} y={height - pad.bottom + 14} textAnchor="middle" fontSize="9" fill="#475569">
                  {sector}
                </text>
              </g>
            );
          })}

          <text transform={`rotate(-90)`} x={-(pad.top + plotHeight / 2)} y={12} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {`${principleName} Composite Risk Score (higher = riskier)`}
          </text>

          {!showComposite ? (
            <g transform={`translate(${pad.left}, ${height - 12})`}>
              {visibleKpis.map((kpi, index) => (
                <g key={kpi.key} transform={`translate(${index * 108}, 0)`}>
                  <rect width="10" height="10" rx="2" fill={kpi.color} fillOpacity="0.28" stroke={kpi.color} strokeWidth="1.2" />
                  <text x="14" y="9" fontSize="9" fill="#64748b">
                    {kpi.name}
                  </text>
                </g>
              ))}
            </g>
          ) : null}
        </svg>
      </div>
    </Panel>
  );
}

function KpiIqrProfile({ rows, activeKpis, effectiveKpis = P3_KPIS }) {
  const visibleKpis = activeKpis.length === effectiveKpis.length ? effectiveKpis : effectiveKpis.filter((kpi) => activeKpis.includes(kpi.name));
  const [hovered, setHovered] = useState(null);
  const rowHeight = 40;
  const padTop = 32;
  const padBottom = 14;
  const labelWidth = 100;
  const trackX = 108;
  const trackWidth = 210;
  const rightX = 326;
  const svgWidth = 420;
  const svgHeight = padTop + visibleKpis.length * rowHeight + padBottom;
  const tx = (value) => trackX + (value / 100) * trackWidth;

  return (
    <Panel
      title="KPI Risk Score Profiles"
      subtitle="IQR bands · filtered sectors"
      className="h-full"
    >
      <div className="px-4 pb-4 pt-1 overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          {[0, 25, 50, 75, 100].map((tick) => (
            <text key={tick} x={tx(tick)} y={padTop - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
              {tick}
            </text>
          ))}
          <line x1={tx(50)} y1={padTop - 2} x2={tx(50)} y2={svgHeight - padBottom + 2} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth="0.8" />
          <rect x={trackX} y={padTop - 2} width={trackWidth * 0.35} height={svgHeight - padTop - padBottom + 4} fill="#d1fae5" fillOpacity="0.25" />
          <rect x={tx(35)} y={padTop - 2} width={trackWidth * 0.3} height={svgHeight - padTop - padBottom + 4} fill="#fef3c7" fillOpacity="0.35" />
          <rect x={tx(65)} y={padTop - 2} width={trackWidth * 0.35} height={svgHeight - padTop - padBottom + 4} fill="#fee2e2" fillOpacity="0.25" />

          {visibleKpis.map((kpi, index) => {
            const y = padTop + index * rowHeight;
            const cy = y + rowHeight / 2;
            const values = rows.map((row) => row[kpi.key]).filter((value) => value !== null);
            const stats = boxStats(values);
            const isSafety = kpi.key === "P3_4_score";
            const median = stats?.median ?? 0;
            const mean = stats?.mean ?? 0;
            const label = isSafety ? `median: ${Math.round(median)} · mean: ${mean.toFixed(1)}` : `median: ${Math.round(median)}`;
            const isHovered = hovered && hovered.key === kpi.key;

            return (
              <g 
                key={kpi.key} 
                onMouseEnter={() => setHovered(kpi)} 
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <title>{kpi.desc}</title>
                <text 
                  x={labelWidth - 4} 
                  y={cy + 4} 
                  textAnchor="end" 
                  fontSize="10" 
                  fill={isHovered ? "#176fb3" : "#475569"} 
                  fontWeight={isHovered ? "700" : "500"}
                  style={{ transition: "all 0.15s ease" }}
                >
                  {kpi.name}
                </text>
                <rect x={trackX} y={cy - 7} width={trackWidth} height={14} fill="#f1f5f9" rx="3" />
                {stats ? (
                  <rect 
                    x={tx(stats.q1)} 
                    y={cy - 7} 
                    width={Math.max(2, tx(stats.q3) - tx(stats.q1))} 
                    height={14} 
                    fill={kpi.color} 
                    fillOpacity={isHovered ? "0.5" : "0.3"} 
                    rx="2"
                    style={{ transition: "fill-opacity 0.15s ease" }}
                  />
                ) : null}
                {stats ? (
                  <line 
                    x1={tx(stats.median)} 
                    y1={cy - 9} 
                    x2={tx(stats.median)} 
                    y2={cy + 9} 
                    stroke={kpi.color} 
                    strokeWidth={isHovered ? "3.5" : "2.5"} 
                    strokeLinecap="round"
                    style={{ transition: "stroke-width 0.15s ease" }}
                  /> 
                ) : null}
                <text 
                  x={rightX} 
                  y={cy + 4} 
                  fontSize="9" 
                  fill={isHovered ? "#176fb3" : "#64748b"}
                  fontWeight={isHovered ? "600" : "400"}
                  style={{ transition: "all 0.15s ease" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}

function FlagCountChart({ rows, effectiveFlags = FLAG_DEFS }) {
  const legendItems = effectiveFlags.map((flag) => ({ label: flag.label, color: flag.color }));

  if (!effectiveFlags.length) {
    return (
      <Panel title="Flag Distribution by Sector" subtitle="No flags configured for this principle">
        <div className="px-4 pb-4 pt-2 text-[12px]" style={{ color: "#94a3b8" }}>
          This principle does not use flag-based sector charts.
        </div>
      </Panel>
    );
  }

  const sectorMap = new Map();
  rows.forEach((row) => {
    if (!sectorMap.has(row.short)) sectorMap.set(row.short, []);
    sectorMap.get(row.short).push(row);
  });

  const sectorData = [...sectorMap.entries()].map(([sector, sectorRows]) => {
    const counts = Object.fromEntries(effectiveFlags.map((flag) => [flag.key, 0]));
    sectorRows.forEach((row) => {
      effectiveFlags.forEach((flag) => {
        if (row[flag.key]) counts[flag.key] += 1;
      });
    });
    return {
      sector,
      companies: sectorRows.length,
      totalFlags: Object.values(counts).reduce((sum, value) => sum + value, 0),
      counts,
      rates: Object.fromEntries(
        effectiveFlags.map((flag) => [flag.key, sectorRows.length > 0 ? (counts[flag.key] / sectorRows.length) * 100 : 0])
      ),
    };
  });

  const absoluteOrder = [...sectorData].sort((a, b) => b.totalFlags - a.totalFlags).map((entry) => entry.sector);
  const rateOrder = [...sectorData]
    .sort((a, b) => {
      const aTotal = Object.values(a.rates).reduce((sum, value) => sum + value, 0);
      const bTotal = Object.values(b.rates).reduce((sum, value) => sum + value, 0);
      return bTotal - aTotal;
    })
    .map((entry) => entry.sector);

  const renderChart = (title, rowsOrder, mode) => {
    const dataBySector = rowsOrder.map((sector) => sectorData.find((entry) => entry.sector === sector)).filter(Boolean);
    const padTop = 28;
    const padBottom = 54;
    const padLeft = 26;
    const padRight = 18;
    const sectorSlot = 78;
    const barWidth = 10;
    const groupGap = 4;
    const chartWidth = Math.max(320, dataBySector.length * sectorSlot + 36);
    const chartHeight = 300;
    const plotHeight = chartHeight - padTop - padBottom;
    const maxValue = Math.max(
      1,
      ...dataBySector.flatMap((entry) => effectiveFlags.map((flag) => (mode === "abs" ? entry.counts[flag.key] : entry.rates[flag.key])))
    );
    const yTicks = mode === "abs" ? [0, Math.ceil(maxValue / 4), Math.ceil(maxValue / 2), Math.ceil((maxValue * 3) / 4), Math.ceil(maxValue)] : [0, 25, 50, 75, 100];
    const scale = (value) => ((mode === "abs" ? value / maxValue : value / 100) * plotHeight);

    return (
      <div>
        <div className="mb-2 text-[12px] font-semibold" style={{ color: "#1a2333" }}>
          {title}
          <span className="ml-2 text-[11px] font-normal" style={{ color: "#94a3b8" }}>
            {mode === "abs" ? "absolute counts" : "% of sector"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width={chartWidth} height={chartHeight} style={{ display: "block" }}>
            {yTicks.map((tick) => {
              const y = padTop + plotHeight - scale(tick);
              return (
                <g key={tick}>
                  <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} stroke="#e8edf4" strokeWidth="1" />
                  <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize="8.5" fill="#94a3b8">
                    {mode === "abs" ? tick : `${tick}%`}
                  </text>
                </g>
              );
            })}

            {dataBySector.map((entry, index) => {
              const groupX = padLeft + index * sectorSlot + 8;
              const xCenter = groupX + (effectiveFlags.length * (barWidth + groupGap)) / 2;
              return (
                <g key={entry.sector}>
                  {effectiveFlags.map((flag, flagIndex) => {
                    const value = mode === "abs" ? entry.counts[flag.key] : entry.rates[flag.key];
                    const barHeight = scale(value);
                    const x = groupX + flagIndex * (barWidth + groupGap);
                    const y = padTop + plotHeight - barHeight;
                    return (
                      <g key={flag.key}>
                        <rect x={x} y={y} width={barWidth} height={Math.max(0, barHeight)} fill={flag.color} rx="2" />
                        {value > 0 ? (
                          <text x={x + barWidth / 2} y={Math.max(padTop + 8, y - 3)} textAnchor="middle" fontSize="8" fill="#64748b">
                            {mode === "abs" ? value : `${value.toFixed(1)}%`}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  <text
                    x={xCenter}
                    y={chartHeight - 18}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#475569"
                    transform={`rotate(30 ${xCenter} ${chartHeight - 18})`}
                  >
                    {entry.sector}
                  </text>
                </g>
              );
            })}

            <line x1={padLeft} y1={padTop + plotHeight} x2={chartWidth - padRight} y2={padTop + plotHeight} stroke="#e2e8f0" strokeWidth="1" />
            <text x={chartWidth / 2} y={chartHeight - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
              Sector (higher = riskier)
            </text>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Panel
      title="Flag Distribution by Sector"
      subtitle="Flagged companies have principle score floored at 90"
      headerRight={<MiniLegend items={legendItems} />}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-4 pb-4 pt-2">
        {renderChart("Absolute flag counts", absoluteOrder, "abs")}
        {renderChart("Flag rate by sector", rateOrder, "pct")}
      </div>
    </Panel>
  );
}

function CompanyHistogram({ rows, sectorLabel, principleName = "P3", effectiveFlags = FLAG_DEFS }) {
  const [mode, setMode] = useState("all");
  const valid = rows.filter((row) => row.composite !== null).sort((a, b) => b.composite - a.composite);
  const highlightFlag = effectiveFlags[0] || null;
  const flagged = highlightFlag ? valid.filter((row) => row[highlightFlag.key]) : [];

  const bins = Array.from({ length: 20 }, (_, index) => {
    const lo = index * 5;
    const hi = lo + 5;
    const count = valid.filter((row) => row.composite >= lo && row.composite < hi).length;
    return { lo, hi, mid: lo + 2.5, count, tier: riskTier(lo + 2.5) };
  });

  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const bw = 8;
  const kdePoints = Array.from({ length: 101 }, (_, x) => {
    const y = valid.reduce((sum, row) => {
      const z = (x - row.composite) / bw;
      return sum + Math.exp(-0.5 * z * z);
    }, 0) / (Math.max(valid.length, 1) * bw * Math.sqrt(2 * Math.PI));
    return { x, y };
  });
  const maxKde = Math.max(...kdePoints.map((point) => point.y), 0.001);

  const pad = { left: 44, right: 24, top: 18, bottom: 44 };
  const plotWidth = 560;
  const plotHeight = 160;
  const svgWidth = plotWidth + pad.left + pad.right;
  const svgHeight = plotHeight + pad.top + pad.bottom;
  const sx = (value) => pad.left + (value / 100) * plotWidth;
  const sy = (value) => pad.top + plotHeight - (value / maxCount) * plotHeight;
  const syk = (value) => pad.top + plotHeight - (value / maxKde) * plotHeight;
  const kdePath = kdePoints.map((point, index) => `${index === 0 ? "M" : "L"}${sx(point.x)},${syk(point.y)}`).join(" ");

  if (mode !== "all") {
    const topRows = mode === "top20" ? valid.slice(0, 20) : valid.slice(0, 40);
    const barHeight = 18;
    const gap = 3;
    const svgHeightRanked = topRows.length * (barHeight + gap) + 50;
    const barWidth = 420;
    const maxScore = topRows[0]?.composite ?? 100;

    return (
      <Panel
        title={`${principleName} Composite Score Distribution`}
        subtitle={sectorLabel ? `${sectorLabel} sector selection` : `bars = ranked scores${highlightFlag ? ` · ${highlightFlag.label.toLowerCase()} rows are hatched` : ""}`}
        headerRight={
          <div className="flex gap-2 rounded-full p-0.5" style={{ background: "#e8ecf1" }}>
            {["all", "top20", "top40"].map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className="rounded-full px-3 py-[3px] text-[11px]"
                style={{
                  background: mode === value ? "#fff" : "transparent",
                  color: mode === value ? "#1a2333" : "#64748b",
                  fontWeight: mode === value ? 600 : 400,
                }}
              >
                {value === "all" ? "Histogram" : value === "top20" ? "Top 20" : "Top 40"}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto px-4 pb-4 pt-2">
          <svg viewBox={`0 0 ${barWidth + 160} ${svgHeightRanked}`} width={Math.max(barWidth + 160, 500)} height={svgHeightRanked} style={{ display: "block" }}>
            {topRows.map((row, index) => {
              const barFill = riskTier(row.composite);
              const barX = 158;
              const barY = 24 + index * (barHeight + gap);
              const width = (row.composite / maxScore) * barWidth;
              return (
                <g key={row.name}>
                  <text x={155} y={barY + barHeight - 4} textAnchor="end" fontSize="9" fill="#475569">
                    {row.name.length > 22 ? `${row.name.slice(0, 21)}…` : row.name}
                  </text>
                  <defs>
                    <pattern id={`hatch-${index}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="4" stroke={RISK_COLOR[barFill]} strokeWidth="1.5" strokeOpacity="0.5" />
                    </pattern>
                  </defs>
                  <rect
                    x={barX}
                    y={barY}
                    width={Math.max(2, width)}
                    height={barHeight}
                    fill={highlightFlag && row[highlightFlag.key] ? `url(#hatch-${index})` : RISK_COLOR[barFill]}
                    fillOpacity={highlightFlag && row[highlightFlag.key] ? 1 : 0.6}
                    rx="2"
                  />
                  {highlightFlag && row[highlightFlag.key] ? <text x={barX + width + 4} y={barY + barHeight - 4} fontSize="9" fill="#ff5e5e">{highlightFlag.abbr || "⚑"}</text> : null}
                  <text x={barX + width + 14} y={barY + barHeight - 4} fontSize="9" fill="#64748b">
                    {row.composite.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={`${principleName} Composite Score Distribution`}
      subtitle={`bars = histogram · curve = KDE${highlightFlag ? ` · ticks = ${highlightFlag.label.toLowerCase()}` : ""}`}
      headerRight={
        <div className="flex gap-2 rounded-full p-0.5" style={{ background: "#e8ecf1" }}>
          {["all", "top20", "top40"].map((value) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className="rounded-full px-3 py-[3px] text-[11px]"
              style={{
                background: mode === value ? "#fff" : "transparent",
                color: mode === value ? "#1a2333" : "#64748b",
                fontWeight: mode === value ? 600 : 400,
              }}
            >
              {value === "all" ? "All" : value === "top20" ? "Top 20" : "Top 40"}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto px-4 pb-4 pt-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width={Math.max(svgWidth, 500)} height={svgHeight} style={{ display: "block" }}>
          {[0, Math.round(maxCount / 2), maxCount].map((tick) => {
            const y = sy(tick);
            return (
              <g key={tick}>
                <line x1={pad.left} y1={y} x2={svgWidth - pad.right} y2={y} stroke="#f0f4f8" strokeWidth="1" />
                <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="8.5" fill="#94a3b8">
                  {tick}
                </text>
              </g>
            );
          })}
          <rect x={sx(0)} y={pad.top} width={sx(35) - sx(0)} height={plotHeight} fill="#d1fae5" fillOpacity="0.15" />
          <rect x={sx(35)} y={pad.top} width={sx(65) - sx(35)} height={plotHeight} fill="#fef3c7" fillOpacity="0.2" />
          <rect x={sx(65)} y={pad.top} width={sx(100) - sx(65)} height={plotHeight} fill="#fee2e2" fillOpacity="0.15" />
          {bins.map((bin, index) => {
            const barLeft = sx(bin.lo) + 1;
            const barWidth = Math.max(0, sx(bin.hi) - sx(bin.lo) - 2);
            const barTop = sy(bin.count);
            const barHeight = Math.max(0, plotHeight - (barTop - pad.top));
            return (
              <rect key={index} x={barLeft} y={barTop} width={barWidth} height={barHeight} fill={RISK_COLOR[bin.tier]} fillOpacity="0.4" stroke={RISK_COLOR[bin.tier]} strokeWidth="0.5" />
            );
          })}
          <path d={kdePath} fill="none" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
          {flagged.map((row, index) => (
            <line key={index} x1={sx(row.composite)} y1={pad.top + plotHeight + 4} x2={sx(row.composite)} y2={pad.top + plotHeight + 11} stroke="#ff5e5e" strokeWidth="1.5" strokeOpacity="0.85" />
          ))}
          <line x1={pad.left} y1={pad.top + plotHeight} x2={svgWidth - pad.right} y2={pad.top + plotHeight} stroke="#e2e8f0" strokeWidth="1" />
          {[0, 25, 35, 50, 65, 75, 100].map((tick) => (
            <g key={tick}>
              <line x1={sx(tick)} y1={pad.top + plotHeight} x2={sx(tick)} y2={pad.top + plotHeight + 4} stroke="#e2e8f0" strokeWidth="1" />
              <text x={sx(tick)} y={pad.top + plotHeight + 14} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
                {tick}
              </text>
            </g>
          ))}
          <text x={pad.left + plotWidth / 2} y={svgHeight - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {`${principleName} Composite Risk Score (higher = riskier)`}
          </text>
        </svg>
      </div>
      {flagged.length > 0 && highlightFlag ? (
        <div className="px-4 pb-4 text-[11px]" style={{ color: "#ff5e5e" }}>
          {highlightFlag.abbr || "⚑"} {flagged.length} company{flagged.length === 1 ? "" : "ies"} with {highlightFlag.label.toLowerCase()} shown as red ticks
        </div>
      ) : null}
    </Panel>
  );
}

function RadarChart({ company, sectorRows, activeKpis, effectiveKpis = P3_KPIS }) {
  const visibleKpis = activeKpis.length === effectiveKpis.length ? effectiveKpis : effectiveKpis.filter((kpi) => activeKpis.includes(kpi.name));

  if (!company) {
    return (
      <div className="bg-white border rounded-lg p-4 flex items-center justify-center" style={{ borderColor: "#e2e8f0", minHeight: 320 }}>
        <div className="text-center text-[#94a3b8]">
          <div className="mb-2 text-[28px]">○</div>
          <div className="text-[13px]">Select a company from the table below</div>
        </div>
      </div>
    );
  }

  const cx = 130;
  const cy = 120;
  const maxRadius = 90;
  const svgWidth = 380;
  const svgHeight = 300;
  const count = Math.max(visibleKpis.length, 3);
  const angle = (index) => (index / count) * 2 * Math.PI - Math.PI / 2;
  const pointFor = (score, index) => {
    const radius = ((score ?? 0) / 100) * maxRadius;
    return [cx + radius * Math.cos(angle(index)), cy + radius * Math.sin(angle(index))];
  };

  const sectorMedian = visibleKpis.map((kpi, index) => {
    const values = sectorRows.map((row) => row[kpi.key]).filter((value) => value !== null).sort((a, b) => a - b);
    const median = values.length ? values[Math.floor(values.length / 2)] : 0;
    return pointFor(median, index);
  });

  const companyPoints = visibleKpis.map((kpi, index) => pointFor(company[kpi.key] ?? 0, index));
  const toPath = (points) => `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]},${point[1]}`).join(" ")} Z`;

  const tableRows = visibleKpis.map((kpi) => {
    const companyValue = company[kpi.key];
    const sectorValues = sectorRows.map((row) => row[kpi.key]).filter((value) => value !== null);
    const sectorMean = sectorValues.length ? sectorValues.reduce((sum, value) => sum + value, 0) / sectorValues.length : null;
    const delta = companyValue !== null && sectorMean !== null ? companyValue - sectorMean : null;
    return { kpi, companyValue, sectorMean, delta };
  });

  return (
    <Panel
      title="KPI Risk Radar"
      subtitle={`${company.name} · Higher = further out = higher risk`}
      className="h-full"
    >
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-start gap-3">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="52%" style={{ display: "block", flexShrink: 0 }}>
            {[25, 50, 75, 100].map((radiusValue) => {
              const ringPoints = visibleKpis.map((_, index) => {
                const r = (radiusValue / 100) * maxRadius;
                return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))];
              });
              return <polygon key={radiusValue} points={ringPoints.map((point) => point.join(",")).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="0.8" />;
            })}
            {visibleKpis.map((kpi, index) => {
              const [axisX, axisY] = pointFor(100, index);
              const [labelX, labelY] = [cx + (maxRadius + 14) * Math.cos(angle(index)), cy + (maxRadius + 14) * Math.sin(angle(index))];
              return (
                <g key={kpi.key}>
                  <line x1={cx} y1={cy} x2={axisX} y2={axisY} stroke="#e2e8f0" strokeWidth="0.8" />
                  <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="8.5" fill="#64748b">
                    <title>{kpi.desc}</title>
                    {kpi.name}
                  </text>
                </g>
              );
            })}
            <polygon points={sectorMedian.map((point) => point.join(",")).join(" ")} fill="none" stroke="#176fb3" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.7" />
            <polygon points={companyPoints.map((point) => point.join(",")).join(" ")} fill="#ff5e5e" fillOpacity="0.15" stroke="#ff5e5e" strokeWidth="2" />
            {companyPoints.map((point, index) => (
              <circle key={index} cx={point[0]} cy={point[1]} r="3" fill="#ff5e5e" stroke="#fff" strokeWidth="1" />
            ))}
            <g transform={`translate(4, ${svgHeight - 26})`}>
              <line x1="0" y1="6" x2="16" y2="6" stroke="#ff5e5e" strokeWidth="2" />
              <text x="20" y="10" fontSize="8.5" fill="#64748b">
                {company.name.slice(0, 18)}
              </text>
            </g>
            <g transform={`translate(4, ${svgHeight - 12})`}>
              <line x1="0" y1="6" x2="16" y2="6" stroke="#176fb3" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x="20" y="10" fontSize="8.5" fill="#64748b">
                Sector median
              </text>
            </g>
          </svg>

          <div style={{ flex: 1, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["KPI", "Company score", "Sector median", "Δ"].map((heading) => (
                    <th key={heading} style={{ padding: "4px 6px", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ kpi, companyValue, sectorMean, delta }) => (
                  <tr key={kpi.key}>
                    <td style={{ padding: "4px 6px", color: "#1a2333", fontWeight: 500 }}>{kpi.name}</td>
                    <td style={{ padding: "4px 6px", color: "#1a2333" }}>{companyValue !== null ? companyValue.toFixed(1) : "—"}</td>
                    <td style={{ padding: "4px 6px", color: "#64748b" }}>{sectorMean !== null ? sectorMean.toFixed(1) : "—"}</td>
                    <td style={{ padding: "4px 6px", color: delta === null ? "#94a3b8" : delta > 0 ? "#ff5e5e" : "#34d399", fontWeight: 600 }}>
                      {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function KpiContribBars({ company, sectorRows, activeKpis, effectiveKpis = P3_KPIS }) {
  const visibleKpis = activeKpis.length === effectiveKpis.length ? effectiveKpis : effectiveKpis.filter((kpi) => activeKpis.includes(kpi.name));
  const bars = visibleKpis
    .map((kpi) => {
      const companyValue = company[kpi.key];
      const values = sectorRows.map((row) => row[kpi.key]).filter((value) => value !== null);
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      const delta = companyValue !== null && mean !== null ? companyValue - mean : null;
      return { kpi, companyValue, mean, delta };
    })
    .filter((entry) => entry.companyValue !== null)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

  const pad = { left: 120, right: 110, top: 14, bottom: 10 };
  const barHeight = 18;
  const gap = 8;
  const plotWidth = 240;
  const svgWidth = pad.left + plotWidth + pad.right;
  const svgHeight = pad.top + bars.length * (barHeight + gap) + pad.bottom;
  const sx = (value) => pad.left + (value / 100) * plotWidth;
  const refX = sx(50);

  return (
    <Panel title="KPI Score vs Sector" subtitle="Sorted by delta · reference = sector mean" className="h-full">
      <div className="px-4 pb-4 pt-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" style={{ display: "block" }}>
          <line x1={refX} y1={pad.top - 4} x2={refX} y2={svgHeight - pad.bottom + 4} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <text x={refX} y={pad.top - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
            ~50
          </text>

          {bars.map((entry, index) => {
            const y = pad.top + index * (barHeight + gap);
            const barRight = sx(entry.companyValue ?? 0);
            const barWidth = Math.max(0, barRight - pad.left);
            const isPositive = (entry.delta ?? 0) >= 0;
            return (
              <g key={entry.kpi.key}>
                <text x={pad.left - 6} y={y + barHeight - 4} textAnchor="end" fontSize="9.5" fill="#475569">
                  {entry.kpi.name}
                </text>
                <rect x={pad.left} y={y} width={plotWidth} height={barHeight} fill="#f8fafc" rx="3" />
                <rect x={pad.left} y={y} width={barWidth} height={barHeight} fill={entry.kpi.color} fillOpacity="0.5" rx="3" />
                <line x1={sx(entry.mean ?? 0)} y1={y - 1} x2={sx(entry.mean ?? 0)} y2={y + barHeight + 1} stroke="#334155" strokeWidth="1" strokeDasharray="3 2" />
                <text x={pad.left + plotWidth + 6} y={y + barHeight - 4} fontSize="9" fill={isPositive ? "#ff5e5e" : "#34d399"} fontWeight="600">
                  {entry.delta === null ? "—" : `${entry.delta > 0 ? "+" : "−"}${Math.abs(entry.delta).toFixed(0)} ${entry.delta > 0 ? "more risky than peers" : "less risky than peers"}`}
                </text>
                <text x={barRight + (barRight < pad.left + plotWidth - 24 ? 3 : -3)} y={y + barHeight - 4} textAnchor={barRight < pad.left + plotWidth - 24 ? "start" : "end"} fontSize="8.5" fill="#334155">
                  {entry.companyValue.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}

const PAGE_SIZE = 25;

function CompanyTable({ rows, activeKpis, onSelect, selectedCompany, effectiveKpis = P3_KPIS, effectiveFlags = FLAG_DEFS, principleName = "P3" }) {
  const visibleKpis = activeKpis.length === effectiveKpis.length ? effectiveKpis : effectiveKpis.filter((kpi) => activeKpis.includes(kpi.name));
  const [sortKey, setSortKey] = useState("composite");
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => !query || row.name.toLowerCase().includes(query) || row.short.toLowerCase().includes(query));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const rowsCopy = [...filtered];
    rowsCopy.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "string") return sortDir * left.localeCompare(right || "");
      const av = left === null || left === undefined ? -999 : left;
      const bv = right === null || right === undefined ? -999 : right;
      return sortDir * (bv - av);
    });
    return rowsCopy;
  }, [filtered, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((dir) => -dir);
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
    setPage(0);
  }

  function exportCsv() {
    const header = ["Company", "Sector", ...visibleKpis.map((kpi) => kpi.name), `${principleName} Composite`, "Flags"];
    const rowsOut = sorted.map((row) => [
      row.name,
      row.short,
      ...visibleKpis.map((kpi) => (row[kpi.key] !== null ? row[kpi.key].toFixed(1) : "")),
      row.composite !== null ? row.composite.toFixed(1) : "",
      rowFlagTokens(row, effectiveFlags),
    ]);

    const csv = [header, ...rowsOut].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${principleName.toLowerCase()}_companies.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const headerCell = (key) => ({
    padding: "8px 10px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    borderBottom: "2px solid #e2e8f0",
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: sortKey === key ? "#f8fafc" : "transparent",
    userSelect: "none",
  });

  const cellBase = {
    padding: "7px 10px",
    fontSize: 12,
    borderBottom: "1px solid #f1f5f9",
  };

  return (
    <Panel
      title="Company-Level Data"
      subtitle={`${filtered.length} companies · click row to drill down`}
      headerRight={
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search company…"
            className="rounded-md border px-3 py-[5px] text-[12px] outline-none"
            style={{ width: 180, borderColor: "#e2e8f0" }}
          />
          <button onClick={exportCsv} className="rounded-md border px-3 py-[5px] text-[12px]" style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#475569" }}>
            Export CSV
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={headerCell("name")} onClick={() => handleSort("name")}>Company {sortKey === "name" ? (sortDir === -1 ? "↓" : "↑") : null}</th>
              <th style={headerCell("short")} onClick={() => handleSort("short")}>Sector {sortKey === "short" ? (sortDir === -1 ? "↓" : "↑") : null}</th>
              {visibleKpis.map((kpi) => (
                <th key={kpi.key} style={{ ...headerCell(kpi.key), borderBottom: `2px solid ${kpi.color}` }} onClick={() => handleSort(kpi.key)}>
                  {kpi.name} {sortKey === kpi.key ? (sortDir === -1 ? "↓" : "↑") : null}
                </th>
              ))}
              <th style={headerCell("composite")} onClick={() => handleSort("composite")}>{`${principleName} Composite`} {sortKey === "composite" ? (sortDir === -1 ? "↓" : "↑") : null}</th>
              <th style={{ ...headerCell("flags"), cursor: "default" }}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isSelected = selectedCompany?.name === row.name;
              const flags = rowFlagTokens(row, effectiveFlags);
              return (
                <tr
                  key={row.name}
                  onClick={() => onSelect(isSelected ? null : row)}
                  style={{ background: isSelected ? "#eff6ff" : "transparent", cursor: "pointer" }}
                  onMouseEnter={(event) => {
                    if (!isSelected) event.currentTarget.style.background = "#f8fafc";
                  }}
                  onMouseLeave={(event) => {
                    if (!isSelected) event.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ ...cellBase, fontWeight: isSelected ? 600 : 400, color: "#1a2333" }}>{row.name.length > 28 ? `${row.name.slice(0, 27)}…` : row.name}</td>
                  <td style={{ ...cellBase, color: "#64748b" }}>{row.short}</td>
                  {visibleKpis.map((kpi) => {
                    const value = row[kpi.key];
                    const tier = riskTier(value);
                    return (
                      <td key={kpi.key} style={{ ...cellBase, background: value !== null ? RISK_BG[tier] : "transparent", color: value !== null ? RISK_COLOR[tier] : "#94a3b8", fontWeight: value !== null ? 600 : 400, textAlign: "right" }}>
                        {value !== null ? value.toFixed(1) : "—"}
                      </td>
                    );
                  })}
                  <td style={{ ...cellBase, background: row.composite !== null ? RISK_BG[riskTier(row.composite)] : "transparent", color: row.composite !== null ? RISK_COLOR[riskTier(row.composite)] : "#94a3b8", fontWeight: 700, textAlign: "right" }}>
                    {row.composite !== null ? row.composite.toFixed(1) : "—"}
                  </td>
                  <td style={{ ...cellBase, color: "#ff5e5e", fontWeight: 600, fontSize: 12 }}>{flags}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleKpis.length + 4} style={{ ...cellBase, textAlign: "center", color: "#94a3b8", padding: "24px" }}>
                  No companies match your search
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2 border-t px-4 py-3 text-[12px]" style={{ borderColor: "#e2e8f0", color: "#64748b" }}>
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border px-3 py-1"
            style={{ borderColor: "#e2e8f0", background: page === 0 ? "#f8fafc" : "#fff", color: page === 0 ? "#94a3b8" : "#475569", cursor: page === 0 ? "not-allowed" : "pointer" }}
          >
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
            const pageNumber = Math.max(0, Math.min(totalPages - 5, page - 2)) + index;
            return (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className="rounded-md border text-[12px]"
                style={{ width: 28, height: 28, borderColor: "#e2e8f0", background: pageNumber === page ? "#176fb3" : "#fff", color: pageNumber === page ? "#fff" : "#475569", fontWeight: pageNumber === page ? 700 : 400 }}
              >
                {pageNumber + 1}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="rounded-md border px-3 py-1"
            style={{ borderColor: "#e2e8f0", background: page === totalPages - 1 ? "#f8fafc" : "#fff", color: page === totalPages - 1 ? "#94a3b8" : "#475569", cursor: page === totalPages - 1 ? "not-allowed" : "pointer" }}
          >
            Next ›
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

function SectorView({ rows, activeKpis, selectedSectors, effectiveKpis = P3_KPIS, effectiveFlags = FLAG_DEFS, principleName = "P3" }) {
  return (
    <div className="space-y-4">
      <SectorBoxPlots rows={rows} activeKpis={activeKpis} selectedSectors={selectedSectors} effectiveKpis={effectiveKpis} effectiveFlags={effectiveFlags} principleName={principleName} />
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2">
          <KpiIqrProfile rows={rows} activeKpis={activeKpis} effectiveKpis={effectiveKpis} />
        </div>
        <div className="xl:col-span-3">
          {effectiveFlags.length ? <FlagCountChart rows={rows} effectiveFlags={effectiveFlags} /> : null}
        </div>
      </div>
    </div>
  );
}

function CompanyView({ rows, activeKpis, selectedCompany, setSelectedCompany, effectiveKpis = P3_KPIS, effectiveFlags = FLAG_DEFS, principleName = "P3" }) {
  const sectorRows = useMemo(() => {
    if (!selectedCompany) return rows;
    return rows.filter((row) => row.short === selectedCompany.short);
  }, [rows, selectedCompany]);

  return (
    <div className="space-y-4">
      <Panel title="Company Score Distribution" subtitle="Toggle All / Top 20 / Top 40 in the chart header">
        <div className="px-4 pb-4 pt-2">
          <CompanyHistogram rows={rows} principleName={principleName} effectiveFlags={effectiveFlags} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {selectedCompany ? <RadarChart company={selectedCompany} sectorRows={sectorRows} activeKpis={activeKpis} effectiveKpis={effectiveKpis} /> : <Panel title="KPI Risk Radar" subtitle="Select a company from the table below"><div className="px-4 pb-4 pt-2"><div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">Select a company from the table below</div></div></Panel>}
        {selectedCompany ? <KpiContribBars company={selectedCompany} sectorRows={sectorRows} activeKpis={activeKpis} effectiveKpis={effectiveKpis} /> : <Panel title="KPI Score vs Sector" subtitle="Select a company to compare KPI contributions"><div className="px-4 pb-4 pt-2"><div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">Select a company from the table below</div></div></Panel>}
      </div>

      <CompanyTable rows={rows} activeKpis={activeKpis} onSelect={setSelectedCompany} selectedCompany={selectedCompany} effectiveKpis={effectiveKpis} effectiveFlags={effectiveFlags} principleName={principleName} />
    </div>
  );
}

export function QuestionPage({ data, sector, viewMode, activeKpis, setSector, setViewMode, setActiveKpis, __overrideKPIs, __overrideFlags, __principleId }) {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [hoveredKpiName, setHoveredKpiName] = useState(null);
  const hoverTimerRef = React.useRef(null);

  const effectiveKpis = (__overrideKPIs && __overrideKPIs.length) ? __overrideKPIs : P3_KPIS;
  const effectiveFlags = Array.isArray(__overrideFlags) ? __overrideFlags : FLAG_DEFS;
  const principleName = __principleId || "P3";

  const rows = data?.rows || [];
  const sectors = data?.sectors || ["All Sectors"];
  const activeKpiNames = activeKpis && activeKpis.length ? activeKpis : effectiveKpis.map((kpi) => kpi.name);
  const selectedSectors = useMemo(() => {
    if (Array.isArray(sector)) {
      const cleaned = sector.filter((item) => item && item !== "All Sectors");
      return cleaned.length ? cleaned : ["All Sectors"];
    }
    if (!sector || sector === "All Sectors") return ["All Sectors"];
    return [sector];
  }, [sector]);
  const isAllSectorsSelected = selectedSectors.includes("All Sectors");
  const selectedViewMode = viewMode || "Sector";
  const selectableSectors = useMemo(() => sectors.filter((item) => item !== "All Sectors"), [sectors]);

  const visibleRows = useMemo(() => {
    if (isAllSectorsSelected) return rows;
    return rows.filter((row) => selectedSectors.includes(row.short));
  }, [rows, selectedSectors, isAllSectorsSelected]);

  useEffect(() => {
    setSelectedCompany(null);
  }, [selectedSectors, selectedViewMode]);

  useEffect(() => {
    if (selectedCompany && !visibleRows.some((row) => row.name === selectedCompany.name)) {
      setSelectedCompany(null);
    }
  }, [visibleRows, selectedCompany]);

  if (!data || !rows.length) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center" style={{ borderColor: "#e2e8f0" }}>
          <div className="text-slate-500">{`Loading ${principleName} quantitative data...`}</div>
        </div>
    );
  }

  const avgComposite = visibleRows.filter((row) => row.composite !== null);
  const avgCompositeValue = avgComposite.length ? avgComposite.reduce((sum, row) => sum + row.composite, 0) / avgComposite.length : null;
  const topKpi = effectiveKpis.map((kpi) => {
    const values = visibleRows.map((row) => row[kpi.key]).filter((value) => value !== null);
    return {
      ...kpi,
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  })
    .filter((kpi) => kpi.mean !== null)
    .sort((a, b) => b.mean - a.mean)[0];
  function setSectorSelection(nextSelection) {
    if (!nextSelection.length) {
      setSector?.(["All Sectors"]);
      return;
    }
    setSector?.(nextSelection);
  }

  function toggleSectorOption(sectorName) {
    if (sectorName === "All Sectors") {
      setSectorSelection(["All Sectors"]);
      return;
    }

    const current = isAllSectorsSelected ? [] : [...selectedSectors];
    const exists = current.includes(sectorName);
    const next = exists ? current.filter((item) => item !== sectorName) : [...current, sectorName];
    setSectorSelection(next.length ? next : ["All Sectors"]);
  }

  function handleViewModeChange(mode) {
    setViewMode?.(mode);
  }

  function toggleKpi(name) {
    setActiveKpis?.((prev) => {
      const current = prev && prev.length ? prev : effectiveKpis.map((kpi) => kpi.name);
      if (current.includes(name)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== name);
      }
      return [...current, name];
    });
  }

  function resetControls() {
    setSector?.(["All Sectors"]);
    setViewMode?.("Sector");
    setActiveKpis?.(effectiveKpis.map((kpi) => kpi.name));
  }

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function scheduleHoverKpi(kpiName) {
    console.log('🔄 Hover scheduled for:', kpiName);
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      console.log('✅ Showing tooltip for:', kpiName);
      setHoveredKpiName(kpiName);
    }, 800);
  }

  function hideHoverKpi() {
    console.log('❌ Hiding tooltip');
    clearHoverTimer();
    setHoveredKpiName(null);
  }

  React.useEffect(() => {
    return () => clearHoverTimer();
  }, []);

  const controls = (
    <div className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: "#d4dce8" }}>
      <div className="flex border-b pl-[6px]" style={{ borderColor: "#e2e8f0" }}>
        {["Quant KPIs", "SRS", "Combined"].map((tab) => {
          const disabled = tab !== "Quant KPIs";
          const active = tab === "Quant KPIs";
          return (
            <button
              key={tab}
              onClick={() => (!disabled ? null : null)}
              className="px-[22px] py-[11px] text-[13.5px] flex items-center gap-[7px]"
              style={{
                color: disabled ? "#94a3b8" : active ? "#176fb3" : "#64748b",
                borderBottom: `2px solid ${active ? "#176fb3" : "transparent"}`,
                marginBottom: -1,
                fontWeight: active ? 600 : 400,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {tab}
              {disabled ? <span className="text-[10px] px-[5px] py-[1px] rounded-full" style={{ color: "#94a3b8", background: "#f1f5f9" }}>Soon</span> : null}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-[10px] px-5 py-[9px] flex-wrap" style={{ background: "#f9fafb", borderTop: "1px solid #e2e8f0" }}>
        <div className="flex rounded-full p-[2px] gap-[2px]" style={{ background: "#e8ecf1" }}>
          {["Sector", "Company"].map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className="px-[14px] py-1 rounded-full text-[12.5px]"
              style={{
                fontWeight: selectedViewMode === mode ? 600 : 400,
                background: selectedViewMode === mode ? "#fff" : "transparent",
                color: selectedViewMode === mode ? "#1a2333" : "#64748b",
                boxShadow: selectedViewMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap rounded-md px-2 py-1" style={{ border: "1px solid #e2e8f0", background: "#fff" }}>
          <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "#475569" }}>
            <input
              type="checkbox"
              checked={isAllSectorsSelected}
              onChange={() => toggleSectorOption("All Sectors")}
            />
            All Sectors
          </label>
          {selectableSectors.map((item) => (
            <label key={item} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "#475569" }}>
              <input
                type="checkbox"
                checked={!isAllSectorsSelected && selectedSectors.includes(item)}
                onChange={() => toggleSectorOption(item)}
              />
              {item}
            </label>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
        <div className="flex gap-[5px] flex-wrap flex-1">
          {effectiveKpis.map((kpi) => {
            const on = activeKpiNames.includes(kpi.name);
            const isHovered = hoveredKpiName === kpi.name;
            return (
              <div key={kpi.name} className="relative inline-block">
                <button
                  onClick={() => toggleKpi(kpi.name)}
                  onMouseEnter={() => scheduleHoverKpi(kpi.name)}
                  onMouseLeave={hideHoverKpi}
                  onFocus={() => scheduleHoverKpi(kpi.name)}
                  onBlur={hideHoverKpi}
                  className="text-xs px-[11px] py-1 rounded-full border"
                  style={{
                    borderColor: on ? "#176fb3" : "#e2e8f0",
                    background: on ? "#e8f2fb" : "#fff",
                    color: on ? "#176fb3" : "#64748b",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {kpi.name}
                </button>
                
                {isHovered && kpi.desc ? (
                  <div
                    className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-md border bg-white px-3 py-2 text-[12px] leading-5 shadow-sm"
                    style={{
                      maxWidth: 220,
                      borderColor: "#e2e8f0",
                      color: "#1a2333",
                    }}
                  >
                    <div className="whitespace-pre-line">{kpi.desc}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <button onClick={resetControls} className="text-[12.5px] px-[13px] py-[5px] rounded-md bg-white" style={{ border: "1px solid #e2e8f0", color: "#64748b" }}>
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {controls}
      <SectorStatCards rows={visibleRows} effectiveKpis={effectiveKpis} effectiveFlags={effectiveFlags} principleName={principleName} />
      {selectedViewMode === "Sector" ? (
        <SectorView rows={visibleRows} activeKpis={activeKpiNames} selectedSectors={selectedSectors} effectiveKpis={effectiveKpis} effectiveFlags={effectiveFlags} principleName={principleName} />
      ) : (
        <CompanyView rows={visibleRows} activeKpis={activeKpiNames} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany} effectiveKpis={effectiveKpis} effectiveFlags={effectiveFlags} principleName={principleName} />
      )}
    </div>
  );
}

export { P3_KPIS, FLAG_DEFS, RISK_COLOR, RISK_BG, riskTier, shortSector, boxStats };
