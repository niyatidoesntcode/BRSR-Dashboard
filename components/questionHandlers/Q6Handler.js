// ./questionHandlers/Q6Handler.js
import React, { useMemo, useState } from "react";
import Papa from "papaparse";
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
  CartesianGrid,
} from "recharts";

/* -----------------------------------------------------
   SECTOR SHORT NAMES (same as Q5)
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

/**
 * loadData - loads General + Q6 CSVs, enriches Q6 rows with company metadata
 * Accepts optional paths: { generalCsvPath, questionCsvPath }
 */
export async function loadData({ generalCsvPath = "/GeneralDisclosures_df.csv", questionCsvPath = "/GD_Q6.csv" } = {}) {
  const [gRes, qRes] = await Promise.all([fetch(generalCsvPath), fetch(questionCsvPath)]);
  const [gText, qText] = await Promise.all([gRes.text(), qRes.text()]);

  const gCsv = Papa.parse(gText, { header: true, skipEmptyLines: true });
  const qCsv = Papa.parse(qText, { header: true, skipEmptyLines: true });

  const generalDf = gCsv.data.filter((r) => r.NameOfTheCompany);
  const rawQ = qCsv.data.filter((r) => typeof r.doc_index !== "undefined" && r.doc_index !== null);

  // bucket helper (same logic as Q5)
  const bucketize = (nw) => {
    if (!nw && nw !== 0) return "Unknown";
    const v = parseFloat(nw);
    if (isNaN(v)) return "Unknown";
    if (v < 5000) return "Small Cap";
    if (v < 20000) return "Mid Cap";
    return "Large Cap";
  };

  // merge by doc_index referencing generalDf index (0-based)
  const enriched = rawQ.map((row) => {
    const idx = parseInt(row.doc_index, 10);
    const match = !isNaN(idx) && idx >= 0 && idx < generalDf.length ? generalDf[idx] : null;
    return {
      ...row,
      Company: match?.NameOfTheCompany || "Unknown",
      Sector: match?.Sector || "Unknown",
      NetWorth: match?.NetWorth_DCYMain || null,
      CapBucket: bucketize(match?.NetWorth_DCYMain),
    };
  });

  // derive dropdowns
  const sectors = ["All", ...Array.from(new Set(enriched.map((r) => r.Sector).filter(Boolean)))].sort();
  const companies = ["All", ...Array.from(new Set(enriched.map((r) => r.Company).filter(Boolean)))].sort();
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return {
    generalDf,
    enriched,
    sectors: sectors.sort(),
    companies: companies.sort(),
    capBuckets,
  };
}

/* -------------------------
   Q6-specific processing
   Q6 is "Performance of the entity against commitments" – so we'll compute:
   - performanceStatus distribution (met/partially/met with reason/not met)
   - timeline of mentions (if year exists)
   - keywords from performance/explanation text
--------------------------*/

function computePerformanceDistribution(rows) {
  // heuristics: look for keywords in 'original_text' or 'extraction_text' or 'text'
  const counts = { Met: 0, Partially: 0, NotMet: 0, Unknown: 0 };

  rows.forEach((r) => {
    const txt = String(r.original_text || r.extraction_text || r.text || "").toLowerCase();
    if (!txt.trim()) {
      counts.Unknown++;
      return;
    }
    // simple heuristic - adjust to your data
    if (txt.match(/\b(achiev|achieved|met|completed|successful)\b/)) counts.Met++;
    else if (txt.match(/\b(partial|partially|partly|partiall)\b/)) counts.Partially++;
    else if (txt.match(/\b(not met|not achieved|failed|unable|delay|delayed|missed)\b/)) counts.NotMet++;
    else counts.Unknown++;
  });

  return Object.entries(counts).map(([k, v]) => ({ status: k, count: v }));
}

function computeTopReasons(rows, topN = 12) {
  const stop = new Set(["the","and","for","that","this","with","due","to","of","in","by","is","are"]);
  const freq = {};
  rows.forEach((r) => {
    const txt = String(r.original_text || r.extraction_text || r.text || "").toLowerCase();
    // try to capture short phrases after "because", "due to", "because of"
    const reasons = [];
    const becauseMatch = txt.match(/(?:because|due to|owing to|as a result of)\s+([^.;,\n]+)/g);
    if (becauseMatch) reasons.push(...becauseMatch.map(s => s.replace(/^(?:because|due to|owing to|as a result of)\s+/,'').trim()));
    // fallback to token frequencies
    const tokens = txt.split(/\W+/).filter(w => w.length>2 && !stop.has(w));
    tokens.forEach(t => freq[t] = (freq[t] || 0) + 1);
    reasons.forEach(rsn => {
      const key = rsn.split(/\W+/).slice(0,6).join(" ");
      freq[key] = (freq[key] || 0) + 1;
    });
  });

  return Object.entries(freq).map(([word,count])=> ({ word, count })).sort((a,b)=>b.count-a.count).slice(0, topN);
}

