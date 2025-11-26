// components/questionHandlers/Q5Handler.js
import Papa from "papaparse";
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

/* -----------------------------------------------------
   SECTOR SHORT NAMES
------------------------------------------------------ */
const SECTOR_SHORT_NAMES = {
  Construction: "Construction",
  Education: "Education",
  "Electricity, Gas, Steam and Air Conditioning Supply": "Electricity & Gas",
  "Financial and Insurance Activities": "Finance",
  "Human Health and Social Work Activities": "Health & Social",
  "Information and Communication": "Information & Comm",
  Manufacturing: "Manufacturing",
  "Professional, Scientific and Technical Activities": "Professional Services",
  "Transportation and Storage": "Transportation",
  "Water Supply; Sewerage, Waste Management and Remediation Activities": "Utilities & Waste",
  "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles": "Wholesale & Retail",
};

function shortSectorName(name) {
  return SECTOR_SHORT_NAMES[name] || name;
}

/* -----------------------------------------------------
   1. LOAD Q5 DATA
------------------------------------------------------ */
export async function loadData({ generalCsvPath = "/GeneralDisclosures_df.csv", questionCsvPath = "/GD_Q5.csv" } = {}) {
  const gRes = await fetch(generalCsvPath);
  const qRes = await fetch(questionCsvPath);

  const gText = await gRes.text();
  const qText = await qRes.text();

  const gCsv = Papa.parse(gText, { header: true, skipEmptyLines: true });
  const qCsv = Papa.parse(qText, { header: true, skipEmptyLines: true });

  const generalDf = gCsv.data.filter((r) => r.NameOfTheCompany);
  const rawQ5 = qCsv.data.filter((r) => r.doc_index !== undefined);

  // market-cap bucketize
  const bucketize = (nw) => {
    if (!nw) return "Unknown";
    const v = parseFloat(nw);
    if (isNaN(v)) return "Unknown";
    if (v < 5000) return "Small Cap";
    if (v < 20000) return "Mid Cap";
    return "Large Cap";
  };

  // merge
  const enrichedQ5 = rawQ5.map((row) => {
    const docIdx = parseInt(row.doc_index, 10);
    const match = !isNaN(docIdx) && docIdx < generalDf.length ? generalDf[docIdx] : null;
    return {
      ...row,
      Company: match?.NameOfTheCompany || "Unknown",
      Sector: match?.Sector || "Unknown",
      NetWorth: match?.NetWorth_DCYMain ? parseFloat(match.NetWorth_DCYMain) : null,
      CapBucket: bucketize(match?.NetWorth_DCYMain),
    };
  });

  const sectors = ["All", ...new Set(enrichedQ5.map((r) => r.Sector).filter((x) => x !== "Unknown"))];
  const companies = ["All", ...new Set(enrichedQ5.map((r) => r.Company).filter((x) => x !== "Unknown"))];
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return {
    generalDf,
    enrichedQ5,
    sectors: sectors.sort(),
    companies: companies.sort(),
    capBuckets,
  };
}

/* -----------------------------------------------------
   2. PROCESSORS
------------------------------------------------------ */
export function computeThemeDistribution(rows) {
  const dist = {};
  rows.forEach((row) => {
    if (!row.theme) return;
    String(row.theme)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((theme) => {
        dist[theme] = (dist[theme] || 0) + 1;
      });
  });

  return Object.entries(dist)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

export function computeSpecificity(rows) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  rows.forEach((row) => {
    let s = 0;
    if (row.metric?.trim()) s++;
    if (row.timeline?.trim()) s++;
    if (row.goal?.trim()) s++;
    counts[s]++;
  });
  return Object.entries(counts).map(([score, count]) => ({
    score: `Score ${score}`,
    count: parseInt(count),
  }));
}

