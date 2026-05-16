
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const PALETTE = {
  activeBlue: "#176fb3",
  bg: "#f7f8fb",
  text1: "#1a2333",
  text2: "#64748b",
};

export default function Page() {
  const router = useRouter();

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

    const t = setTimeout(() => {
      router.push("/dashboard");
    }, 1400);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: PALETTE.bg, fontFamily: "var(--dashboard-font-family)" }}
    >
      <div style={{ textAlign: "center" }} className="p-8">
        <div
          style={{ width: 88, height: 88, margin: "0 auto", borderRadius: 12, background: "#e8f2fb" }}
          className="flex items-center justify-center fadeAnim"
        >
          <Image src="/logo.png" alt="logo" width={56} height={56} />
        </div>

        <h1 className="text-4xl font-bold mt-4 fadeAnim" style={{ color: PALETTE.text1 }}>
          Welcome to our BRSR Dashboard
        </h1>
        <p className="text-lg mt-2 fadeAnim" style={{ color: PALETTE.text2 }}>
          Business Responsibility &amp; Sustainability Reporting insights
        </p>
        <p className="text-sm mt-3 text-slate-500 fadeAnim">Loading dashboard…</p>

        <style>{`
          @keyframes fadeInScale { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .fadeAnim { animation: fadeInScale 850ms ease-out both; }
        `}</style>
      </div>
    </main>
  );
}
