"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// --- SECTION B (Q5) DATA LOADER ---
async function loadQ5Data() {
  const generalResp = await fetch("/data/general.csv");
  const q5Resp = await fetch("/data/q5.csv");

  const generalText = await generalResp.text();
  const q5Text = await q5Resp.text();

  // Basic CSV parser
  const parseCSV = (text) => {
    const rows = text.split("\n").map((r) => r.split(","));
    const headers = rows.shift();
    return rows
      .filter((r) => r.length === headers.length)
      .map((r) =>
        Object.fromEntries(headers.map((h, i) => [h.trim(), r[i]?.trim()]))
      );
  };

  const generalDf = parseCSV(generalText);
  const q5Df = parseCSV(q5Text);

  // Market cap buckets
  const bucketCap = (nw) => {
    const v = parseFloat(nw);
    if (isNaN(v)) return "Unknown";
    if (v >= 20000) return "Large Cap";
    if (v >= 5000) return "Mid Cap";
    return "Small Cap";
  };

  // Lookup by doc_index
  const generalByIndex = Object.fromEntries(
    generalDf.map((row) => [row["Unnamed: 0"], row])
  );

  // Merge Q5 with generalDF
  const enrichedQ5 = q5Df.map((row) => {
    const ref = generalByIndex[row.doc_index];
    return {
      ...row,
      Company: ref?.NameOfTheCompany || "Unknown",
      Sector: ref?.Sector || "Unknown",
      NetWorth: ref?.NetWorth_DCYMain || null,
      CapBucket: bucketCap(ref?.NetWorth_DCYMain),
    };
  });

  // Dropdown lists
  const sectors = [
    "All",
    ...Array.from(new Set(generalDf.map((r) => r.Sector).filter(Boolean))),
  ];
  const companies = [
    "All",
    ...Array.from(
      new Set(generalDf.map((r) => r.NameOfTheCompany).filter(Boolean))
    ),
  ];
  const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

  return { generalDf, enrichedQ5, sectors, companies, capBuckets };
}

/**
 * DashboardPrototype.jsx
 *
 * - Sidebar: Data Overview, General Disclosures (Section A placeholder), Management & Process Disclosures (Section B)
 * - Narrower sidebar (256px), collapsible to width 0
 * - Always-hamburger (three lines) in header
 * - Active highlight color: #176fb3
 * - Principles list: when active, P-id turns blue; short label italic grey
 * - Section B: clicking a question opens a full-page Question view (not slide-over)
 * - Breadcrumb + Back button included on Question pages
 * - Long question text appears only in header (Option C)
 *
 * Place your logo at: /public/logo.png
 * Uploaded PDF path: /mnt/data/Annexure_II-Updated-BRSR_p.pdf
 */

const LOGO_PATH = "/logo.png";
const BRSR_PDF_PATH = "/mnt/data/Annexure_II-Updated-BRSR_p.pdf";

const PRINCIPLES = [
  {
    id: "P1",
    short: "Ethics & Transparency",
    name: "Businesses should conduct and govern themselves with integrity, and in a manner that is Ethical, Transparent and Accountable.",
  },
  {
    id: "P2",
    short: "Sustainable & Safe Goods",
    name: "Businesses should provide goods and services in a manner that is sustainable and safe.",
  },
  {
    id: "P3",
    short: "Employee Well-being",
    name: "Businesses should respect and promote the well-being of all employees, including those in their value chains.",
  },
  {
    id: "P4",
    short: "Stakeholder Engagement",
    name: "Businesses should respect the interests of and be responsive to all its stakeholders.",
  },
  {
    id: "P5",
    short: "Human Rights",
    name: "Businesses should respect and promote human rights.",
  },
  {
    id: "P6",
    short: "Environment Protection",
    name: "Businesses should respect and make efforts to protect and restore the environment.",
  },
  {
    id: "P7",
    short: "Public Policy",
    name: "Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent.",
  },
  {
    id: "P8",
    short: "Inclusive Growth",
    name: "Businesses should promote inclusive growth and equitable development.",
  },
  {
    id: "P9",
    short: "Customer Value",
    name: "Businesses should engage with and provide value to their consumers in a responsible manner.",
  },
];