export function computeSectorThemeMatrix(rows) {
  const data = {};
  const sectorTotals = {};

  rows.forEach((row) => {
    if (!row.Sector || !row.theme) return;

    const themes = String(row.theme)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    themes.forEach((theme) => {
      const key = `${row.Sector}|${theme}`;
      data[key] = (data[key] || 0) + 1;
      sectorTotals[row.Sector] = (sectorTotals[row.Sector] || 0) + 1;
    });
  });

  const topSectors = Object.entries(sectorTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([s]) => s);

  const themeTotals = {};
  Object.entries(data).forEach(([key, count]) => {
    const theme = key.split("|")[1];
    themeTotals[theme] = (themeTotals[theme] || 0) + count;
  });

  const topThemes = Object.entries(themeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const matrixData = topSectors.map((sec) => {
    const row = { sector: sec };
    topThemes.forEach((t) => {
      row[t] = data[`${sec}|${t}`] || 0;
    });
    return row;
  });

  return { matrixData, topThemes, topSectors };
}

export function computeAmbitionMatrix(rows) {
  const matrix = {};

  rows.forEach((row) => {
    const fullSector = row.Sector || "Unknown";
    const sector = shortSectorName(fullSector);

    const metricValue = row.metric ? String(row.metric).trim() : "";
    const timelineValue = row.timeline ? String(row.timeline).trim() : "";
    const goalValue = row.goal ? String(row.goal).trim() : "";

    const hasMetric = metricValue !== "" && metricValue !== "null" && metricValue !== "undefined";
    const hasTimeline = timelineValue !== "" && timelineValue !== "null" && timelineValue !== "undefined";
    const hasGoal = goalValue !== "" && goalValue !== "null" && goalValue !== "undefined";

    let cat = null;
    if (hasMetric && hasTimeline) cat = "Metric + Timeline";
    else if (hasMetric) cat = "Metric only";
    else if (hasTimeline) cat = "Timeline only";
    else if (hasGoal) cat = "Qualitative only";
    
    // Skip if no category assigned
    if (!cat) return;
    
    if (!matrix[sector]) matrix[sector] = {};
    if (!matrix[sector][cat]) matrix[sector][cat] = 0;
    matrix[sector][cat]++;
  });

  const cats = [
    "Metric + Timeline",
    "Metric only",
    "Timeline only",
    "Qualitative only",
  ];

  const rowsOut = Object.entries(matrix).map(([sec, obj]) => {
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    const r = { sector: sec };
    cats.forEach((c) => {
      r[c] = ((obj[c] || 0) / total) * 100;
    });
    return r;
  });

  return { rows: rowsOut, categories: cats };
}

export function computeKeywords(rows, theme, ngram = 1) {
  const relevant = rows.filter((r) => r.theme && String(r.theme).includes(theme));

  const tokens = {};
  const stops = new Set(["the", "and", "for", "from", "that", "this", "with", "have", "been", "will", "work", "make", "said", "year"]);

  relevant.forEach((row) => {
    const text = String(row.original_text || row.extraction_text || "").toLowerCase();
    const arr = text
      .split(/\W+/)
      .filter((w) => w.length > 2 && !stops.has(w));

    for (let i = 0; i <= arr.length - ngram; i++) {
      const gram = arr.slice(i, i + ngram).join(" ");
      tokens[gram] = (tokens[gram] || 0) + 1;
    }
  });

  return Object.entries(tokens)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .reverse();
}

// NEW: Cross-sector theme comparison
export function computeCrossSectorThemeData(rows, mode = "total") {
  if (!rows.length) return { rows: [], topThemes: [] };

  const counts = {};

  rows.forEach((row) => {
    if (!row.Sector || !row.theme) return;
    const sector = row.Sector;

    if (!counts[sector]) counts[sector] = {};

    const themes = String(row.theme)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    themes.forEach((t) => {
      counts[sector][t] = (counts[sector][t] || 0) + 1;
    });
  });

  // Determine top themes globally (top 5)
  const globalThemeTotals = {};
  Object.values(counts).forEach((sectorObj) => {
    Object.entries(sectorObj).forEach(([theme, count]) => {
      globalThemeTotals[theme] = (globalThemeTotals[theme] || 0) + count;
    });
  });

  const topThemes = Object.entries(globalThemeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Build chart-friendly rows
  const chartRows = Object.entries(counts).map(([sector, themeCounts]) => {
    const total = Object.values(themeCounts).reduce((a, b) => a + b, 0);

    const row = { sector: shortSectorName(sector) };

    topThemes.forEach((t) => {
      const val = themeCounts[t] || 0;
      row[t] = mode === "percentage" ? (val / total) * 100 : val;
    });

    return row;
  });

  return { rows: chartRows, topThemes };
}

/* -----------------------------------------------------
   3. REACT COMPONENT: QUESTION PAGE
------------------------------------------------------ */

export function QuestionPage({ data, filters, setFilters, onBack }) {
  // Add null/undefined check for data
  if (!data || !data.enrichedQ5) {
    return (
      <div className="p-6 bg-white border rounded shadow-sm text-center">
        <div className="text-slate-500">Loading data...</div>
      </div>
    );
  }

  // Local state for company multi-select
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  // Clear selected companies when sector/cap filters change
  React.useEffect(() => {
    setSelectedCompanies([]);
  }, [filters.sector, filters.capBucket]);

  // ---------- FILTERS ----------
  const filteredRows = useMemo(() => {
    return data.enrichedQ5.filter((r) => {
      const secMatch = filters.sector === "All" || r.Sector === filters.sector;
      const capMatch = filters.capBucket === "All" || r.CapBucket === filters.capBucket;
      return secMatch && capMatch;
    });
  }, [data.enrichedQ5, filters.sector, filters.capBucket]);

  // Get unique companies from filtered Q5 rows
  const availableCompanies = useMemo(() => {
    const companies = new Set(
      filteredRows
        .map((r) => r.Company)
        .filter((c) => c && c !== "Unknown")
    );
    return Array.from(companies).sort();
  }, [filteredRows]);

  // ---------- DERIVED CHART DATA ----------
  const themeDist = useMemo(() => computeThemeDistribution(filteredRows), [filteredRows]);
  const themePie = themeDist.map((t) => ({ theme: t.theme, count: t.count }));

  const ambition = useMemo(() => computeAmbitionMatrix(filteredRows), [filteredRows]);

  const topTheme = themeDist.length > 0 ? themeDist[0].theme : "";
  
  const allThemes = useMemo(() => {
    const set = new Set();
    filteredRows.forEach((row) => {
      if (row.theme) {
        String(row.theme)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [filteredRows]);

  const keywords = useMemo(
    () => computeKeywords(filteredRows, filters.selectedTheme || topTheme, filters.ngramSize),
    [filteredRows, filters.selectedTheme, filters.ngramSize, topTheme]
  );

  const crossSectorData = useMemo(() => {
    return computeCrossSectorThemeData(filteredRows, filters.themeCompareMode || "total");
  }, [filteredRows, filters.themeCompareMode]);

  const totalCompanies = data.generalDf.length;
  const responsesCount = new Set(data.enrichedQ5.filter((r) => r.Company !== "Unknown").map((r) => r.Company)).size;
  

  // ---------- UI ----------
  const PALETTE = {
    themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806", "#1f78b4", "#33a02c", "#fb9a99", "#e31a1c", "#b2df8a", "#a6cee3", "#cab2d6"],
    ambition: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b", "#999999"],
    orange: "#FFA500",
    activeBlue: "#176fb3",
  };

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border rounded shadow-sm text-center">
          <div className="text-sm text-slate-500">Total companies</div>
          <div className="text-2xl font-semibold">{totalCompanies}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm text-center">
          <div className="text-sm text-slate-500">Responses received</div>
          <div className="text-2xl font-semibold">{responsesCount}</div>
        </div>
      </div>  

      {/* Filters */}
      <div className="p-4 bg-white border rounded shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Sector */}
          <div>
            <div className="text-sm mb-1 text-slate-600">Sector</div>
            <select
              value={filters.sector || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
              className="w-full border p-2 rounded"
            >
              {(data.sectors || ["All"]).map((s) => (
                <option key={s} value={s}>{shortSectorName(s)}</option>
              ))}
            </select>
          </div>

          {/* Cap bucket */}
          <div>
            <div className="text-sm mb-1 text-slate-600">Market cap</div>
            <select
              value={filters.capBucket || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, capBucket: e.target.value }))}
              className="w-full border p-2 rounded"
            >
              {(data.capBuckets || ["All"]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          {availableCompanies.length} companies match the filters!
        </div>

      </div>

      {/* CHART BLOCK: 2-column Pie + Ambition */}
      <div className="grid grid-cols-12 gap-4">
        {/* Theme pie */}
        <div className="col-span-12 lg:col-span-6 bg-white p-4 border rounded shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Theme Distribution</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                  data={themePie} 
                  dataKey="count" 
                  nameKey="theme" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {themePie.map((entry, idx) => (
                    <Cell key={idx} fill={PALETTE.themes[idx % PALETTE.themes.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ambition matrix */}
        <div className="col-span-12 lg:col-span-6 bg-white p-4 border rounded shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Ambition Matrix (Completeness by Sector)</h3>
            <div className="text-xs text-slate-500 italic">Normalized by sector</div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={ambition.rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="sector" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={90}
                  interval={0}
                />
                <YAxis unit="%" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} />
                <Tooltip />
                <Legend />
                {ambition.categories.map((cat, idx) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={PALETTE.ambition[idx % PALETTE.ambition.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cross-sector theme comparison */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">
            Cross-sector comparison of top themes ({filters.themeCompareMode || "total"})
          </h3>

          <select
            value={filters.themeCompareMode || "total"}
            onChange={(e) => setFilters((p) => ({ ...p, themeCompareMode: e.target.value }))}
            className="border p-1.5 rounded text-sm"
          >
            <option value="total">Total</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={crossSectorData.rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="sector" 
              angle={-45} 
              textAnchor="end" 
              height={150}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            {crossSectorData.topThemes.map((theme, idx) => (
              <Bar key={theme} dataKey={theme} fill={PALETTE.themes[idx % PALETTE.themes.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Keywords */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">
            Top keywords/terms in "{filters.selectedTheme || topTheme}" theme
          </h3>
          <div className="flex gap-2">
            <select
              value={filters.ngramSize || 1}
              onChange={(e) => setFilters((p) => ({ ...p, ngramSize: Number(e.target.value) }))}
              className="border p-1 rounded text-sm"
            >
              <option value={1}>1-gram</option>
              <option value={2}>2-gram</option>
              <option value={3}>3-gram</option>
            </select>

            <select
              value={filters.selectedTheme || ""}
              onChange={(e) => setFilters((p) => ({ ...p, selectedTheme: e.target.value || null }))}
              className="border p-1 rounded text-sm"
            >
              <option value="">(Top theme)</option>
              {allThemes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={keywords} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="word" width={150} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill={PALETTE.orange} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Company filter */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-sm font-semibold mb-2">Filter by Company</div>

        <details className="border p-2 rounded bg-slate-50">
          <summary className="cursor-pointer text-sm text-slate-700">
            {`Selected Companies: ${selectedCompanies.length === 0 ? "All" : selectedCompanies.length}`}
          </summary>

          <div className="mt-3 max-h-60 overflow-auto space-y-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                setSelectedCompanies([]);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md border"
              style={{
                color: PALETTE.activeBlue,
                borderColor: PALETTE.activeBlue,
                background: "#ffffff",
              }}
            >
              Clear all
            </button>

            <div className="space-y-1">
              {availableCompanies.map((companyName) => (
                <label key={companyName} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(companyName)}
                    onChange={() => {
                      setSelectedCompanies((prev) => {
                        if (prev.includes(companyName)) {
                          return prev.filter((x) => x !== companyName);
                        } else {
                          return [...prev, companyName];
                        }
                      });
                    }}
                  />
                  {companyName}
                </label>
              ))}
              {availableCompanies.length === 0 && (
                <div className="text-sm text-slate-500 py-2">No companies match the current filters.</div>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-sm font-semibold mb-3">Company-level responses (filtered)</div>
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-xs text-left text-slate-500">Company</th>
              <th className="p-3 text-xs text-left text-slate-500">Sector</th>
              <th className="p-3 text-xs text-left text-slate-500">Cap</th>
              <th className="p-3 text-xs text-left text-slate-500">Response</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(
              filteredRows
                .filter((r) => selectedCompanies.length === 0 || selectedCompanies.includes(r.Company))
                .reduce((map, row) => {
                  if (!map.has(row.Company)) {
                    map.set(row.Company, row);
                  }
                  return map;
                }, new Map())
                .values()
            ).map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 text-sm">{r.Company}</td>
                <td className="p-3 text-sm">{r.Sector}</td>
                <td className="p-3 text-sm">{r.CapBucket}</td>
                <td className="p-3 text-sm">{r.original_text || r.extraction_text || "N/A"}</td>
              </tr>
            ))}
            {Array.from(
              filteredRows
                .filter((r) => selectedCompanies.length === 0 || selectedCompanies.includes(r.Company))
                .reduce((map, row) => {
                  if (!map.has(row.Company)) map.set(row.Company, row);
                  return map;
                }, new Map())
                .values()
            ).length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  No companies match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}