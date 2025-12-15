// ./questionHandlers/P5Q5Handler.js
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

/**
 * Normalize mechanism type (sort alphabetically so Policy+Whistleblower = Whistleblower+Policy)
 */
function normalizeMechanismType(type) {
  if (!type || type === "Not Specified") return "Not Specified";
  return type.split(",").map(t => t.trim()).sort().join(", ");
}

/**
 * Normalize status/effectiveness
 */
function normalizeStatus(status) {
  if (!status) return "Not Specified";
  const s = String(status).toLowerCase();
  if (s.includes("active")) return "Active";
  if (s.includes("robust")) return "Robust";
  if (s.includes("effective")) return "Effective";
  if (s.includes("in place") || s.includes("implemented")) return "In Place";
  if (s.includes("ongoing") || s.includes("monitored")) return "Ongoing";
  return "Other";
}

/**
 * Classify actions taken
 */
function classifyAction(actionText) {
  if (!actionText) return "Not Specified";
  const text = String(actionText).toLowerCase();
  
  const categories = [];
  
  if (text.match(/\b(prevent|mitigat|avoid|safeguard|protect|uphold|ensure|foster)\b/)) 
    categories.push("Preventive");
  
  if (text.match(/\b(address|resolv|rectif|correct|remedial|fix|action|disciplin)\b/)) 
    categories.push("Corrective");
  
  if (text.match(/\b(report|lodg|disclose|complaint|grievance|escalat|channel|hotline)\b/)) 
    categories.push("Reporting");
  
  if (text.match(/\b(committee|oversee|monitor|governance|review|audit|accountab)\b/)) 
    categories.push("Accountability");
  
  if (text.match(/\b(support|assist|counsel|guidance|help|facilitat)\b/)) 
    categories.push("Support");
  
  if (text.match(/\b(protect|confidential|anonymi|safeguard|dignity|rights|non-retali)\b/)) 
    categories.push("Protection");
  
  return categories.length > 0 ? categories.join(", ") : "General";
}

/**
 * loadData - now also loads TOS scoring data
 */