const GD_QUESTIONS = [
  {
    id: "5",
    group: "Policy and management processes",
    title: "Specific commitments, goals and targets set by the entity with defined timelines, if any.",
  },
  {
    id: "6",
    group: "Policy and management processes",
    title: "Performance of the entity against the specific commitments, goals and targets along-with reasons in case the same are not met.",
  },
  {
    id: "7",
    group: "Governance, leadership and oversight",
    title: "Statement by director responsible for the business responsibility report, highlighting ESG related challenges, targets and achievements (listed entity has flexibility regarding the placement of this disclosure)",
  },
  {
    id: "8",
    group: "Governance, leadership and oversight",
    title: "Details of the highest authority responsible for implementation and oversight of the Business Responsibility policy(ies).",
  },
  {
    id: "9",
    group: "Governance, leadership and oversight",
    title: "Does the entity have a specified Committee of the Board/ Director responsible for decision making on sustainability related issues? If yes, provide details.",
  },
];

// small mock dataset to populate the question page
const mockResponses = [
  { company: "Acme Ltd", year: 2023, q: "5", text: "Commit to net-zero by 2040; interim target 2030." },
  { company: "BlueCorp", year: 2023, q: "5", text: "Target to reduce scope 1 & 2 emissions by 30% by 2028." },
  { company: "GreenWorks", year: 2022, q: "6", text: "Performance partially met due to supply chain delays." },
  { company: "Acme Ltd", year: 2023, q: "6", text: "Performance largely met; ramp-up delayed by supplier shutdowns." },
  { company: "BlueCorp", year: 2023, q: "7", text: "Director notes major progress on governance and next steps." },
  { company: "SunFoods", year: 2023, q: "7", text: "Director highlights supply-chain resilience and community programs." },
];

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

const SECTOR_NAME_FROM_SHORT = Object.fromEntries(
  Object.entries(SECTOR_SHORT_NAMES).map(([full, short]) => [short, full])
);

const PALETTE = {
  activeBlue: "#176fb3",
  orange: "#FFA500",
  ambition: ["#f6b26b", "#f79a4a", "#e76f51", "#c0392b"], // palette for ambition stacked bars
  themes: ["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806"],
};

function tokenCounts(texts) {
  const stop = new Set(["the", "and", "we", "our", "a", "in", "by", "for", "of", "to", "is", "are", "have", "has", "with", "no"]);
  const c = {};
  texts.forEach((t) => {
    t.split(/[^A-Za-z]+/).filter(Boolean).map((w) => w.toLowerCase()).forEach((w) => {
      if (w.length <= 2) return;
      if (stop.has(w)) return;
      c[w] = (c[w] || 0) + 1;
    });
  });
  return c;
}

function calculateThemeDistribution(filteredRows, currentSector) {
  const data = {};

  filteredRows.forEach((row) => {
    if (row.theme) {
      const themes = String(row.theme).split(",").map((t) => t.trim()).filter(Boolean);
      themes.forEach((theme) => {
        data[theme] = (data[theme] || 0) + 1;
      });
    }
  });

  return Object.entries(data)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function shortSectorName(name) {
  return SECTOR_SHORT_NAMES[name] || name;
}

function calculateSpecificityDistribution(filteredRows) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };

  filteredRows.forEach((row) => {
    let score = 0;
    if (row.metric && String(row.metric).trim()) score++;
    if (row.timeline && String(row.timeline).trim()) score++;
    if (row.goal && String(row.goal).trim()) score++;
    counts[score]++;
  });

  return Object.entries(counts).map(([score, count]) => ({
    score: `Score ${score}`,
    count: parseInt(count),
    fullScore: parseInt(score),
  }));
}

function calculateSectorThemeBreakdown(filteredRows) {
  const data = {};
  const sectorCounts = {};
  const themeCounts = {};

  filteredRows.forEach((row) => {
    if (row.theme && row.Sector) {
      const themeList = String(row.theme).split(",").map((t) => t.trim()).filter(Boolean);
      themeList.forEach((theme) => {
        const key = `${row.Sector}|${theme}`;
        data[key] = (data[key] || 0) + 1;
        sectorCounts[row.Sector] = (sectorCounts[row.Sector] || 0) + 1;
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      });
    }
  });

  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([s]) => s);

  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const matrixData = topSectors.map((sector) => {
    const row = {
      sector: shortSectorName(sector),
      originalSector: sector,
    };
    topThemes.forEach((theme) => {
      row[theme] = data[`${sector}|${theme}`] || 0;
    });
    return row;
  });

  return { matrixData, themes: topThemes, sectors: topSectors };
}

