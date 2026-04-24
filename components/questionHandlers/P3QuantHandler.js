// components/questionHandlers/P3QuantHandler.js
import Papa from "papaparse";
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

/* =====================================================
   SECTOR SHORT NAMES
===================================================== */
const SECTOR_SHORT_NAMES = {
  Construction: "Construction",
  Education: "Education",
  "Electricity, Gas, Steam and Air Conditioning Supply": "Electricity & Gas",
  "Financial and Insurance Activities": "Finance",
  "Human Health and Social Work Activities": "Health & Social",
  "Information and Communication": "Information & Comm",
  Manufacturing: "Manufacturing",
  "Professional, Scientific and Technical Activities": "Prof. Services",
  "Transportation and Storage": "Transportation",
  "Water Supply; Sewerage, Waste Management and Remediation Activities": "Utilities",
  "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles": "Wholesale & Retail",
  Other: "Other",
};

function shortSectorName(name) {
  return SECTOR_SHORT_NAMES[name] || name;
}

const PALETTE = {
  themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806", "#1f78b4", "#33a02c", "#fb9a99", "#e31a1c", "#b2df8a", "#a6cee3", "#cab2d6"],
  actions: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b", "#999999", "#14b8a6"],
  status: ["#e76f51", "#c0392b", "#999999", "#14b8a6", "#f6b26b", "#f79a4a"],
  gender: ["#2b83ba", "#e76f51", "#14b8a6"],
  orange: "#FFA500",
  activeBlue: "#176fb3",
};

/* =====================================================
   1. LOAD P3 QUANTITATIVE DATA
===================================================== */
export async function loadData({ dashboardCsvPath = "/BRSR_Dashboard_Data.csv" } = {}) {
  const res = await fetch(dashboardCsvPath);
  const text = await res.text();
  const csv = Papa.parse(text, { header: true, skipEmptyLines: true });

  const data = csv.data.filter((r) => r.Company_Name && r.Sector);
  const numericalCols = csv.meta.fields.filter((f) => f !== "Company_Name" && f !== "Sector");
  const sectors = ["All", ...new Set(data.map((r) => r.Sector).filter(Boolean))].sort();
  const companies = data.map((r) => r.Company_Name).filter(Boolean).sort();

  return { data, numericalCols, sectors, companies };
}

/* =====================================================
   2. DIMENSION EXTRACTION HELPERS
===================================================== */

// Extract dimensions from column names
function extractDimensions(colName) {
  const parts = colName.split("_");
  return {
    metricType: colName.match(/^(Number|Percentage|Rate)/) ? colName.match(/^(Number|Percentage|Rate)/)[1] : "Other",
    gender: colName.includes("Male") ? "Male" : colName.includes("Female") ? "Female" : colName.includes("Other") ? "Other" : "Combined",
    employmentStatus: colName.includes("Permanent") ? "Permanent" : colName.includes("OtherThanPermanent") ? "OtherThanPermanent" : "Combined",
    timePeriod: colName.includes("_CY") ? "CY" : colName.includes("_PY") ? "PY" : "Both",
    category: parts[0] || "General",
  };
}