export async function loadData({
  generalCsvPath = "/GeneralDisclosures_df.csv",
  questionCsvPath = "/P5_Q5.csv",
  tosCsvPath = "/SRS_P5_Q5.csv",
} = {}) {
  const [gRes, qRes, tosRes] = await Promise.all([
    fetch(generalCsvPath),
    fetch(questionCsvPath),
    fetch(tosCsvPath)
  ]);
  const [gText, qText, tosText] = await Promise.all([
    gRes.text(),
    qRes.text(),
    tosRes.text()
  ]);

  const gCsv = Papa.parse(gText, { header: true, skipEmptyLines: true });
  const qCsv = Papa.parse(qText, { header: true, skipEmptyLines: true });
  const tosCsv = Papa.parse(tosText, { header: true, skipEmptyLines: true, dynamicTyping: true });

  console.log("=== TOS CSV Debug ===");
  console.log("Total rows parsed:", tosCsv.data.length);
  console.log("First row:", tosCsv.data[0]);
  console.log("Column names:", Object.keys(tosCsv.data[0] || {}));

  const generalDf = gCsv.data.filter((r) => r.NameOfTheCompany);
  const rawQ = qCsv.data.filter((r) => typeof r.doc_index !== "undefined" && r.doc_index !== null);
  
  // The CSV has an unnamed first column (index) - check for both "" and "TOS_finaldoc_index"
  const tosData = tosCsv.data.filter((r) => {
    const hasIndex = (r[""] !== undefined && r[""] !== null) || 
                     (r.TOS_finaldoc_index !== undefined && r.TOS_finaldoc_index !== null);
    return hasIndex && r.NameOfTheCompany;
  });
  
  console.log("Filtered TOS rows:", tosData.length);

  const bucketize = (nw) => {
    if (!nw && nw !== 0) return "Unknown";
    const v = parseFloat(nw);
    if (isNaN(v)) return "Unknown";
    if (v < 5000) return "Small Cap";
    if (v < 20000) return "Mid Cap";
    return "Large Cap";
  };

  const enriched = rawQ.map((row) => {
    const idx = parseInt(row.doc_index, 10);
    const match = !isNaN(idx) && idx >= 0 && idx < generalDf.length ? generalDf[idx] : null;
    
    return {
      ...row,
      Company: match?.NameOfTheCompany || "Unknown",
      Sector: match?.Sector || "Unknown",
      NetWorth: match?.NetWorth_DCYMain || null,
      CapBucket: bucketize(match?.NetWorth_DCYMain),
      mechanism_type_normalized: normalizeMechanismType(row.mechanism_type),
      status_normalized: normalizeStatus(row.status_or_effectiveness),
      action_category: classifyAction(row.actions_taken),
    };
  });

  // Enrich TOS data with company info
  const enrichedTOS = tosData.map((row) => {
    // The index column might be named "" or "TOS_finaldoc_index"
    const idx = parseInt(row[""] || row.TOS_finaldoc_index, 10);
    const match = !isNaN(idx) && idx >= 0 && idx < generalDf.length ? generalDf[idx] : null;
    
    // Parse numeric fields - handle both string and number inputs
    const parseNum = (val) => {
      if (typeof val === 'number') return val;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };
    
    return {
      ...row,
      Company: row.NameOfTheCompany || match?.NameOfTheCompany || "Unknown",
      Sector: row.Sector || match?.Sector || "Unknown",
      NetWorth: match?.NetWorth_DCYMain || null,
      CapBucket: bucketize(match?.NetWorth_DCYMain),
      // Parse numeric fields
      specificity: parseNum(row.specificity),
      actionability: parseNum(row.actionability),
      compliance: parseNum(row.compliance),
      outcome_evidence: parseNum(row.outcome_evidence),
      risk_tone: parseNum(row.risk_tone),
      transparency: parseNum(row.transparency),
      SRS: parseNum(row.SRS),
      Risk_Category: row.Risk_Category || "Unknown",
    };
  });

  console.log("Enriched TOS sample:", enrichedTOS[0]);
  console.log("Total enriched:", enrichedTOS.length);
  
  // Make available for debugging
  if (typeof window !== 'undefined') {
    window.debugTOSData = enrichedTOS;
  }

  const sectors = ["All", ...Array.from(new Set(enriched.map((r) => r.Sector).filter(Boolean)))].sort();
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return {
    generalDf,
    enriched,
    enrichedTOS,
    sectors: sectors.sort(),
    capBuckets,
  };
}

/* -----------------------------------------------------
   Processing functions for Mechanisms tab
------------------------------------------------------ */