function keywordsForTheme(rows, theme, ngram = 1) {
  const tokens = {};
  const stops = new Set(["the","and","for","that","this","year","from","we","our","due","to"]);
  rows.filter(r => r.theme && String(r.theme).includes(theme)).forEach((r) => {
    const txt = String(r.original_text || r.extraction_text || r.text || "").toLowerCase();
    const arr = txt.split(/\W+/).filter(w => w.length>2 && !stops.has(w));
    for (let i=0;i<=arr.length-ngram;i++){
      const gram = arr.slice(i,i+ngram).join(" ");
      tokens[gram] = (tokens[gram] || 0) + 1;
    }
  });
  return Object.entries(tokens).map(([w,c])=>({ word:w, count:c })).sort((a,b)=>b.count-a.count).slice(0,12).reverse();
}

/* -------------------------
   QuestionPage component
   Props:
     - data: returned from loadData()
     - filters: { sector, capBucket, ngramSize, selectedTheme, ... }
     - setFilters
     - onBack
--------------------------*/
export function QuestionPage({ data = {}, filters = {}, setFilters = () => {}, onBack = () => {} }) {
  // Fix: Handle null/undefined data
  if (!data || !data.enriched) {
    return (
      <div className="p-6 bg-white border rounded shadow-sm text-center">
        <div className="text-slate-500">Loading data...</div>
      </div>
    );
  }
  
  const rows = data.enriched ?? [];

  // Local state for company multi-select
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  // Clear selected companies when sector/cap filters change
  React.useEffect(() => {
    setSelectedCompanies([]);
  }, [filters.sector, filters.capBucket]);

  // apply simple filters
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(r.Company)) return false;
      if (filters.search && filters.search.trim()) {
        const s = filters.search.toLowerCase();
        const txt = String(r.original_text || r.extraction_text || r.text || "").toLowerCase();
        if (!txt.includes(s) && !String(r.Company || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, filters, selectedCompanies]);

  // Get unique companies from filtered Q6 rows (before company selection)
  const availableCompanies = useMemo(() => {
    const baseFiltered = rows.filter(r => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      return true;
    });
    
    const companies = new Set(
      baseFiltered
        .map((r) => r.Company)
        .filter((c) => c && c !== "Unknown")
    );
    return Array.from(companies).sort();
  }, [rows, filters.sector, filters.capBucket]);

  const perfDist = useMemo(() => computePerformanceDistribution(filtered), [filtered]);
  const reasons = useMemo(() => computeTopReasons(filtered), [filtered]);
  
  // Fix: Compute topThemes before using it
  const topThemes = useMemo(() => {
    const tmap = {};
    filtered.forEach(r => {
      if (!r.theme) return;
      String(r.theme).split(",").map(t=>t.trim()).filter(Boolean).forEach(t => tmap[t] = (tmap[t]||0)+1);
    });
    return Object.entries(tmap).map(([theme,count])=>({ theme, count })).sort((a,b)=>b.count-a.count).slice(0,10);
  }, [filtered]);

  // Fix: Now activeTheme can safely use topThemes
  const activeTheme = filters.selectedTheme || topThemes[0]?.theme || "";

  const keywords = useMemo(() => {
    const theme = filters.selectedTheme || (topThemes[0] && topThemes[0].theme) || "";
    return theme ? keywordsForTheme(filtered, theme, filters.ngramSize || 1) : [];
  }, [filtered, filters.selectedTheme, filters.ngramSize, topThemes]);

  // pie-format for perfDist
  const perfPie = perfDist.map(d => ({ name: d.status || d.status, value: d.count })).filter(d => d.value > 0);

  const PALETTE = {
    themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806"],
    ambition: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b"],
    orange: "#FFA500",
    activeBlue: "#176fb3",
  };

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border rounded shadow-sm text-center">
          <div className="text-sm text-slate-500">Total companies</div>
          <div className="text-2xl font-semibold">{data.generalDf?.length ?? 0}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm text-center">
          <div className="text-sm text-slate-500">Responses received</div>
          <div className="text-2xl font-semibold">
            {new Set(rows.filter(r => r.Company !== "Unknown").map(r => r.Company)).size}
          </div>
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
          {filtered.length} responses from {availableCompanies.length} companies match the filters!
        </div>
      </div>

      {/* Charts: layout with performance pie + top reasons */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 bg-white border rounded p-4">
          <h4 className="text-sm font-semibold mb-2">Performance status</h4>
          <div style={{ height: 260 }}>
            {perfPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={perfPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                    {perfPie.map((entry, i) => <Cell key={i} fill={PALETTE.themes[i % PALETTE.themes.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500">No data available for selected filters.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 bg-white border rounded p-4">
          <h4 className="text-sm font-semibold mb-2">Top reasons / explanations (automatically extracted)</h4>
          <div className="grid grid-cols-2 gap-3">
            {reasons.slice(0,6).map((r, i) => (
              <div key={i} className="p-2 border rounded text-sm">
                <div className="font-medium text-xs text-slate-600">#{i+1}</div>
                <div className="mt-1 text-sm">{r.word}</div>
                <div className="text-xs text-slate-400 mt-1">{r.count} mentions</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">
            Top keywords for theme "{activeTheme}"
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
              {topThemes.map((t) => (
                <option key={t.theme}>{t.theme}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: 300 }}>
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
              filtered
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
                <td className="p-3 text-sm">{r.original_text || r.extraction_text || r.text || "N/A"}</td>
              </tr>
            ))}
            {Array.from(
              filtered
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