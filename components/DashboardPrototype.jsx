"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// NOTE: handlers are expected at ./handlers/Q5Handler.js etc.
// Each handler should export:
//  - async function loadData(opts) { return dataObject; }
//  - React component QuestionPage({ data, filters, onBack, onGoToQuestion, handlersRegistry })
//
// Example:
// export async function loadData() { ... }
// export function QuestionPage(props) { return <div>...</div> }

import * as Q5Handler from "./questionHandlers/Q5Handler";
import * as Q6Handler from "./questionHandlers/Q6Handler";
import * as P1Handler from "./principleHandlers/P1Handler";
import * as P2Handler from "./principleHandlers/P2Handler";
import * as P3Handler from "./principleHandlers/P3Handler";
import * as P4Handler from "./principleHandlers/P4Handler";
import * as P5Handler from "./principleHandlers/P5Handler";
import * as P6Handler from "./principleHandlers/P6Handler";
import * as P7Handler from "./principleHandlers/P7Handler";
import * as P8Handler from "./principleHandlers/P8Handler";
import * as P9Handler from "./principleHandlers/P9Handler";

import * as P5Q5Handler from "./questionHandlers/P5Q5Handler";
import * as P5Q8Handler from "./questionHandlers/P5Q8Handler";
import * as P5Q1Handler from "./questionHandlers/P5Q1Handler";
import * as P5Q2Handler from "./questionHandlers/P5Q2Handler";
import * as P3QuantHandler from "./questionHandlers/P3QuantHandler";
import * as P3QuantTrialHandler from "./questionHandlers/P3QuantTrialHandler";
import * as P5QuantHandler from "./questionHandlers/P5QuantHandler";
import * as P8QuantHandler from "./questionHandlers/P8QuantHandler";
import * as P9QuantHandler from "./questionHandlers/P9QuantHandler";
import * as PrincipleSRSHandler from "./questionHandlers/PrincipleSRSHandler";
import * as OverallSRSHandler from "./questionHandlers/OverallSRSHandler";
// Build a registry mapping qids -> handler module
const HANDLERS = {
  "5": Q5Handler,
  // add others as you implement them:
  "6": Q6Handler,
  // "7": Q7Handler,
  // ...
  "P1": P1Handler,
  "P2": P2Handler,
  "P3": P3Handler,
  "P4": P4Handler,
  "P5": P5Handler,
  "P6": P6Handler,
  "P7": P7Handler,
  "P8": P8Handler,
  "P9": P9Handler,
  "P5_Q5": P5Q5Handler,
  "P5_Q8": P5Q8Handler,
  "P5_Q1": P5Q1Handler,
  "P5_Q2": P5Q2Handler,
  "P3_Quant": P3QuantHandler,
  "P5_Quant": P5QuantHandler,
  "P8_Quant": P8QuantHandler,
  "P9_Quant": P9QuantHandler,
  "P3_Quant_Trial": P3QuantTrialHandler,
  "P3_SRS": PrincipleSRSHandler,
  "P5_SRS": PrincipleSRSHandler,
  "P8_SRS": PrincipleSRSHandler,
  "P9_SRS": PrincipleSRSHandler,
  "Overall_SRS": OverallSRSHandler,
};

const LOGO_PATH = "/logo.png";
const HEADER_HEIGHT = 58;
const SIDEBAR_WIDTH = 260;
const PALETTE = {
  activeBlue: "#176fb3",
  activeBlueLight: "#e8f2fb",
  border: "#e2e8f0",
  bg: "#f7f8fb",
  text1: "#1a2333",
  text2: "#64748b",
  text3: "#94a3b8",
};

const PRINCIPLE_NAV = [
  { id: "P3", short: "Workforce" },
  { id: "P5", short: "Human Rights" },
  { id: "P8", short: "Social Impact" },
  { id: "P9", short: "Consumer" },
];

const KPI_CHIPS = {
  P3: ["Benefit Coverage", "Worker Gap", "Wellbeing Spend", "Safety (LTIFR)", "Training", "Career Dev"],
  P5: ["HR Policy", "Complaints", "Child Labour", "Wages", "Training", "Grievances"],
  P8: ["CSR Spend", "Projects", "Beneficiaries", "Procurement %", "Local Hiring", "Social Audit"],
  P9: ["Complaints", "Resolution %", "Cybersecurity", "Product Safety", "NPS", "Recalls"],
};

const SRS_METRICS = [
  { key: "SS", name: "Specificity Score", desc: "Placeholder description for specificity score." },
  { key: "AS", name: "Actionability Score", desc: "Placeholder description for actionability score." },
  { key: "CCS", name: "Compliance Coverage Score", desc: "Placeholder description for compliance coverage score." },
  { key: "OES", name: "Outcome Evidence Score", desc: "Placeholder description for outcome evidence score." },
  { key: "RTS", name: "Risk Tone Score", desc: "Placeholder description for risk tone score." },
  { key: "TOS", name: "Text Outcome Score", desc: "Placeholder description for text outcome score." },
];