function computeMechanismTypeDistribution(rows) {
  const counts = {};
  rows.forEach((r) => {
    const type = r.mechanism_type_normalized || "Not Specified";
    counts[type] = (counts[type] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function computeActionCategoryDistribution(rows) {
  const counts = {};
  
  rows.forEach((r) => {
    if (!r.action_category) return;
    const categories = String(r.action_category).split(",").map(c => c.trim());
    categories.forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    });
  });
  
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function computeTopPolicyReferences(rows) {
  const policies = {};
  
  rows.forEach((r) => {
    if (!r.policy_reference || String(r.policy_reference).toLowerCase() === 'nan') return;
    
    const policy = String(r.policy_reference).trim();
    if (policy.length > 5) {
      policies[policy] = (policies[policy] || 0) + 1;
    }
  });
  
  return Object.entries(policies)
    .map(([policy, count]) => ({ policy, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function computeStatusDistribution(rows) {
  const counts = {};
  
  rows.forEach((r) => {
    const status = r.status_normalized || "Not Specified";
    counts[status] = (counts[status] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function computeScopeAnalysis(rows) {
  const scopeMap = {};

  rows.forEach((r) => {
    if (!r.scope) return;
    const scopes = String(r.scope)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    scopes.forEach((scope) => {
      scopeMap[scope] = (scopeMap[scope] || 0) + 1;
    });
  });

  return Object.entries(scopeMap)
    .map(([scope, count]) => ({ scope, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeSectorMechanismMatrix(rows) {
  const matrix = {};

  rows.forEach((r) => {
    const sector = shortSectorName(r.Sector || "Unknown");
    const type = r.mechanism_type_normalized || "Not Specified";

    if (!matrix[sector]) matrix[sector] = {};
    matrix[sector][type] = (matrix[sector][type] || 0) + 1;
  });

  const typeTotals = {};
  Object.values(matrix).forEach((sectorData) => {
    Object.entries(sectorData).forEach(([type, count]) => {
      typeTotals[type] = (typeTotals[type] || 0) + count;
    });
  });

  const topTypes = Object.entries(typeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  const chartData = Object.entries(matrix)
    .map(([sector, types]) => {
      const row = { sector };
      topTypes.forEach((t) => {
        row[t] = types[t] || 0;
      });
      return row;
    })
    .sort((a, b) => {
      const sumA = topTypes.reduce((acc, t) => acc + (a[t] || 0), 0);
      const sumB = topTypes.reduce((acc, t) => acc + (b[t] || 0), 0);
      return sumB - sumA;
    })
    .slice(0, 8);

  return { data: chartData, types: topTypes };
}

/* -----------------------------------------------------
   TAB COMPONENTS
------------------------------------------------------ */

const PALETTE = {
  themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806", "#1f78b4", "#33a02c", "#fb9a99", "#e31a1c", "#b2df8a", "#a6cee3", "#cab2d6"],
  actions: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b", "#999999", "#14b8a6"],
  status: ["#e76f51", "#c0392b", "#999999", "#14b8a6", "#f6b26b", "#f79a4a"],
  orange: "#FFA500",
  activeBlue: "#176fb3",
};

// Mechanisms Overview Tab (original content)
function MechanismsTab({ data, filters, setFilters, selectedCompanies, setSelectedCompanies, availableCompanies }) {
  const rows = data.enriched ?? [];

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(r.Company)) return false;
      return true;
    });
  }, [rows, filters, selectedCompanies]);

  const mechanismDist = useMemo(() => computeMechanismTypeDistribution(filtered), [filtered]);
  const actionDist = useMemo(() => computeActionCategoryDistribution(filtered), [filtered]);
  const policyRefs = useMemo(() => computeTopPolicyReferences(filtered), [filtered]);
  const statusDist = useMemo(() => computeStatusDistribution(filtered), [filtered]);
  const scopeAnalysis = useMemo(() => computeScopeAnalysis(filtered), [filtered]);
  const sectorMatrix = useMemo(() => computeSectorMechanismMatrix(filtered), [filtered]);

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Total companies</div>
          <div className="text-2xl font-semibold">{data.generalDf?.length ?? 0}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Companies with responses</div>
          <div className="text-2xl font-semibold">
            {new Set(rows.filter((r) => r.Company !== "Unknown").map((r) => r.Company)).size}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white border rounded-lg shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1 text-slate-600">Sector</div>
            <select
              value={filters.sector || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.sectors || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {shortSectorName(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm mb-1 text-slate-600">Market cap</div>
            <select
              value={filters.capBucket || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, capBucket: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.capBuckets || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-500">
        </div>
      </div>

      {/* Row 1: Mechanism Type + Actions Taken */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Mechanism Type Distribution</h3>
          <div style={{ height: 320 }}>
            {mechanismDist.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={mechanismDist}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {mechanismDist.map((entry, i) => (
                      <Cell key={i} fill={PALETTE.themes[i % PALETTE.themes.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Actions Taken Classification</h3>
          <div style={{ height: 320 }}>
            {actionDist.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={actionDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={90}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {actionDist.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PALETTE.actions[idx % PALETTE.actions.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Policy References + Status */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Top Policy References</h3>
          <div style={{ height: 320 }}>
            {policyRefs.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={policyRefs} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="policy"
                    width={200}
                    fontSize={10}
                    tick={{ fill: "#475569" }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a89e3" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No policy data available.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Status/Effectiveness</h3>
          <div style={{ height: 320 }}>
            {statusDist.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusDist}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={PALETTE.status[i % PALETTE.status.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-center h-full">
                No data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Scope Coverage */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Scope Coverage Analysis</h3>
        <div style={{ height: 320 }}>
          {scopeAnalysis.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={scopeAnalysis} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="scope"
                  width={150}
                  fontSize={12}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#e31a56" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500 flex items-center justify-center h-full">
              No data available.
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Sector-wise Mechanism Adoption */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Sector-wise Mechanism Adoption</h3>
          <div className="text-xs text-slate-500 italic">Top 8 sectors by response count</div>
        </div>
        <div style={{ height: 380 }}>
          {sectorMatrix.data.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={sectorMatrix.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="sector"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  fontSize={11}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {sectorMatrix.types.map((type, idx) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    stackId="a"
                    fill={PALETTE.themes[idx % PALETTE.themes.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500 flex items-center justify-center h-full">
              No sector data available.
            </div>
          )}
        </div>
      </div>

      {/* Company Filter */}
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
                <div className="text-sm text-slate-500 py-2">
                  No companies match the current filters.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>

      {/* Company Responses Table */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="text-sm font-semibold mb-3">Company-level responses (filtered)</div>
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-xs text-left text-slate-500">Company</th>
              <th className="p-3 text-xs text-left text-slate-500">Sector</th>
              <th className="p-3 text-xs text-left text-slate-500">Cap</th>
              <th className="p-3 text-xs text-left text-slate-500">Mechanism Type</th>
              <th className="p-3 text-xs text-left text-slate-500">Status</th>
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
                <td className="p-3 text-sm">{r.mechanism_type_normalized || "N/A"}</td>
                <td className="p-3 text-sm">{r.status_normalized || "N/A"}</td>
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
                <td colSpan={5} className="p-4 text-center text-slate-500">
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

/* -----------------------------------------------------
   RISK CATEGORY COLORS
------------------------------------------------------ */
const RISK_COLORS = {
  "Very Low Risk": "#10b981",
  "Low Risk": "#34d399",
  "Medium Risk": "#fbbf24",
  "High Risk": "#f59e0b",
  "Very High Risk": "#dc2626",
};

/* -----------------------------------------------------
   TOS/SRS Processing Functions
------------------------------------------------------ */

function computeSectorSRSDistribution(rows) {
  const sectorData = {};
  
  rows.forEach((r) => {
    const sector = shortSectorName(r.Sector || "Unknown");
    if (!sectorData[sector]) sectorData[sector] = [];
    sectorData[sector].push(r.SRS);
  });

  // Convert to violin plot format
  return Object.entries(sectorData)
    .map(([sector, scores]) => ({
      sector,
      scores,
      count: scores.length,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeRiskCategoryBySector(rows) {
  const matrix = {};
  
  rows.forEach((r) => {
    const sector = shortSectorName(r.Sector || "Unknown");
    const risk = r.Risk_Category || "Unknown";
    
    if (!matrix[sector]) matrix[sector] = {};
    matrix[sector][risk] = (matrix[sector][risk] || 0) + 1;
  });

  const allRisks = ["Very Low Risk", "Low Risk", "Medium Risk", "High Risk", "Very High Risk"];
  
  const chartData = Object.entries(matrix)
    .map(([sector, risks]) => {
      const row = { sector };
      let total = 0;
      allRisks.forEach((risk) => {
        row[risk] = risks[risk] || 0;
        total += row[risk];
      });
      row.total = total;
      return row;
    })
    .sort((a, b) => b.total - a.total);

  return { data: chartData, risks: allRisks };
}

function computeTopBottomCompanies(rows, top = true, limit = 10) {
  const sorted = [...rows].sort((a, b) => 
    top ? b.SRS - a.SRS : a.SRS - b.SRS
  );
  
  return sorted.slice(0, limit).map(r => ({
    company: r.Company,
    srs: r.SRS,
    risk: r.Risk_Category,
    sector: shortSectorName(r.Sector),
  }));
}

function computeSectorAverageDimensions(rows, selectedSectors) {
  const sectorData = {};
  
  rows.forEach((r) => {
    const sector = shortSectorName(r.Sector || "Unknown");
    if (selectedSectors.length > 0 && !selectedSectors.includes(sector)) return;
    
    if (!sectorData[sector]) {
      sectorData[sector] = {
        specificity: [],
        actionability: [],
        compliance: [],
        outcome_evidence: [],
        risk_tone: [],
        transparency: [],
      };
    }
    
    sectorData[sector].specificity.push(r.specificity);
    sectorData[sector].actionability.push(r.actionability);
    sectorData[sector].compliance.push(r.compliance);
    sectorData[sector].outcome_evidence.push(r.outcome_evidence);
    sectorData[sector].risk_tone.push(r.risk_tone);
    sectorData[sector].transparency.push(r.transparency);
  });

  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Object.entries(sectorData).map(([sector, dims]) => ({
    sector,
    specificity: avg(dims.specificity),
    actionability: avg(dims.actionability),
    compliance: avg(dims.compliance),
    outcome_evidence: avg(dims.outcome_evidence),
    risk_tone: avg(dims.risk_tone),
    transparency: avg(dims.transparency),
  }));
}

/* -----------------------------------------------------
   Violin Plot Component (for SRS distribution)
------------------------------------------------------ */
function ViolinPlot({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500">
        No data available
      </div>
    );
  }

  // Simple box plot representation (recharts doesn't have violin built-in)
  // We'll show box plots with all data points
  const boxData = data.map((d) => {
    const sorted = [...d.scores].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    return {
      sector: d.sector,
      min,
      q1,
      median,
      q3,
      max,
      mean: d.scores.reduce((a, b) => a + b, 0) / d.scores.length,
    };
  });

  return (
    <ResponsiveContainer>
      <BarChart data={boxData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="sector"
          angle={-45}
          textAnchor="end"
          height={100}
          interval={0}
          fontSize={10}
        />
        <YAxis domain={[0, 100]} label={{ value: 'SRS Score', angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          content={({ payload }) => {
            if (!payload || !payload[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white p-2 border rounded shadow-sm text-xs">
                <div className="font-semibold">{d.sector}</div>
                <div>Mean: {d.mean.toFixed(1)}</div>
                <div>Median: {d.median.toFixed(1)}</div>
                <div>Q1-Q3: {d.q1.toFixed(1)} - {d.q3.toFixed(1)}</div>
                <div>Range: {d.min.toFixed(1)} - {d.max.toFixed(1)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="mean" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -----------------------------------------------------
   Radar Chart Component
------------------------------------------------------ */
function RadarChartComponent({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500">
        Select sectors to compare
      </div>
    );
  }

  // Transform for radar chart
  const dimensions = ['specificity', 'actionability', 'compliance', 'outcome_evidence', 'risk_tone', 'transparency'];
  
  const radarData = dimensions.map(dim => {
    const point = { dimension: dim };
    data.forEach(sector => {
      point[sector.sector] = (sector[dim] * 100).toFixed(1);
    });
    return point;
  });

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <ResponsiveContainer>
      <BarChart data={radarData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="dimension" 
          angle={-20}
          textAnchor="end"
          height={80}
          fontSize={11}
        />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        {data.map((sector, idx) => (
          <Bar 
            key={sector.sector}
            dataKey={sector.sector}
            fill={colors[idx % colors.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -----------------------------------------------------
   Social Risk Scoring Tab
------------------------------------------------------ */
function ScoringTab({ data, filters, setFilters }) {
  const tosRows = data.enrichedTOS ?? [];
  const [selectedRadarSectors, setSelectedRadarSectors] = useState([]);

  // Filter TOS data
  const filtered = useMemo(() => {
    return tosRows.filter((r) => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      return true;
    });
  }, [tosRows, filters]);

  // Compute visualizations
  const srsDistribution = useMemo(() => computeSectorSRSDistribution(filtered), [filtered]);
  const riskBySection = useMemo(() => computeRiskCategoryBySector(filtered), [filtered]);
  const topCompanies = useMemo(() => computeTopBottomCompanies(filtered, true, 10), [filtered]);
  const bottomCompanies = useMemo(() => computeTopBottomCompanies(filtered, false, 10), [filtered]);
  const radarData = useMemo(() => 
    computeSectorAverageDimensions(filtered, selectedRadarSectors), 
    [filtered, selectedRadarSectors]
  );

  // KPIs
  const avgSRS = filtered.length > 0 
    ? (filtered.reduce((sum, r) => sum + r.SRS, 0) / filtered.length).toFixed(1)
    : 0;
  
  const riskCounts = filtered.reduce((acc, r) => {
    acc[r.Risk_Category] = (acc[r.Risk_Category] || 0) + 1;
    return acc;
  }, {});

  const uniqueSectors = new Set(filtered.map(r => shortSectorName(r.Sector)));
  const availableSectors = Array.from(uniqueSectors).sort();

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="p-4 bg-white border rounded-lg shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1 text-slate-600">Sector</div>
            <select
              value={filters.sector || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.sectors || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Sectors" : shortSectorName(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm mb-1 text-slate-600">Market cap</div>
            <select
              value={filters.capBucket || "All"}
              onChange={(e) => setFilters((p) => ({ ...p, capBucket: e.target.value }))}
              className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              {(data.capBuckets || ["All"]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-500">
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Average SRS</div>
          <div className="text-2xl font-semibold text-blue-600">{avgSRS}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Total Companies</div>
          <div className="text-2xl font-semibold">{filtered.length}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">Low Risk</div>
          <div className="text-2xl font-semibold text-green-600">
            {(riskCounts["Low Risk"] || 0) + (riskCounts["Very Low Risk"] || 0)}
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
          <div className="text-sm text-slate-500">High Risk</div>
          <div className="text-2xl font-semibold text-red-600">
            {(riskCounts["High Risk"] || 0) + (riskCounts["Very High Risk"] || 0)}
          </div>
        </div>
      </div>

      {/* Row 1: SRS Distribution + Risk Category */}
      <div className="grid grid-cols-12 gap-4">
        {/* Violin/Box Plot */}
        <div className="col-span-12 lg:col-span-7 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Sector-wise SRS Distribution</h3>
          <div style={{ height: 350 }}>
            <ViolinPlot data={srsDistribution} />
          </div>
        </div>

        {/* Risk Category Stacked Bar */}
        <div className="col-span-12 lg:col-span-5 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Risk Category by Sector</h3>
          <div style={{ height: 350 }}>
            {riskBySection.data.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={riskBySection.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="sector"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={10}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {riskBySection.risks.map((risk) => (
                    <Bar
                      key={risk}
                      dataKey={risk}
                      stackId="a"
                      fill={RISK_COLORS[risk] || "#94a3b8"}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Top 10 + Bottom 10 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Top 10 */}
        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Top 10 Companies (Highest SRS)</h3>
          <div style={{ height: 350 }}>
            {topCompanies.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={topCompanies} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis
                    type="category"
                    dataKey="company"
                    width={150}
                    fontSize={10}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border rounded shadow-sm text-xs">
                          <div className="font-semibold">{d.company}</div>
                          <div>SRS: {d.srs.toFixed(1)}</div>
                          <div>Risk: {d.risk}</div>
                          <div>Sector: {d.sector}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="srs">
                    {topCompanies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Bottom 10 */}
        <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Bottom 10 Companies (Lowest SRS)</h3>
          <div style={{ height: 350 }}>
            {bottomCompanies.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={bottomCompanies} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis
                    type="category"
                    dataKey="company"
                    width={150}
                    fontSize={10}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border rounded shadow-sm text-xs">
                          <div className="font-semibold">{d.company}</div>
                          <div>SRS: {d.srs.toFixed(1)}</div>
                          <div>Risk: {d.risk}</div>
                          <div>Sector: {d.sector}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="srs">
                    {bottomCompanies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk] || "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Radar Chart with Sector Selection */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">6-Dimension Sector Comparison</h3>
          <div className="text-xs text-slate-500 italic">Select sectors to compare (max 4)</div>
        </div>

        {/* Sector Selection */}
        <div className="mb-4 p-3 bg-slate-50 border rounded">
          <div className="text-xs font-semibold text-slate-700 mb-2">Select Sectors:</div>
          <div className="flex flex-wrap gap-2">
            {availableSectors.map((sector) => (
              <label
                key={sector}
                className={`px-3 py-1.5 text-xs rounded-md border cursor-pointer transition ${
                  selectedRadarSectors.includes(sector)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedRadarSectors.includes(sector)}
                  onChange={() => {
                    setSelectedRadarSectors((prev) => {
                      if (prev.includes(sector)) {
                        return prev.filter((s) => s !== sector);
                      } else if (prev.length < 4) {
                        return [...prev, sector];
                      } else {
                        return prev;
                      }
                    });
                  }}
                />
                {sector}
              </label>
            ))}
          </div>
          {selectedRadarSectors.length === 0 && (
            <div className="text-xs text-slate-500 mt-2">
              Click on sectors above to compare their performance across 6 dimensions
            </div>
          )}
        </div>

        <div style={{ height: 400 }}>
          <RadarChartComponent data={radarData} />
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------
   Main QuestionPage component with Tabs
------------------------------------------------------ */
export function QuestionPage({ data = {}, filters = {}, setFilters = () => {}, onBack = () => {} }) {
  const [activeTab, setActiveTab] = useState("mechanisms");
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  if (!data || !data.enriched) {
    return (
      <div className="p-6 bg-white border rounded shadow-sm text-center">
        <div className="text-slate-500">Loading data...</div>
      </div>
    );
  }

  const rows = data.enriched ?? [];

  React.useEffect(() => {
    setSelectedCompanies([]);
  }, [filters.sector, filters.capBucket]);

  const availableCompanies = useMemo(() => {
    const baseFiltered = rows.filter((r) => {
      if (!r) return false;
      if (filters.sector && filters.sector !== "All" && r.Sector !== filters.sector) return false;
      if (filters.capBucket && filters.capBucket !== "All" && r.CapBucket !== filters.capBucket) return false;
      return true;
    });

    const companies = new Set(
      baseFiltered.map((r) => r.Company).filter((c) => c && c !== "Unknown")
    );
    return Array.from(companies).sort();
  }, [rows, filters.sector, filters.capBucket]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white border rounded-lg shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("mechanisms")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded transition-all ${
            activeTab === "mechanisms"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Qualitative Data Analysis
        </button>
        <button
          onClick={() => setActiveTab("scoring")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded transition-all ${
            activeTab === "scoring"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Social Risk Scoring
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "mechanisms" && (
        <MechanismsTab
          data={data}
          filters={filters}
          setFilters={setFilters}
          selectedCompanies={selectedCompanies}
          setSelectedCompanies={setSelectedCompanies}
          availableCompanies={availableCompanies}
        />
      )}

      {activeTab === "scoring" && (
        <ScoringTab
          data={data}
          filters={filters}
          setFilters={setFilters}
        />
      )}
    </div>
  );
}