// Calculate total employees across all gender/employment variants
function calculateTotalEmployees(rows, numericalCols) {
  const totalColName = numericalCols.find((col) =>
    col.includes("NumberOfEmployees") && col.includes("_D_") && col.includes("_Combined") && col.includes("_CY") && !col.includes("_W_")
  );

  if (!totalColName) return 0;

  return rows.reduce((sum, row) => {
    const val = parseFloat(row[totalColName]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

// Calculate gender ratio from relevant columns
function calculateGenderMetrics(rows, numericalCols) {
  const genderMetrics = { Male: 0, Female: 0, Other: 0 };

  numericalCols.forEach((col) => {
    if (!col.includes("NumberOfEmployees") || !col.includes("_D_") || !col.includes("_CY") || col.includes("_W_")) return;

    if (col.includes("_Male") && !col.includes("_Female")) {
      genderMetrics.Male += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    } else if (col.includes("_Female") && !col.includes("_Male")) {
      genderMetrics.Female += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    }
  });

  const total = genderMetrics.Male + genderMetrics.Female;
  return {
    Male: total > 0 ? ((genderMetrics.Male / total) * 100).toFixed(1) : 0,
    Female: total > 0 ? ((genderMetrics.Female / total) * 100).toFixed(1) : 0,
  };
}

// Build stacked bar data by gender
function buildGenderStackedData(rows, numericalCols, sector) {
  const categories = new Set();
  const genderData = {};

  numericalCols.forEach((col) => {
    if (!col.includes("NumberOfEmployees") || !col.includes("_D_") || col.includes("_W_")) return;

    const catMatch = col.split("_")[0];
    if (!catMatch) return;

    categories.add(catMatch);

    if (!genderData[catMatch]) genderData[catMatch] = { category: catMatch, Male: 0, Female: 0, Other: 0 };

    if (col.includes("_Male") && !col.includes("_Female")) {
      genderData[catMatch].Male += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    } else if (col.includes("_Female") && !col.includes("_Male")) {
      genderData[catMatch].Female += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    }
  });

  return Object.values(genderData).slice(0, 5);
}

// Build employment status distribution
function buildEmploymentStatusData(rows, numericalCols) {
  const statusData = { Permanent: 0, OtherThanPermanent: 0 };

  numericalCols.forEach((col) => {
    if (!col.includes("NumberOfEmployees") || !col.includes("_D_") || col.includes("_W_")) return;

    if (col.includes("_Permanent") && !col.includes("_OtherThanPermanent")) {
      statusData.Permanent += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    } else if (col.includes("_OtherThanPermanent")) {
      statusData.OtherThanPermanent += rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    }
  });

  const total = statusData.Permanent + statusData.OtherThanPermanent;
  return [
    { status: "Permanent", value: parseFloat(((statusData.Permanent / total) * 100).toFixed(1)), count: parseInt(statusData.Permanent) },
    { status: "OtherThanPermanent", value: parseFloat(((statusData.OtherThanPermanent / total) * 100).toFixed(1)), count: parseInt(statusData.OtherThanPermanent) },
  ];
}

// Build CY vs PY comparison
function buildCYvsPYData(rows, numericalCols) {
  const cyPyData = {};

  numericalCols.forEach((col) => {
    if (!col.includes("NumberOfEmployees") || !col.includes("_D_") || col.includes("_W_")) return;

    const catMatch = col.split("_")[0];
    const isCY = col.includes("_CY");

    if (!cyPyData[catMatch]) cyPyData[catMatch] = { category: catMatch, CY: 0, PY: 0 };

    const val = rows.reduce((sum, row) => sum + (isNaN(parseFloat(row[col])) ? 0 : parseFloat(row[col])), 0);
    if (isCY) cyPyData[catMatch].CY += val;
    else cyPyData[catMatch].PY += val;
  });

  return Object.values(cyPyData).slice(0, 6);
}

/* =====================================================
   3. REACT COMPONENT: P3 QUANTITATIVE PAGE
===================================================== */
export function QuestionPage({ data, filters, setFilters }) {
  if (!data || !data.data) {
    return (
      <div className="p-6 bg-white border rounded shadow-sm text-center">
        <div className="text-slate-500">Loading P3 quantitative data...</div>
      </div>
    );
  }

  const [selectedCompanies, setSelectedCompanies] = useState([]);

  // Filter by sector
  const filteredData = useMemo(() => {
    return data.data.filter((r) => filters.sector === "All" || r.Sector === filters.sector);
  }, [data.data, filters.sector]);

  const availableCompanies = useMemo(() => {
    return [...new Set(filteredData.map((r) => r.Company_Name))].sort();
  }, [filteredData]);

  // Reset companies when sector changes
  React.useEffect(() => {
    setSelectedCompanies([]);
  }, [filters.sector]);

  // KPI Calculations
  const totalEmployees = useMemo(() => calculateTotalEmployees(filteredData, data.numericalCols), [filteredData, data.numericalCols]);
  const genderMetrics = useMemo(() => calculateGenderMetrics(filteredData, data.numericalCols), [filteredData, data.numericalCols]);
  const genderStackedData = useMemo(() => buildGenderStackedData(filteredData, data.numericalCols), [filteredData, data.numericalCols]);
  const employmentStatusData = useMemo(() => buildEmploymentStatusData(filteredData, data.numericalCols), [filteredData, data.numericalCols]);
  const cyPyData = useMemo(() => buildCYvsPYData(filteredData, data.numericalCols), [filteredData, data.numericalCols]);

  // YoY Growth calculation
  const totalCY = cyPyData.reduce((sum, d) => sum + d.CY, 0);
  const totalPY = cyPyData.reduce((sum, d) => sum + d.PY, 0);
  const yoyGrowth = totalPY > 0 ? (((totalCY - totalPY) / totalPY) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white border rounded shadow-sm">
          <div className="text-sm text-slate-500 font-semibold">Total Employees</div>
          <div className="text-3xl font-bold mt-2" style={{ color: PALETTE.activeBlue }}>
            {(totalEmployees / 1000).toFixed(1)}K
          </div>
          <div className="text-xs text-slate-500 mt-1">across {availableCompanies.length} companies</div>
        </div>

        <div className="p-6 bg-white border rounded shadow-sm">
          <div className="text-sm text-slate-500 font-semibold">Gender Ratio</div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Female</span>
              <span className="font-bold" style={{ color: PALETTE.gender[1] }}>
                {genderMetrics.Female}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Male</span>
              <span className="font-bold" style={{ color: PALETTE.gender[0] }}>
                {genderMetrics.Male}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border rounded shadow-sm">
          <div className="text-sm text-slate-500 font-semibold">YoY Growth</div>
          <div className="text-3xl font-bold mt-2" style={{ color: yoyGrowth >= 0 ? "#27ae60" : "#e74c3c" }}>
            {yoyGrowth > 0 ? "+" : ""}{yoyGrowth}%
          </div>
          <div className="text-xs text-slate-500 mt-1">CY vs PY</div>
        </div>
      </div>

      {/* ===== SECTOR FILTER ===== */}
      <div className="p-4 bg-white border rounded shadow-sm">
        <label className="text-sm font-semibold text-slate-600 block mb-2">Filter by Sector</label>
        <select
          value={filters.sector || "All"}
          onChange={(e) => setFilters((p) => ({ ...p, sector: e.target.value }))}
          className="w-full border border-slate-300 p-2 rounded text-sm"
        >
          {data.sectors.map((s) => (
            <option key={s} value={s}>
              {shortSectorName(s)}
            </option>
          ))}
        </select>
      </div>

      {/* ===== DIMENSIONAL BREAKDOWN ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gender Breakdown */}
        <div className="bg-white p-4 border rounded shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Dimensional Breakdown: Gender</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderStackedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Male" stackId="a" fill={PALETTE.gender[0]} />
                <Bar dataKey="Female" stackId="a" fill={PALETTE.gender[1]} />
                <Bar dataKey="Other" stackId="a" fill={PALETTE.gender[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employment Status */}
        <div className="bg-white p-4 border rounded shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Employment Distribution</h3>
          <div className="space-y-3 mt-6">
            {employmentStatusData.map((item, idx) => (
              <div key={item.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{item.status}</span>
                  <span className="font-bold" style={{ color: PALETTE.status[idx] }}>
                    {item.value}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded h-6">
                  <div
                    className="h-6 rounded flex items-center justify-end pr-2"
                    style={{
                      width: `${item.value}%`,
                      backgroundColor: PALETTE.status[idx],
                      color: "white",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {item.count.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== YoY TRENDS ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CY vs PY Line Chart */}
        <div className="bg-white p-4 border rounded shadow-sm">
          <h3 className="text-sm font-semibold mb-3">YoY Trends: CY vs PY</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cyPyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val) => val.toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="CY" stroke={PALETTE.activeBlue} strokeWidth={2} dot={{ r: 3 }} name="Current Year" />
                <Line type="monotone" dataKey="PY" stroke={PALETTE.themes[3]} strokeWidth={2} dot={{ r: 3 }} name="Prior Year" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Company Comparison */}
        <div className="bg-white p-4 border rounded shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Select Companies for Detailed Comparison</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-slate-200 p-3 rounded">
              {availableCompanies.slice(0, 15).map((company) => (
                <label key={company} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(company)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCompanies([...selectedCompanies, company]);
                      } else {
                        setSelectedCompanies(selectedCompanies.filter((c) => c !== company));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="truncate text-xs">{company.slice(0, 20)}</span>
                </label>
              ))}
            </div>
            {availableCompanies.length > 15 && (
              <div className="text-xs text-slate-500">
                Showing first 15 companies (total: {availableCompanies.length})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== DATA QUALITY & INSIGHTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Key Metrics Available</h3>
          <div className="text-xs text-blue-800 space-y-1">
            <div>✓ {data.numericalCols.length} numerical metrics</div>
            <div>✓ Gender breakdown (Male/Female/Other)</div>
            <div>✓ Employment status (Permanent/Other)</div>
            <div>✓ Year-over-year comparison (CY/PY)</div>
            <div>✓ Sector-wise aggregations</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">📊 Data Completeness</h3>
          <div className="text-xs text-slate-600 space-y-1">
            <div>
              <span className="font-medium">Companies:</span> {filteredData.length} / {data.data.length}
            </div>
            <div>
              <span className="font-medium">Sectors:</span> {data.sectors.length - 1}
            </div>
            <div>
              <span className="font-medium">Available Metrics:</span> {data.numericalCols.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