function calculateThemeKeywords(filteredRows, themeToAnalyze, n = 1) {
  const relevantRows = filteredRows.filter((row) =>
    row.theme && String(row.theme).includes(themeToAnalyze)
  );

  const words = {};
  const stops = new Set(["that", "this", "with", "from", "have", "been", "will", "work", "make", "said", "year", "and", "the", "for"]);

  relevantRows.forEach((row) => {
    const text = String(row.original_text || row.extraction_text || "").toLowerCase();
    const tokens = text.split(/\W+/).filter((w) => w.length > 2 && !stops.has(w));

    // Generate N-grams
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(" ");
      words[gram] = (words[gram] || 0) + 1;
    }
  });

  return Object.entries(words)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .reverse();
}

/**
 * New: calculate Ambition Matrix
 * categories:
 * - Metric + Timeline
 * - Metric only
 * - Timeline only
 * - Qualitative only
 *
 * Returns rows: [{ sector: shortName, originalSector, "Metric + Timeline": pct, ... }, ...]
 */
// ------------------------------
// Ambition Matrix Calculation
// ------------------------------
function calculateAmbitionMatrix(rows) {
  const matrix = {};

  rows.forEach((row) => {
    const fullSector = row.Sector || "Unknown";
    const sector = shortSectorName(fullSector);

    // Check if values exist and are not empty strings
    const metricValue = row.metric ? String(row.metric).trim() : "";
    const timelineValue = row.timeline ? String(row.timeline).trim() : "";
    const goalValue = row.goal ? String(row.goal).trim() : "";

    const hasMetric = metricValue !== "" && metricValue !== "null" && metricValue !== "undefined";
    const hasTimeline = timelineValue !== "" && timelineValue !== "null" && timelineValue !== "undefined";
    const hasGoal = goalValue !== "" && goalValue !== "null" && goalValue !== "undefined";

    let completeness;
    
    if (hasMetric && hasTimeline) {
      completeness = "Metric + Timeline";
    } else if (!hasMetric && hasTimeline) {
      completeness = "Timeline only";
    } else if (hasMetric && !hasTimeline) {
      completeness = "Metric only";
    } else if (hasGoal) {
      completeness = "Qualitative only";
    } else {
      completeness = "Empty";
    }

    if (!matrix[sector]) matrix[sector] = {};
    if (!matrix[sector][completeness]) matrix[sector][completeness] = 0;

    matrix[sector][completeness] += 1;
  });

  const categories = [
    "Metric + Timeline",
    "Metric only",
    "Timeline only",
    "Qualitative only",
    "Empty",
  ];

  const rowsOut = Object.entries(matrix).map(([sector, catObj]) => {
    const total = Object.values(catObj).reduce((a, b) => a + b, 0);
    const out = { sector };

    categories.forEach((c) => {
      out[c] = ((catObj[c] || 0) / total) * 100;
    });

    return out;
  });

  return { rows: rowsOut, categories };
}