const PRINCIPLES = [
  { id: "P1", short: "Ethics & Transparency", name: "Businesses should conduct and govern themselves with integrity, and in a manner that is Ethical, Transparent and Accountable." },
  { id: "P2", short: "Sustainable & Safe Goods", name: "Businesses should provide goods and services in a manner that is sustainable and safe." },
  { id: "P3", short: "Employee Well-being", name: "Businesses should respect and promote the well-being of all employees, including those in their value chains." },
  { id: "P4", short: "Stakeholder Engagement", name: "Businesses should respect the interests of and be responsive to all its stakeholders." },
  { id: "P5", short: "Human Rights", name: "Businesses should respect and promote human rights." },
  { id: "P6", short: "Environment Protection", name: "Businesses should respect and make efforts to protect and restore the environment." },
  { id: "P7", short: "Public Policy", name: "Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent." },
  { id: "P8", short: "Inclusive Growth", name: "Businesses should promote inclusive growth and equitable development." },
  { id: "P9", short: "Customer Value", name: "Businesses should engage with and provide value to their consumers in a responsible manner." },
];

const GD_QUESTIONS = [
  { id: "5", group: "Policy and management processes", title: "Specific commitments, goals and targets set by the entity with defined timelines, if any." },
  { id: "6", group: "Policy and management processes", title: "Performance of the entity against the specific commitments, goals and targets along-with reasons in case the same are not met." },
  { id: "7", group: "Governance, leadership and oversight", title: "Statement by director responsible for the business responsibility report, highlighting ESG related challenges, targets and achievements (listed entity has flexibility regarding the placement of this disclosure)" },
  { id: "8", group: "Governance, leadership and oversight", title: "Details of the highest authority responsible for implementation and oversight of the Business Responsibility policy(ies)." },
  { id: "9", group: "Governance, leadership and oversight", title: "Does the entity have a specified Committee of the Board/ Director responsible for decision making on sustainability related issues? If yes, provide details." },
];

export default function DashboardPrototype() {
  // Shell UI state
  const [selected, setSelected] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedPrinciple, setSelectedPrinciple] = useState("P1");
  const [expandedP, setExpandedP] = useState("P3");
  const [activeTopTab, setActiveTopTab] = useState("Quant KPIs");
  const [viewModeUi, setViewModeUi] = useState("Sector");
  const [sectorUi, setSectorUi] = useState("All Sectors");
  const [srsCompanyUi, setSrsCompanyUi] = useState("");
  const [srsYearUi, setSrsYearUi] = useState("FY2023-24");
  const [srsMetricUi, setSrsMetricUi] = useState(["SS", "AS", "CCS", "OES", "RTS", "TOS"]);
  const [activeKpiUi, setActiveKpiUi] = useState([]);

  // QUESTION handler state
  const [selectedQuestion, setSelectedQuestion] = useState(null); // "5", "6", ...
  const [handlerData, setHandlerData] = useState(null);
  const [handlerLoading, setHandlerLoading] = useState(false);
  const [handlerError, setHandlerError] = useState(null);

  // Common "filters" object passed to handlers (you can extend)
  const [filters, setFilters] = useState({
    sector: "All",
    capBucket: "All",
    ngramSize: 1,
    selectedCompanies: [],
    selectedTheme: null,
    themeCompareMode: "total",
    search: "",
  });

  // Font injection (keeps your previous font logic)
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

  // When selectedQuestion changes, load data from its handler
  useEffect(() => {
    if (!selectedQuestion) {
      setHandlerData(null);
      setHandlerError(null);
      setHandlerLoading(false);
      return;
    }

    const handler = HANDLERS[selectedQuestion];
    if (!handler || typeof handler.loadData !== "function") {
      setHandlerData(null);
      setHandlerError(`No handler implemented for question ${selectedQuestion}`);
      setHandlerLoading(false);
      return;
    }

    let cancelled = false;
    setHandlerLoading(true);
    setHandlerError(null);
    setHandlerData(null);

    (async () => {
      try {
        // Allow handler to accept options if it needs (paths etc.)
        const loadOptions = {
          generalCsvPath: "/GeneralDisclosures_df.csv",
          questionCsvPath: `/${selectedQuestion}.csv`,
        };

        if (selectedQuestion === "Overall_SRS") {
          loadOptions.isOverallSRS = true;
          loadOptions.reportYear = srsYearUi;
          loadOptions.globalRankingPath = "/global_ranking_2024.csv";
          loadOptions.sectorSummaryPath = "/sector_summary_2024.csv";
        } else if (typeof selectedQuestion === "string" && selectedQuestion.endsWith("_SRS")) {
          const principleId = selectedQuestion.split("_")[0];
          loadOptions.principleId = principleId;
          loadOptions.reportYear = srsYearUi;
          loadOptions.scoresCsvPath = `/scores_${principleId.toLowerCase()}_2024.csv`;
          loadOptions.globalRankingPath = "/global_ranking_2024.csv";
          loadOptions.sectorSummaryPath = "/sector_summary_2024.csv";
        }

        const data = await handler.loadData(loadOptions);
        if (!cancelled) {
          setHandlerData(data || {});
          setHandlerLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Handler load error:", err);
          setHandlerError(err?.message || String(err));
          setHandlerLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQuestion, srsYearUi]);

  function navTo(item) {
    setSelected(item);
    if (item?.startsWith?.("P")) setSelectedPrinciple(item);
    setSelectedQuestion(null);
    if (item?.startsWith?.("P")) setExpandedP(item);
  }

  function goToQuestion(qid) {
    setSelectedQuestion(qid);
    setSelected("gd-b");
    if (typeof qid === "string" && qid.endsWith("_Quant")) {
      const pid = qid.split("_")[0];
      setSelectedPrinciple(pid);
      setExpandedP(pid);
      setActiveTopTab("Quant KPIs");
      setViewModeUi("Sector");
      setSectorUi("All Sectors");
      // Let the quant handler default to all KPIs for that principle,
      // so the first view is composite-by-sector.
      setActiveKpiUi([]);
    } else if (typeof qid === "string" && qid.endsWith("_SRS")) {
      const pid = qid.split("_")[0];
      setSelectedPrinciple(pid);
      setExpandedP(pid);
      setActiveTopTab("SRS");
    }
    // reset handler states; loader will run via useEffect
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToSectionB() {
    if (selectedQuestion?.startsWith("P")) {
      const base = selectedQuestion.split("_")[0];
      setSelectedQuestion(null);
      navTo(base);
    } else {
      setSelectedQuestion(null);
      setSelected("gd-b");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // UI helpers
  const activeBlue = PALETTE.activeBlue;
  const bannerColor = "#eef3f9";

  const HandlerComp =
    selectedQuestion &&
    HANDLERS[selectedQuestion] &&
    HANDLERS[selectedQuestion].QuestionPage
      ? HANDLERS[selectedQuestion].QuestionPage
      : null;

  const activePrincipleId = useMemo(() => {
    if (selectedQuestion?.startsWith("P")) {
      return selectedQuestion.split("_")[0];
    }
    if (selected?.startsWith("P")) {
      return selected;
    }
    return null;
  }, [selected, selectedQuestion]);

  const isPrincipleView = Boolean(activePrincipleId && PRINCIPLE_NAV.some((p) => p.id === activePrincipleId));

  const principleBannerInfo = PRINCIPLES.find((p) => p.id === activePrincipleId);

  const selectedQuestionIsSRS = Boolean(selectedQuestion && String(selectedQuestion).endsWith("_SRS"));

  const dynamicSectorOptions = useMemo(() => {
    const sectors = handlerData?.sectors;
    if (Array.isArray(sectors) && sectors.length) {
      return sectors;
    }
    return ["All Sectors", "Manufacturing", "Finance", "IT & Comms", "Energy", "Construction", "Trade", "Other"];
  }, [handlerData]);

  function toggleKpiUi(chip) {
    setActiveKpiUi((prev) => {
      if (prev.includes(chip)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== chip);
      }
      return [...prev, chip];
    });
  }

  function resetControlZoneUi() {
    setViewModeUi("Sector");
    setSectorUi("All Sectors");
    setSrsCompanyUi("");
    setSrsYearUi("FY2023-24");
    setSrsMetricUi(["SS", "AS", "CCS", "OES", "RTS", "TOS"]);
    setActiveKpiUi([]);
    setFilters({
      sector: "All",
      capBucket: "All",
      ngramSize: 1,
      selectedCompanies: [],
      selectedTheme: null,
      themeCompareMode: "total",
      search: "",
    });
  }

  const srsRows = useMemo(() => {
    if (!selectedQuestionIsSRS || !handlerData?.rows?.length) return [];
    return handlerData.rows.filter((row) => {
      if (sectorUi && sectorUi !== "All Sectors" && row.Sector !== sectorUi) return false;
      return true;
    });
  }, [handlerData, sectorUi, selectedQuestionIsSRS]);

  const srsCompanyOptions = useMemo(() => {
    return srsRows.map((row) => row.Company).filter(Boolean);
  }, [srsRows]);

  useEffect(() => {
    if (!selectedQuestionIsSRS) return;
    if (!srsRows.length) {
      setSrsCompanyUi("");
      return;
    }
    if (!srsCompanyUi || !srsRows.some((row) => row.Company === srsCompanyUi)) {
      setSrsCompanyUi(srsRows[0].Company || "");
    }
  }, [srsRows, srsCompanyUi, selectedQuestionIsSRS]);

  function selectPrincipleQuant(pid) {
    setExpandedP(pid);
    setActiveTopTab("Quant KPIs");
    const quantQid = `${pid}_Quant`;
    if (HANDLERS[quantQid]) {
      goToQuestion(quantQid);
      return;
    }
    navTo(pid);
  }

  function renderStatCard(label, value, sub, color) {
    return (
      <div
        className="bg-white border rounded-lg"
        style={{ borderColor: PALETTE.border, padding: "18px 22px" }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: PALETTE.text3 }}>
          {label}
        </div>
        <div className="mt-1 text-[26px] font-bold leading-tight" style={{ color: color || activeBlue }}>
          {value}
        </div>
        <div className="text-xs mt-1" style={{ color: PALETTE.text3 }}>
          {sub}
        </div>
      </div>
    );
  }

  function renderPlaceholderPanel(title, height, note) {
    return (
      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: PALETTE.border, minHeight: height }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: PALETTE.border }}>
          <span className="text-[13px] font-semibold" style={{ color: PALETTE.text1 }}>{title}</span>
          {note ? (
            <span className="text-[11px] px-2 py-[2px] rounded-full border" style={{ color: PALETTE.text3, borderColor: PALETTE.border, background: "#f8fafc" }}>
              {note}
            </span>
          ) : null}
        </div>
        <div className="h-full min-h-[120px] flex items-center justify-center" style={{ color: PALETTE.text3 }}>
          <span className="text-xs tracking-[0.05em] uppercase">Chart Placeholder</span>
        </div>
      </div>
    );
  }


  return (
    <div style={{ fontFamily: "var(--dashboard-font-family)", background: PALETTE.bg }} className="min-h-screen relative text-slate-800">
      {/* Header */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center gap-3 px-5"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          zIndex: 50,
          height: HEADER_HEIGHT,
          background: "#ffffff",
          borderBottom: `1px solid ${PALETTE.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <button
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center justify-center rounded hover:bg-slate-100 transition"
          style={{ width: 34, height: 34, color: PALETTE.text2 }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
            <rect y="0" width="18" height="2" rx="1" fill="currentColor" />
            <rect y="6" width="18" height="2" rx="1" fill="currentColor" />
            <rect y="12" width="18" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        <div style={{ width: 1, height: 26, background: PALETTE.border }} />

        <div className="flex items-center gap-3">
          <div style={{ width: 30, height: 30, position: "relative", background: PALETTE.activeBlueLight }} className="rounded-md overflow-hidden">
            <Image src={LOGO_PATH} alt="logo" fill style={{ objectFit: "contain", padding: 3 }} />
          </div>

          <div>
            <div className="text-[14px] font-bold" style={{ color: PALETTE.text1 }}>BRSR Social Analytics</div>
            <div className="text-[10.5px] italic" style={{ color: PALETTE.text3 }}>Business Responsibility &amp; Sustainability Reporting</div>
          </div>
        </div>

        <div className="flex-1" />
        {selectedQuestionIsSRS && (
          <>
            <select
              value={srsYearUi}
              onChange={(e) => setSrsYearUi(e.target.value)}
              className="text-[11.5px] px-3 py-1 rounded-md bg-white"
              style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text2 }}
            >
              <option value="FY2021-22">FY2021-22</option>
              <option value="FY2022-23">FY2022-23</option>
              <option value="FY2023-24">FY2023-24</option>
            </select>
            <div style={{ width: 1, height: 26, background: PALETTE.border }} />
          </>
        )}
        <div className="text-[11.5px] px-3 py-1 rounded-full border" style={{ color: PALETTE.text2, background: "#f8fafc", borderColor: PALETTE.border }}>NSE/BSE</div>
      </header>

      {/* layout - with fixed sidebar and main */}
      <div style={{ paddingTop: HEADER_HEIGHT, position: "relative" }} className="w-full min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out">
        {/* Sidebar - Fixed Position */}
        <aside
          className="fixed bg-white border-r overflow-y-auto z-40"
          style={{
            position: "fixed",
            left: 0,
            top: HEADER_HEIGHT,
            width: collapsed ? 0 : SIDEBAR_WIDTH,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
            transition: "width 300ms cubic-bezier(.2,.9,.2,1)",
            borderColor: PALETTE.border,
            background: "#ffffff",
            overflowY: "auto",
            borderRight: `1px solid ${PALETTE.border}`,
            zIndex: 40,
          }}
        >
          <div className={`transition-opacity duration-200 ease-in-out ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className="p-[18px] pb-5" style={{ width: SIDEBAR_WIDTH }}>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] pl-[14px] mb-[6px]" style={{ color: PALETTE.text3 }}>Main</div>

                <nav className="mb-5">
                  <button
                    onClick={() => navTo("overview")}
                    className="w-full text-left rounded-md px-3 py-[8px] text-[13.5px] transition"
                    style={{
                      color: selected === "overview" ? activeBlue : PALETTE.text1,
                      background: selected === "overview" ? PALETTE.activeBlueLight : "transparent",
                      borderLeft: `3px solid ${selected === "overview" ? activeBlue : "transparent"}`,
                      fontWeight: selected === "overview" ? 600 : 400,
                    }}
                  >
                    About This Project
                  </button>

                  <button
                    onClick={() => navTo("gd-a")}
                    className="w-full text-left rounded-md px-3 py-[8px] text-[13.5px] mt-[2px] transition"
                    style={{
                      color: selected === "gd-a" ? activeBlue : PALETTE.text1,
                      background: selected === "gd-a" ? PALETTE.activeBlueLight : "transparent",
                      borderLeft: `3px solid ${selected === "gd-a" ? activeBlue : "transparent"}`,
                      fontWeight: selected === "gd-a" ? 600 : 400,
                    }}
                  >
                    General Disclosures (Section A)
                  </button>

                  <button
                    onClick={() => navTo("gd-b")}
                    className="w-full text-left rounded-md px-3 py-[8px] text-[13.5px] mt-[2px] transition"
                    style={{
                      color: selected === "gd-b" && !selectedQuestion ? activeBlue : PALETTE.text1,
                      background: selected === "gd-b" && !selectedQuestion ? PALETTE.activeBlueLight : "transparent",
                      borderLeft: `3px solid ${selected === "gd-b" && !selectedQuestion ? activeBlue : "transparent"}`,
                      fontWeight: selected === "gd-b" && !selectedQuestion ? 600 : 400,
                    }}
                  >
                    Management &amp; Process Disclosures (Section B)
                  </button>
                </nav>

                <div style={{ height: 1, background: PALETTE.border, marginBottom: 18 }} />
                <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] pl-[14px] mb-[6px]" style={{ color: PALETTE.text3 }}>Principles</div>

                <nav className="flex flex-col gap-[1px]">
                  {PRINCIPLE_NAV.map((p) => {
                    const isExp = expandedP === p.id;
                    const isActive = activePrincipleId === p.id;
                  return (
                      <div key={p.id}>
                        <button
                          onClick={() => {
                            if (isExp) {
                              setExpandedP(null);
                            } else {
                              setExpandedP(p.id);
                              selectPrincipleQuant(p.id);
                            }
                          }}
                          className="w-full text-left rounded-md px-3 py-[9px] flex items-center justify-between"
                          style={{
                            color: isActive ? activeBlue : PALETTE.text1,
                            background: isActive && !isExp ? PALETTE.activeBlueLight : "transparent",
                            borderLeft: `3px solid ${isActive && !isExp ? activeBlue : "transparent"}`,
                            fontWeight: isActive || isExp ? 600 : 400,
                          }}
                        >
                          <span>
                            <span style={{ color: isActive ? activeBlue : "#475569", fontWeight: 700 }}>{p.id}</span>
                            <span className="ml-[5px] text-[13px]" style={{ color: isActive ? activeBlue : PALETTE.text2 }}>- {p.short}</span>
                          </span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            style={{ transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: PALETTE.text3 }}
                          >
                            <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                          </svg>
                        </button>

                        {isExp ? (
                          <div className="pt-[2px] pb-1">
                            {[
                              { tab: "Quant KPIs", disabled: false },
                              { tab: "SRS", disabled: false },
                              { tab: "Combined", disabled: true },
                            ].map((sub) => {
                              const subActive = isActive && activeTopTab === sub.tab;
                              return (
                                <button
                                  key={`${p.id}-${sub.tab}`}
                                  onClick={() => {
                                    if (sub.disabled) return;
                                    setActiveTopTab(sub.tab);
                                    if (sub.tab === "SRS") {
                                      goToQuestion(`${p.id}_SRS`);
                                    } else {
                                      selectPrincipleQuant(p.id);
                                    }
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-[6px]"
                                  style={{
                                    paddingLeft: 36,
                                    color: sub.disabled ? PALETTE.text3 : subActive ? activeBlue : PALETTE.text2,
                                    cursor: sub.disabled ? "not-allowed" : "pointer",
                                    background: subActive ? "#f0f7ff" : "transparent",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 5,
                                      height: 5,
                                      borderRadius: "50%",
                                      flexShrink: 0,
                                      background: subActive ? activeBlue : sub.disabled ? PALETTE.border : "#94a3b8",
                                    }}
                                  />
                                  <span className="text-[13px]">{sub.tab}</span>
                                  {sub.disabled ? (
                                    <span className="ml-auto text-[10px] px-1.5 py-[1px] rounded-full" style={{ color: PALETTE.text3, background: "#f1f5f9" }}>
                                      Soon
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </div>
        </aside>

        {/* main content */}
        <main 
          className="fixed overflow-auto transition-all duration-300 ease-in-out"
          style={{ 
            position: "fixed",
            top: HEADER_HEIGHT,
            left: collapsed ? 0 : SIDEBAR_WIDTH,
            right: 0,
            bottom: 0,
            overflow: "auto",
            background: PALETTE.bg,
          }}
        >
          <div style={{ background: bannerColor, borderColor: PALETTE.border }} className="px-6 py-[18px] border-b">
            {selectedQuestion ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button onClick={backToSectionB} className="inline-flex items-center gap-1 px-3 py-1 rounded-md border hover:bg-blue-50 transition text-sm" style={{ color: activeBlue, borderColor: PALETTE.border }}>Back</button>
                    <div className="text-sm" style={{ color: PALETTE.text2 }}>
                      {selectedQuestion.startsWith("P")
                        ? `Principle ${selectedQuestion.split("_")[0].slice(1)} - ${selectedQuestionIsSRS ? "SRS" : "Quant KPIs"}`
                        : `Management & Process Disclosures > Q${selectedQuestion}`}
                    </div>
                  </div>
                </div>
                {selectedQuestion.startsWith("P") ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: activeBlue }}>
                      Principle {principleBannerInfo?.id?.slice(1)} - {principleBannerInfo?.short}
                    </div>
                    <h1 className="text-[15px] font-semibold" style={{ color: PALETTE.text1, maxWidth: 780, lineHeight: 1.45 }}>
                      {principleBannerInfo?.name || "Quantitative KPI View"}
                    </h1>
                  </>
                ) : (
                  <h1 className="text-xl font-bold text-slate-900">{`${selectedQuestion} - ${GD_QUESTIONS.find(q => q.id === selectedQuestion)?.title || ""}`}</h1>
                )}
              </>
            ) : (
              <>
                {isPrincipleView ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: activeBlue }}>
                      Principle {principleBannerInfo?.id?.slice(1)} - {principleBannerInfo?.short}
                    </div>
                    <div className="text-[15px] font-semibold" style={{ color: PALETTE.text1, maxWidth: 780, lineHeight: 1.45 }}>
                      {principleBannerInfo?.name}
                    </div>
                  </>
                ) : selected === "gd-b" ? (
                  <>
                    <h1 className="text-[19px] font-bold" style={{ color: PALETTE.text1 }}>Management &amp; Process Disclosures (Section B)</h1>
                    <div className="text-[13px] mt-1" style={{ color: PALETTE.text2 }}>Questions 5-9: commitments, performance, director statement, oversight, committee</div>
                  </>
                ) : selected === "gd-a" ? (
                  <>
                    <h1 className="text-[19px] font-bold" style={{ color: PALETTE.text1 }}>General Disclosures (Section A)</h1>
                    <div className="text-[13px] mt-1" style={{ color: PALETTE.text2 }}>Core company info, operations, products and CSR disclosures.</div>
                  </>
                ) : (
                  <>
                    <h1 className="text-[19px] font-bold" style={{ color: PALETTE.text1 }}>About This Project</h1>
                    <div className="text-[13px] mt-1" style={{ color: PALETTE.text2 }}>An overview of BRSR, our team, the dashboard purpose, and how to use it.</div>
                  </>
                )}
              </>
            )}
          </div>

          {isPrincipleView ? (
            <div className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: "#d4dce8" }}>
              <div className="flex border-b pl-[6px]" style={{ borderColor: PALETTE.border }}>
                {["Quant KPIs", "SRS", "Combined", "Overall SRS"].map((tab) => {
                  const disabled = tab === "Combined";
                  const active = activeTopTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        if (disabled) return;
                        setActiveTopTab(tab);
                        if (tab === "SRS" && activePrincipleId) {
                          goToQuestion(`${activePrincipleId}_SRS`);
                        } else if (tab === "Quant KPIs" && activePrincipleId) {
                          selectPrincipleQuant(activePrincipleId);
                        } else if (tab === "Overall SRS") {
                          goToQuestion("Overall_SRS");
                        }
                      }}
                      className="px-[22px] py-[11px] text-[13.5px] flex items-center gap-[7px]"
                      style={{
                        color: disabled ? PALETTE.text3 : active ? activeBlue : PALETTE.text2,
                        borderBottom: `2px solid ${active ? activeBlue : "transparent"}`,
                        marginBottom: -1,
                        fontWeight: active ? 600 : 400,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {tab}
                      {disabled ? (
                        <span className="text-[10px] px-[5px] py-[1px] rounded-full" style={{ color: PALETTE.text3, background: "#f1f5f9" }}>
                          Soon
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-[10px] px-5 py-[9px] flex-wrap" style={{ background: "#f9fafb", borderTop: `1px solid ${PALETTE.border}` }}>
                {!selectedQuestionIsSRS && (
                  <div className="flex rounded-full p-[2px] gap-[2px]" style={{ background: "#e8ecf1" }}>
                    {["Sector", "Company"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewModeUi(mode)}
                        className="px-[14px] py-1 rounded-full text-[12.5px]"
                        style={{
                          fontWeight: viewModeUi === mode ? 600 : 400,
                          background: viewModeUi === mode ? "#fff" : "transparent",
                          color: viewModeUi === mode ? PALETTE.text1 : PALETTE.text2,
                          boxShadow: viewModeUi === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}

                {selectedQuestionIsSRS ? (
                  <>
                    <select
                      value={sectorUi}
                      onChange={(e) => {
                        setSectorUi(e.target.value);
                        setSrsCompanyUi("");
                      }}
                      className="text-[12.5px] px-[10px] py-[5px] rounded-md bg-white"
                      style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text1 }}
                    >
                      {dynamicSectorOptions.map((s) => {
                        const value = typeof s === "string" ? s : s.value;
                        const label = typeof s === "string" ? s : s.label;
                        return <option key={value} value={value}>{label}</option>;
                      })}
                    </select>

                    <select
                      value={srsCompanyUi}
                      onChange={(e) => setSrsCompanyUi(e.target.value)}
                      className="text-[12.5px] px-[10px] py-[5px] rounded-md bg-white min-w-[240px]"
                      style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text1 }}
                    >
                      {srsCompanyOptions.length ? null : <option value="">No companies available</option>}
                      {srsCompanyOptions.map((companyName) => (
                        <option key={companyName} value={companyName}>{companyName}</option>
                      ))}
                    </select>

                    <div style={{ width: 1, height: 20, background: PALETTE.border }} />

                    <div className="flex gap-[5px] flex-wrap flex-1">
                      {SRS_METRICS.map((metric) => {
                        const on = srsMetricUi.includes(metric.key);
                        return (
                          <button
                            key={metric.key}
                            onClick={() => {
                              setSrsMetricUi((current) => {
                                if (current.includes(metric.key)) {
                                  if (current.length === 1) return current;
                                  return current.filter((item) => item !== metric.key);
                                }
                                return [...current, metric.key];
                              });
                            }}
                            title={metric.desc}
                            className="text-xs px-[11px] py-1 rounded-full border"
                            style={{
                              borderColor: on ? activeBlue : PALETTE.border,
                              background: on ? PALETTE.activeBlueLight : "#fff",
                              color: on ? activeBlue : PALETTE.text2,
                              fontWeight: on ? 600 : 400,
                            }}
                          >
                            {metric.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <select
                      value={sectorUi}
                      onChange={(e) => setSectorUi(e.target.value)}
                      className="text-[12.5px] px-[10px] py-[5px] rounded-md bg-white"
                      style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text1 }}
                    >
                      {dynamicSectorOptions.map((s) => {
                        const value = typeof s === "string" ? s : s.value;
                        const label = typeof s === "string" ? s : s.label;
                        return <option key={value} value={value}>{label}</option>;
                      })}
                    </select>

                    <div style={{ width: 1, height: 20, background: PALETTE.border }} />

                    <div className="flex gap-[5px] flex-wrap flex-1">
                      {(KPI_CHIPS[activePrincipleId] || []).map((chip) => {
                        const on = activeKpiUi.includes(chip);
                        return (
                          <button
                            key={chip}
                            onClick={() => toggleKpiUi(chip)}
                            className="text-xs px-[11px] py-1 rounded-full border"
                            style={{
                              borderColor: on ? activeBlue : PALETTE.border,
                              background: on ? PALETTE.activeBlueLight : "#fff",
                              color: on ? activeBlue : PALETTE.text2,
                              fontWeight: on ? 600 : 400,
                            }}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <button
                  onClick={resetControlZoneUi}
                  className="text-[12.5px] px-[13px] py-[5px] rounded-md bg-white"
                  style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text2 }}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          <div className="p-6">
            {selectedQuestion ? (
              // Render handler-provided page
              <>
                {handlerLoading && (
                  <div className="p-6 bg-white border rounded text-center" style={{ borderColor: PALETTE.border }}>
                    Loading question {selectedQuestion}...
                  </div>
                )}

                {handlerError && (
                  <div className="p-6 bg-white border rounded text-red-600" style={{ borderColor: PALETTE.border }}>
                    {handlerError}
                  </div>
                )}

                {!handlerLoading && !handlerError && HANDLERS[selectedQuestion] && HANDLERS[selectedQuestion].QuestionPage && (
                  // Render the handler's React component
                  <div>
                    {HandlerComp && (
                      <HandlerComp
                        data={handlerData}
                        filters={filters}
                        setFilters={setFilters}
                        sector={sectorUi}
                        selectedCompany={srsCompanyUi}
                        selectedYear={srsYearUi}
                        selectedMetrics={srsMetricUi}
                        setSelectedCompany={setSrsCompanyUi}
                        setSelectedMetrics={setSrsMetricUi}
                        viewMode={viewModeUi}
                        activeKpis={activeKpiUi}
                        setSector={setSectorUi}
                        setViewMode={setViewModeUi}
                        setActiveKpis={setActiveKpiUi}
                        onBack={backToSectionB}
                        onGoToQuestion={goToQuestion}
                        handlersRegistry={HANDLERS}
                        __hideControls={selectedQuestion && String(selectedQuestion).endsWith("_Quant")}
                      />
                    )}
                  </div>
                )}

                {!handlerLoading && !handlerError && !HANDLERS[selectedQuestion] && (
                  <div className="p-6 bg-white border rounded" style={{ borderColor: PALETTE.border }}>
                    No handler implemented yet for Q{selectedQuestion}. Create <code>./handlers/Q{selectedQuestion}Handler.js</code> and export <code>loadData</code> and <code>QuestionPage</code>.
                  </div>
                )}
              </>
            ) : (
              // Normal non-question pages (overview, gd-a, gd-b, P*)
              <>
                {selected === "overview" && (
                  <div className="space-y-[18px]">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="bg-white border rounded-lg p-6" style={{ borderColor: PALETTE.border }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: activeBlue }}>What is BRSR?</div>
                        <h3 className="text-lg font-semibold mb-3" style={{ color: PALETTE.text1 }}>India's mandatory ESG disclosure framework</h3>
                        <p className="text-sm leading-6" style={{ color: PALETTE.text2 }}>
                          BRSR stands for Business Responsibility and Sustainability Reporting. It is SEBI's framework for structured,
                          non-financial disclosures by listed companies. The report brings together quantitative indicators and narrative
                          disclosures so stakeholders can evaluate responsible business conduct, not just financial performance.
                        </p>
                      </div>

                      <div className="bg-white border rounded-lg p-6" style={{ borderColor: PALETTE.border }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: activeBlue }}>Who are we?</div>
                        <h3 className="text-lg font-semibold mb-3" style={{ color: PALETTE.text1 }}>The ILGC VI capstone team</h3>
                        <p className="text-sm leading-6" style={{ color: PALETTE.text2 }}>
                          Team Lakshit Tyagi, Niyati Singh, Preesha Katial, and Tisha Bhavsar worked with Professor T.V. Ramanathan
                          and Partners in Change (PIC) to evaluate the informational quality of social disclosures across 1,164 listed
                          Indian companies spanning 23 sectors.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-6" style={{ borderColor: PALETTE.border }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: activeBlue }}>Purpose of the dashboard</div>
                      <h3 className="text-lg font-semibold mb-3" style={{ color: PALETTE.text1 }}>A transparent view of quantitative and qualitative disclosure quality</h3>
                      <p className="text-sm leading-6 mb-3" style={{ color: PALETTE.text2 }}>
                        This dashboard lets you explore the social pillar of BRSR through a combination of KPI summaries, narrative scoring,
                        and sector-relative Social Risk Scores. It is designed to surface patterns in P3, P5, P8, and P9 disclosures,
                        and to make the scoring approach auditable rather than opaque.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm" style={{ color: PALETTE.text2 }}>
                        <div className="rounded-md border p-3" style={{ borderColor: PALETTE.border, background: "#fbfdff" }}>
                          Compare firms across sectors using normalized KPI and narrative signals.
                        </div>
                        <div className="rounded-md border p-3" style={{ borderColor: PALETTE.border, background: "#fbfdff" }}>
                          Inspect principle-level quality across P3, P5, P8, and P9.
                        </div>
                        <div className="rounded-md border p-3" style={{ borderColor: PALETTE.border, background: "#fbfdff" }}>
                          Trace every score back to structured data or extracted text evidence.
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-6" style={{ borderColor: PALETTE.border }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: activeBlue }}>How to use this dashboard</div>
                      <h3 className="text-lg font-semibold mb-3" style={{ color: PALETTE.text1 }}>A quick walkthrough</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" style={{ color: PALETTE.text2 }}>
                        <div>
                          <div className="font-semibold mb-1" style={{ color: PALETTE.text1 }}>1. Start here</div>
                          Open this page first to understand the project, scope, and data structure before moving into detailed analysis.
                        </div>
                        <div>
                          <div className="font-semibold mb-1" style={{ color: PALETTE.text1 }}>2. Move to principles</div>
                          Use the sidebar to explore each social principle and compare quantitative and qualitative views.
                        </div>
                        <div>
                          <div className="font-semibold mb-1" style={{ color: PALETTE.text1 }}>3. Review filters</div>
                          Narrow the analysis by sector, company, or scoring view when inspecting principle-level results.
                        </div>
                        <div>
                          <div className="font-semibold mb-1" style={{ color: PALETTE.text1 }}>4. Read the signals</div>
                          Treat high scores as a prompt for scrutiny, not a final judgment. The dashboard shows disclosure quality, not ground truth performance.
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-6" style={{ borderColor: PALETTE.border }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: activeBlue }}>Footer</div>
                      <h3 className="text-lg font-semibold mb-3" style={{ color: PALETTE.text1 }}>Current dashboard version</h3>
                      <p className="text-sm leading-6" style={{ color: PALETTE.text2 }}>
                        This version is a working prototype for ILGC VI, built in Next.js with a dashboard-style interface for exploration,
                        not for official ranking publication. It combines placeholder overview content with the current BRSR analysis pipeline,
                        and may continue to evolve as the project is refined.
                      </p>
                    </div>
                  </div>
                )}

                {selected === "gd-b" && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-[11.5px] font-bold uppercase tracking-[0.07em] mb-[10px]" style={{ color: PALETTE.text3 }}>Policy and management processes</div>
                      <div className="space-y-[6px]">
                        {GD_QUESTIONS.filter((q) => q.group === "Policy and management processes").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-[13px_18px] cursor-pointer flex items-center justify-between transition"
                            style={{ background: "#ffffff", border: `1px solid ${PALETTE.border}` }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div className="text-[13px] leading-snug" style={{ color: PALETTE.text1 }}><strong style={{ color: activeBlue }}>Q{q.id}.</strong> {q.title}</div>
                            <div className="text-lg" style={{ color: PALETTE.text3 }}>›</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11.5px] font-bold uppercase tracking-[0.07em] mb-[10px]" style={{ color: PALETTE.text3 }}>Governance, leadership and oversight</div>
                      <div className="space-y-[6px]">
                        {GD_QUESTIONS.filter((q) => q.group === "Governance, leadership and oversight").map((q) => (
                          <div
                            key={q.id}
                            onClick={() => goToQuestion(q.id)}
                            className="w-full rounded-lg p-[13px_18px] cursor-pointer flex items-center justify-between transition"
                            style={{ background: "#ffffff", border: `1px solid ${PALETTE.border}` }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div className="text-[13px] leading-snug" style={{ color: PALETTE.text1 }}><strong style={{ color: activeBlue }}>Q{q.id}.</strong> {q.title}</div>
                            <div className="text-lg" style={{ color: PALETTE.text3 }}>›</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selected === "gd-a" && (
                  <div className="space-y-[18px]">
                    <div className="bg-white rounded-lg border p-[20px_24px]" style={{ borderColor: PALETTE.border }}>
                      <div className="text-sm font-semibold mb-2" style={{ color: PALETTE.text1 }}>Section A — General Disclosures (placeholder)</div>
                      <div className="text-[13px]" style={{ color: PALETTE.text2 }}>This page is intentionally left as a structural placeholder. We'll add the A1–A7 items from the BRSR PDF here when you're ready.</div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {renderPlaceholderPanel("A-Section Coverage Summary", 240)}
                      {renderPlaceholderPanel("Entity Profile Distribution", 240)}
                    </div>

                    {renderPlaceholderPanel("General Disclosures Table", 200)}
                  </div>
                )}

                {selected.startsWith("P") && (
                  <>
                    {HANDLERS[selected] && HANDLERS[selected].QuestionPage ? (
                      <div>
                        {React.createElement(HANDLERS[selected].QuestionPage, {
                          onGoToQuestion: goToQuestion,
                          data: null,
                          filters,
                          setFilters,
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-white rounded border" style={{ borderColor: PALETTE.border }}>
                          <div className="text-sm text-slate-500 mb-2">Summary</div>
                          <div className="text-lg font-semibold">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.short}</div>
                          <div className="text-sm text-slate-600 mt-1">{PRINCIPLES.find((p) => p.id === selectedPrinciple)?.name}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