export default function DashboardPrototype() {
  // UI state

  // ----------------------------
  // Load CSVs from /public
  // ----------------------------
  const [selected, setSelected] = useState("gd-b");
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedPrinciple, setSelectedPrinciple] = useState("P1");
  const [collapsed, setCollapsed] = useState(false);

  // Theme + layout sizing
  const activeBlue = PALETTE.activeBlue;
  const bannerColor = "#f1f6fb";
  const SIDEBAR_WIDTH = 256;
  const HEADER_HEIGHT = 72;

  const [q5Data, setQ5Data] = useState(null);
  const [sector, setSector] = useState("All");
  const [company, setCompany] = useState("All");
  const [capBucket, setCapBucket] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [ngramSize, setNgramSize] = useState(1);
  const [themeCompareMode, setThemeCompareMode] = useState("total");

  function bucketize(nw) {
    if (nw == null || nw === "") return "Unknown";
    if (nw < 5000) return "Small Cap";      // Less than ₹5,000 crore
    if (nw < 20000) return "Mid Cap";       // ₹5,000 to ₹20,000 crore
    return "Large Cap";                      // ₹20,000 crore and above
  }

  useEffect(() => {
    async function loadData() {
      try {
        const gRes = await fetch("/GeneralDisclosures_df.csv");
        const gText = await gRes.text();
        const gCsv = Papa.parse(gText, { header: true, skipEmptyLines: true, dynamicTyping: false });

        const qRes = await fetch("/GD_Q5.csv");
        const qText = await qRes.text();
        const qCsv = Papa.parse(qText, { header: true, skipEmptyLines: true, dynamicTyping: false });

        const generalDf = gCsv.data.filter((row) => row.NameOfTheCompany); // Remove empty rows
        const rawQ5 = qCsv.data.filter((row) => row.doc_index !== undefined); // Remove empty rows

        console.log("General DF:", generalDf.length, "rows");
        console.log("Q5 DF:", rawQ5.length, "rows");
        console.log("First General row:", generalDf[0]);
        console.log("First Q5 row:", rawQ5[0]);

        // THE FIX: Map by doc_index directly to array position
        // doc_index is a 0-based row number that corresponds to generalDf array index
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

        // Extract unique dropdown options
        const sectors = ["All", ...Array.from(new Set(enrichedQ5.map((r) => r.Sector).filter((s) => s !== "Unknown")))];
        const companies = ["All", ...Array.from(new Set(enrichedQ5.map((r) => r.Company).filter((c) => c !== "Unknown")))];
        const capBuckets = ["All", "Large Cap", "Mid Cap", "Small Cap", "Unknown"];

        setQ5Data({
          generalDf,
          enrichedQ5,
          sectors: sectors.sort(),
          companies: companies.sort(),
          capBuckets,
        });

        console.log("Merge success! Companies with Q5:", new Set(enrichedQ5.map((r) => r.Company)).size);
      } catch (error) {
        console.error("Data load error:", error);
      }
    }

    loadData();
  }, []);

  // ----------------------------
  // Filtering Logic
  // ----------------------------
  const filteredQ5Rows = useMemo(() => {
    if (!q5Data) return [];

    return q5Data.enrichedQ5.filter((row) => {
      const sectorMatch = sector === "All" || row.Sector === sector;
      const capMatch = capBucket === "All" || row.CapBucket === capBucket;

      return sectorMatch && capMatch;
    });
  }, [q5Data, sector, capBucket, search]);

  const filteredCompanies = useMemo(() => {
    if (!q5Data) return [];

    return q5Data.generalDf.filter((row) => {
      const sectorMatch = sector === "All" || row.Sector === sector;
      const capMatch =
        capBucket === "All" || (row.NetWorth_DCYMain && bucketize(parseFloat(row.NetWorth_DCYMain)) === capBucket);

      return sectorMatch && capMatch;
    });
  }, [q5Data, sector, capBucket]);

  // font injection (IBM Plex Sans)
  useEffect(() => {
    const id = "ibm-plex-sans-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600;700&display=swap";
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty(
      "--dashboard-font-family",
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial"
    );
  }, []);

  // responses for the currently selected question (for the full-page view)
  const responsesForQuestion = useMemo(() => {
    if (!selectedQuestion) return [];
    return mockResponses.filter((r) => r.q === selectedQuestion);
  }, [selectedQuestion]);

  // ----------------------------
  // Precomputed chart datasets (to avoid calling hooks inside JSX)
  // ----------------------------

  // 1. Theme distribution (all sectors or specific)
  const themeDist = useMemo(() => {
    return calculateThemeDistribution(filteredQ5Rows, sector);
  }, [filteredQ5Rows, sector]);

  // 1. b
  // Convert themeDist to Pie-friendly structure
  const themePieData = useMemo(() => {
    if (!themeDist || themeDist.length === 0) return [];
    return themeDist.map(t => ({
      theme: t.theme,
      count: t.count,
    }));
  }, [themeDist]);

  // 2. Specificity distribution (kept for logic but removed from UI)
  const specificityDist = useMemo(() => {
    return calculateSpecificityDistribution(filteredQ5Rows);
  }, [filteredQ5Rows]);

  // 3. Sector–theme breakdown matrix
  const sectorBreakdown = useMemo(() => {
    return calculateSectorThemeBreakdown(filteredQ5Rows);
  }, [filteredQ5Rows]);

  // 4. Determine top theme safely
  const topTheme = useMemo(() => {
    return themeDist.length > 0 ? themeDist[0].theme : "Theme";
  }, [themeDist]);

  // 5. Keywords for selected theme (or fallback to topTheme)
  const keywordDist = useMemo(() => {
    const theme = selectedTheme || topTheme;
    return calculateThemeKeywords(filteredQ5Rows, theme, ngramSize);
  }, [filteredQ5Rows, topTheme, selectedTheme, ngramSize]);

  // 6. All unique themes (for dropdown)
  const allThemes = useMemo(() => {
    const set = new Set();
    filteredQ5Rows.forEach((row) => {
      if (row.theme) {
        String(row.theme)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [filteredQ5Rows]);

  // 7. Cross-sector theme comparison dataset
  const crossSectorThemeData = useMemo(() => {
    if (!filteredQ5Rows.length) return { rows: [], topThemes: [] };

    // Count themes per sector
    const counts = {};

    filteredQ5Rows.forEach((row) => {
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
    const rows = Object.entries(counts).map(([sector, themeCounts]) => {
      const total = Object.values(themeCounts).reduce((a, b) => a + b, 0);

      const row = { sector };

      topThemes.forEach((t) => {
        const val = themeCounts[t] || 0;

        row[t] = themeCompareMode === "percentage" ? (val / total) * 100 : val;
      });

      return row;
    });

    return { rows, topThemes };
  }, [filteredQ5Rows, themeCompareMode]);

  // 8. Ambition matrix
  const ambitionMatrix = useMemo(() => {
    return calculateAmbitionMatrix(filteredQ5Rows);
  }, [filteredQ5Rows]);

  const sortedWords = useMemo(() => {
    const counts = tokenCounts(responsesForQuestion.map((r) => r.text));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  }, [responsesForQuestion]);

  // mock KPIs (totalCompanies now uses generalDf size if available)
  const totalCompanies = q5Data?.generalDf?.length ?? 247;
  const yearsCovered = 3;

  function navTo(item) {
    setSelected(item);
    if (item?.startsWith?.("P")) setSelectedPrinciple(item);
    setSelectedQuestion(null);
  }

  function goToQuestion(qid) {
    setSelectedQuestion(qid);
    // Keep selected as gd-b so the sidebar still shows the active section
    setSelected("gd-b");
    // scroll to top of main area
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToSectionB() {
    setSelectedQuestion(null);
    // ensure the Section B tab is selected
    setSelected("gd-b");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Question metadata helper
  function questionMeta(qid) {
    return GD_QUESTIONS.find((q) => q.id === qid) || null;
  }

  return (
    <div style={{ fontFamily: "var(--dashboard-font-family)" }} className="min-h-screen relative bg-slate-50 text-slate-800">
      {/* Fixed header */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center gap-4 px-4"
        style={{ height: HEADER_HEIGHT, background: "#ffffff", borderBottom: "1px solid rgba(226,232,240,0.9)" }}
      >
        {/* Hamburger */}
        <button
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center justify-center p-2 rounded hover:bg-slate-100 transition"
          style={{ width: 44, height: 44 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="6" width="18" height="2" rx="1" fill="#1f2937" />
            <rect x="3" y="11" width="18" height="2" rx="1" fill="#1f2937" />
            <rect x="3" y="16" width="18" height="2" rx="1" fill="#1f2937" />
          </svg>
        </button>

        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, position: "relative" }} className="rounded-md overflow-hidden bg-white">
            <Image src={LOGO_PATH} alt="logo" fill style={{ objectFit: "contain", padding: 4 }} />
          </div>

          <div>
            <div className="text-lg font-semibold text-slate-900">ESG Analytics Dashboard</div>
            <div className="text-xs text-slate-500 italic">Business Responsibility &amp; Sustainability Reporting</div>
          </div>
        </div>
      </header>

      {/* layout wrapper (padding for header) */}
      <div style={{ paddingTop: HEADER_HEIGHT }} className="flex transition-all duration-300 ease-in-out">
        {/* Sidebar */}
        <aside
          className="bg-white border-r border-slate-200 overflow-hidden"
          style={{
            width: collapsed ? 0 : SIDEBAR_WIDTH,
            transition: "width 300ms cubic-bezier(.2,.9,.2,1)",
          }}
        >
          <div className="h-full flex flex-col p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
            <div className={`transition-opacity duration-200 ease-in-out ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2 font-medium">Main</div>

                <nav className="mb-4">
                  <button
                    onClick={() => navTo("overview")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md ${selected === "overview" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "overview" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">Data Overview</span>
                  </button>

                  <button
                    onClick={() => navTo("gd-a")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md mt-1 ${selected === "gd-a" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "gd-a" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">General Disclosures (Section A)</span>
                  </button>

                  <button
                    onClick={() => navTo("gd-b")}
                    className={`w-full text-left py-2 pl-3 rounded-l-md mt-1 ${selected === "gd-b" ? "bg-slate-100 text-[#176fb3] font-semibold" : "hover:bg-slate-50"}`}
                    style={selected === "gd-b" ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                  >
                    <span className="text-[0.9rem]">Management &amp; Process Disclosures (Section B)</span>
                  </button>
                </nav>

                <div className="text-sm text-slate-500 mb-3 font-medium">Principles</div>
              </div>

              {/* Principles list */}
              <nav className="flex-1 overflow-auto pr-2">
                {PRINCIPLES.map((p) => {
                  const active = selected === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => navTo(p.id)}
                      className={`w-full text-left py-3 pl-3 pr-2 rounded-l-md mb-1 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      style={active ? { borderLeft: `4px solid ${activeBlue}` } : {}}
                    >
                      <div className="text-sm font-semibold flex items-center">
                        <span className={active ? "text-[#176fb3]" : "text-slate-800"}>{p.id}</span>
                        <span className="ml-2 text-sm font-medium text-slate-600 italic">– {p.short}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* main content area */}
        <main className="flex-1 min-h-[calc(100vh-72px)] overflow-auto transition-all duration-300 ease-in-out">
          {/* banner */}
          <div style={{ background: bannerColor }} className="p-6 border-b border-slate-200">
            {/* When a question is open, we show breadcrumb + back + title with long question text (Option C: long text only in header) */}
            {selectedQuestion ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button onClick={backToSectionB} className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-blue-20 text-[#176fb3] border border-blue-200 hover:bg-blue-100 transition text-sm">← Back</button>
                    <div className="text-sm text-slate-500">Management &amp; Process Disclosures › Q{selectedQuestion}</div>
                  </div>
                </div>

                <h1 className="text-xl font-bold text-slate-900">{`Q${selectedQuestion} — ${questionMeta(selectedQuestion)?.title || ""}`}</h1>
              </>
            ) : (
              <>
                {selected.startsWith("P") ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">{selectedPrinciple} — {PRINCIPLES.find((x) => x.id === selectedPrinciple)?.name}</h1>
                    <div className="text-sm text-slate-600 mt-1">Explore quantitative and qualitative disclosures</div>
                  </>
                ) : selected === "gd-b" ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">Management &amp; Process Disclosures (Section B)</h1>
                    <div className="text-sm text-slate-600 mt-1">Questions 5–9: commitments, performance, director's statement, oversight, committee</div>
                  </>
                ) : selected === "gd-a" ? (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">General Disclosures (Section A)</h1>
                    <div className="text-sm text-slate-600 mt-1">Placeholder: core company info, operations, products and CSR. (Fill later.)</div>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-slate-900">Data Overview</h1>
                    <div className="text-sm text-slate-600 mt-1">Dataset summary & global KPIs</div>
                  </>
                )}
              </>
            )}
          </div>

          {/* page body */}
          <div className="p-6">
            {/* If a question is selected: render the full QuestionPage here */}
            {selectedQuestion ? (
              <div className="space-y-8">
                {/* KPI Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded shadow-sm border text-center">
                    <div className="text-sm text-slate-500">Total companies</div>
                    <div className="text-2xl font-semibold">{q5Data?.generalDf.length ?? "-"}</div>
                  </div>

                  <div className="p-4 bg-white rounded shadow-sm border text-center">
                    <div className="text-sm text-slate-500">Responses received</div>
                    <div className="text-2xl font-semibold">
                      {q5Data ? new Set(q5Data.enrichedQ5.filter((r) => r.Company !== "Unknown").map((r) => r.Company)).size : "-"}
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-white border rounded shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Sector */}
                    <div>
                      <div className="text-sm mb-1 text-slate-600">Sector</div>
                      <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full border p-2 rounded">
                        {q5Data?.sectors.map((s) => (
                          <option key={s} value={s}>{shortSectorName(s)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Market cap */}
                    <div>
                      <div className="text-sm mb-1 text-slate-600">Market cap</div>
                      <select value={capBucket} onChange={(e) => setCapBucket(e.target.value)} className="w-full border p-2 rounded">
                        {q5Data?.capBuckets.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-sm text-slate-500">
                    {filteredCompanies.length} companies match the filters!
                  </div>
                </div>

                {/* Charts Section: New 2-column layout (Pie left, Ambition right) */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
                    <h3 className="text-sm font-semibold mb-3">Theme Distribution</h3>
                    <div style={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie
                          data={themePieData}
                          dataKey="count"
                          nameKey="theme"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {themePieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={["#2b83ba", "#abdda4", "#fdae61", "#d7191c", "#b35806",
                                    "#1f78b4", "#33a02c", "#fb9a99", "#e31a1c", "#b2df8a",
                                    "#a6cee3", "#cab2d6"][index % 12]}
                            />
                          ))}
                        </Pie>
                          <Tooltip />
                          <Legend layout="vertical" verticalAlign="middle" align="right" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-6 bg-white border rounded shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Ambition Matrix (Completeness by Sector)</h3>
                      <div className="text-xs text-slate-500 italic">Normalized by sector</div>
                    </div>

                    <div style={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ambitionMatrix.rows}>
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
                          {/* stacked bars in consistent order */}
                          <Bar dataKey="Metric + Timeline" stackId="a" fill={PALETTE.ambition[0]} />
                          <Bar dataKey="Metric only" stackId="a" fill={PALETTE.ambition[1]} />
                          <Bar dataKey="Timeline only" stackId="a" fill={PALETTE.ambition[2]} />
                          <Bar dataKey="Qualitative only" stackId="a" fill={PALETTE.ambition[3]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cross-sector comparison retained below */}
                <div className="bg-white border rounded shadow-sm p-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Cross-sector comparison of top themes ({themeCompareMode})</h3>

                    <select value={themeCompareMode} onChange={(e) => setThemeCompareMode(e.target.value)} className="border p-1.5 rounded text-sm">
                      <option value="total">Total</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>

                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={crossSectorThemeData.rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="sector" tickFormatter={(value) => shortSectorName(value)} angle={-45} textAnchor="end" height={150} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {crossSectorThemeData.topThemes.map((theme, idx) => (
                        <Bar key={theme} dataKey={theme} fill={PALETTE.themes[idx % PALETTE.themes.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Keywords by Theme (kept) */}
                <div className="flex items-center justify-between mb-4 mt-4">
                  <h3 className="text-sm font-semibold">Top keywords/terms in "{selectedTheme || topTheme}" theme</h3>

                  <div className="flex items-center gap-3">
                    {/* N-gram selector */}
                    <select value={ngramSize} onChange={(e) => setNgramSize(Number(e.target.value))} className="border p-1.5 rounded text-sm">
                      <option value={1}>1-gram</option>
                      <option value={2}>2-gram</option>
                      <option value={3}>3-gram</option>
                    </select>

                    {/* Theme selector dropdown */}
                    <select value={selectedTheme || ""} onChange={(e) => setSelectedTheme(e.target.value || null)} className="border p-1.5 rounded text-sm">
                      <option value="">(Top Theme)</option>
                      {allThemes.map((theme) => (
                        <option key={theme} value={theme}>
                          {theme}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={keywordDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="word" type="category" width={150} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill={PALETTE.orange} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Company filter & table (unchanged) */}
                <div className="bg-white border rounded shadow-sm p-4 mb-4 mt-6">
                  <div className="text-sm font-semibold mb-2">Filter by Company</div>

                  <details className="border p-2 rounded bg-slate-50">
                    <summary className="cursor-pointer text-sm text-slate-700">{`Selected Companies: ${selectedCompanies.length === 0 ? "All" : selectedCompanies.length}`}</summary>

                    <div className="mt-3 max-h-60 overflow-auto space-y-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedCompanies([]);
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border"
                        style={{
                          color: activeBlue,
                          borderColor: activeBlue,
                          background: "#ffffff",
                        }}
                      >
                        Clear all
                      </button>

                      <div className="space-y-1">
                        {q5Data?.companies.filter((c) => c !== "All").map((companyName) => (
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
                      </div>
                    </div>
                  </details>
                </div>

                <div className="bg-white border rounded shadow-sm p-4">
                  <div className="text-sm font-semibold mb-3">Company-level responses (filtered)</div>
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-3 text-xs text-left text-slate-500">Company</th>
                        <th className="p-3 text-xs text-left text-slate-500">Sector</th>
                        <th className="p-3 text-xs text-left text-slate-500">Cap bucket</th>
                        <th className="p-3 text-xs text-left text-slate-500">Response</th>
                      </tr>
                    </thead>

                    <tbody>
                      {Array.from(
                        filteredQ5Rows
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
                          <td className="p-3 text-sm">{r.original_text || r.extraction_text || r.text || "N/A"}</td>
                        </tr>
                      ))}

                      {Array.from(
                        filteredQ5Rows
                          .filter((r) => selectedCompanies.length === 0 || selectedCompanies.includes(r.Company))
                          .reduce((map, row) => {
                            if (!map.has(row.Company)) map.set(row.Company, row);
                            return map;
                          }, new Map())
                          .values()
                      ).length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-sm text-slate-400 text-center">
                            No companies match current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                {/* Not in a question page: render the normal selected page view */}
                {selected === "overview" && (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm text-slate-500">Companies</div>
                        <div className="text-2xl font-semibold">{totalCompanies}</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm text-slate-500">Years</div>
                        <div className="text-2xl font-semibold">{yearsCovered}</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm text-slate-500">Responses</div>
                        <div className="text-2xl font-semibold">{mockResponses.length}</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm text-slate-500">Sectors</div>
                        <div className="text-2xl font-semibold">5</div>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500 mb-2">Overview charts</div>
                      <div className="h-48 border border-dashed border-slate-100 rounded flex items-center justify-center text-slate-400">Charts placeholder</div>
                    </div>
                  </>
                )}

                {selected === "gd-a" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-700 font-semibold mb-2">Section A — General Disclosures (placeholder)</div>
                      <div className="text-sm text-slate-600">This page is intentionally left as a structural placeholder. We'll add the A1–A7 items from the BRSR PDF here when you're ready.</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm font-semibold mb-2">A.1 Corporate Information</div>
                        <div className="text-sm text-slate-600">Company name, CIN, paid-up capital, registered office (to be filled).</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm font-semibold mb-2">A.2 Products &amp; Services</div>
                        <div className="text-sm text-slate-600">Primary NIC codes, product segments, and major services (to be filled).</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm font-semibold mb-2">A.3 Operations &amp; Markets</div>
                        <div className="text-sm text-slate-600">Locations, markets served, presence (to be filled).</div>
                      </div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                        <div className="text-sm font-semibold mb-2">A.4 Employees &amp; Diversity</div>
                        <div className="text-sm text-slate-600">Workforce counts, gender diversity, contract types (to be filled).</div>
                      </div>
                    </div>
                  </div>
                )}

                {selected === "gd-b" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 mb-3">Policy and management processes</h2>
                      <div className="space-y-3">
                        {GD_QUESTIONS.filter((q) => q.group === "Policy and management processes").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition"
                            style={{ background: "#ffffff", border: "1px solid transparent" }}
                          >
                            <div className="text-sm text-slate-800 leading-snug">{`${q.id}. ${q.title}`}</div>
                            <div className="text-slate-400 text-lg">›</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-slate-700 mb-3">Governance, leadership and oversight</h2>
                      <div className="space-y-3">
                        {GD_QUESTIONS.filter((q) => q.group === "Governance, leadership and oversight").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-4 cursor-pointer flex items-center justify-between hover:shadow-md hover:bg-slate-50 transition"
                            style={{ background: "#ffffff", border: "1px solid transparent" }}
                          >
                            <div className="text-sm text-slate-800 leading-snug">{`${q.id}. ${q.title}`}</div>
                            <div className="text-slate-400 text-lg">›</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selected.startsWith("P") && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded shadow-sm border border-slate-100">
                      <div className="text-sm text-slate-500 mb-2">Summary</div>
                      <div className="text-lg font-semibold">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.short}</div>
                      <div className="text-sm text-slate-600 mt-1">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">Quantitative placeholders</div>
                      <div className="p-4 bg-white rounded shadow-sm border border-slate-100">Qualitative placeholders</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


