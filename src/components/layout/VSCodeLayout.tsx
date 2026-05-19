"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function IconFiles() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="13 2 13 9 20 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPortfolio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "#e05555" : "none"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#e05555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface EditorTab {
  id: string;
  label: string;
  lang?: "ts" | "tsx" | "py" | "js" | "java" | "sql";
  modified?: boolean;
}

interface VSCodeLayoutProps {
  children: React.ReactNode;
  tabs?: EditorTab[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  userId?: string;
  hearts?: number;
  xp?: number;
  level?: number;
  streak?: number;
  weeklyRank?: number | null;
  username?: string; // Portfolio linki için
  learnHref?: string; // Doğru lpId'li öğren linki
}

const LANG_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#61dafb", py: "#ffda4b", js: "#f7df1e", sql: "#e8b84b", java: "#e07c5a",
};

// Süre hesaplama yardımcısı
function getTimeLeft(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "Az kaldı...";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (hrs > 0) return `${hrs} saat ${mins} dk ${secs} sn`;
  return `${mins} dk ${secs} sn`;
}

// Hearts bitince gösterilen modal — dinamik geri sayım + kapatma butonu
function HeartsEmptyModal({ refilledAt, onClose }: { refilledAt: Date | null; onClose: () => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const missingHearts = 5;
  const nextHeart = refilledAt ? new Date(refilledAt.getTime() + 3600000) : null;
  const fullRefill = refilledAt ? new Date(refilledAt.getTime() + missingHearts * 3600000) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div style={{
        background: "#252526",
        border: "1px solid #e0555544",
        borderRadius: 8,
        padding: 32,
        width: 360,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: "center",
        position: "relative",
      }}>
        {/* Kapatma butonu */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "transparent",
            border: "none",
            color: "#858585",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            transition: "color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#d4d4d4";
            e.currentTarget.style.background = "#3c3c3c";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#858585";
            e.currentTarget.style.background = "transparent";
          }}
          title="Kapat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div style={{ fontSize: 40, marginBottom: 12 }}>💔</div>
        <h2 style={{ color: "#e05555", fontSize: 16, marginBottom: 8 }}>Canınız bitti!</h2>
        <p style={{ color: "#858585", fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
          Devam etmek için can dolmasını bekleyin veya eski konuları tekrar edin.
        </p>
        <div style={{
          background: "#1e1e1e",
          border: "1px solid #3c3c3c",
          borderRadius: 6,
          padding: "12px 16px",
          marginBottom: 8,
          textAlign: "left",
        }}>
          <div style={{ color: "#858585", fontSize: 11, marginBottom: 4 }}>1 kalp için:</div>
          <div style={{ color: "#e2c08d", fontSize: 13, fontWeight: 600 }}>
            {nextHeart ? getTimeLeft(nextHeart, now) : "1 saat"}
          </div>
        </div>
        <div style={{
          background: "#1e1e1e",
          border: "1px solid #3c3c3c",
          borderRadius: 6,
          padding: "12px 16px",
          textAlign: "left",
        }}>
          <div style={{ color: "#858585", fontSize: 11, marginBottom: 4 }}>Tüm canlar için:</div>
          <div style={{ color: "#6a9955", fontSize: 13, fontWeight: 600 }}>
            {fullRefill ? getTimeLeft(fullRefill, now) : "5 saat"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Status bar hearts göstergesi — can eksikse hover'da kalan süreyi gösterir
function HeartsIndicator({ hearts, heartsLastFill }: { hearts: number; heartsLastFill: Date | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (hearts >= 5) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [hearts]);

  const missingHearts = 5 - hearts;
  const nextHeart =
    heartsLastFill && hearts < 5
      ? new Date(heartsLastFill.getTime() + 3600000)
      : null;
  const fullRefill =
    heartsLastFill && hearts < 5
      ? new Date(heartsLastFill.getTime() + missingHearts * 3600000)
      : null;

  return (
    <div className="relative group flex items-center gap-1">
      {/* Masaüstünde 5 kalp, mobilde 1 kalp göster */}
      <div className="hidden sm:flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <IconHeart key={i} filled={i < hearts} />
        ))}
      </div>
      <div className="flex sm:hidden items-center">
        <IconHeart filled={hearts > 0} />
      </div>
      <span className="ml-1 sm:ml-1.5 opacity-75">{hearts}/5</span>

      {hearts < 5 && (
        <div
          className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200"
          style={{
            background: "#252526",
            border: "1px solid #3c3c3c",
            fontSize: 11,
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ color: "#e2c08d", marginBottom: 4 }}>
            Sonraki ❤️: {nextHeart ? getTimeLeft(nextHeart, now) : "1 saat"}
          </div>
          <div style={{ color: "#6a9955" }}>
            Tam dolum: {fullRefill ? getTimeLeft(fullRefill, now) : `${missingHearts} saat`}
          </div>
        </div>
      )}
    </div>
  );
}

export function VSCodeLayout({
  children,
  tabs = [],
  activeTabId,
  onTabChange,
  userId,
  hearts: initialHearts = 5,
  xp = 0,
  level = 1,
  streak = 0,
  weeklyRank = null,
  username,
  learnHref,
}: VSCodeLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalTab, setInternalTab] = useState(tabs[0]?.id ?? "");
  const currentTab = activeTabId ?? internalTab;
  const [hearts, setHearts] = useState(initialHearts);
  const [heartsLastFill, setHeartsLastFill] = useState<Date | null>(null);
  const [showEmptyModal, setShowEmptyModal] = useState(false);

  // EKLENEN KISIM: Dışarıdan gelen initialHearts değiştiğinde içerideki hearts state'ini güncelle
  useEffect(() => {
    setHearts(initialHearts);
  }, [initialHearts]);

  useEffect(() => {
    if (!userId) return;

    const fetchHearts = async () => {
      try {
        const res = await fetch(`/api/hearts?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setHearts(data.hearts);
          if (data.heartsLastFill) setHeartsLastFill(new Date(data.heartsLastFill));
          // Hearts 0 ise modal göster — sadece daha önce kapatılmamışsa
          if (data.hearts === 0) {
            const dismissed = sessionStorage.getItem("hearts_modal_dismissed");
            if (!dismissed) setShowEmptyModal(true);
          } else {
            setShowEmptyModal(false);
            // Canlar geri dolunca flag'i temizle — bir sonraki 0'da tekrar göster
            sessionStorage.removeItem("hearts_modal_dismissed");
          }
        }
      } catch { }
    };

    fetchHearts();
    const interval = setInterval(fetchHearts, 30_000); // 30 saniyede bir kontrol (veritabanını korumak için)
    return () => clearInterval(interval);
  }, [userId]);

  const navItems = [
    { icon: <IconFiles />, label: "Öğren", href: learnHref ?? "/learn/variables", match: "/learn" },
    { icon: <IconTerminal />, label: "Sandbox", href: "/sandbox", match: "/sandbox" },
    { icon: <IconPortfolio />, label: "Portfolio", href: username ? `/portfolio/${username}` : "/portfolio", match: "/portfolio" },
    { icon: <IconUser />, label: "Profil", href: "/profile", match: "/profile" },
  ];

  const handleTab = (id: string) => {
    setInternalTab(id);
    onTabChange?.(id);
  };

  // Profile/edit sayfasında geri butonu göster
  const showBack = pathname.startsWith("/profile/edit");

  return (
    <div
      className="flex flex-col h-[100dvh] w-screen overflow-hidden"
      style={{ background: "#1e1e1e", color: "#d4d4d4", fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace" }}
    >
      {/* Hearts boş modal */}
      {showEmptyModal && (
        <HeartsEmptyModal
          refilledAt={heartsLastFill}
          onClose={() => {
            setShowEmptyModal(false);
            sessionStorage.setItem("hearts_modal_dismissed", "true");
            router.push(learnHref ?? "/learn/variables");
          }}
        />
      )}

      {/* Title Bar */}
      <div
        className="flex items-center h-8 px-4 gap-2 shrink-0 select-none"
        style={{ background: "#007acc", color: "#fff" }}
      >
        {/* Geri butonu */}
        {showBack && (
          <Link
            href="/profile"
            style={{ color: "#fff", marginRight: 4, opacity: 0.85, display: "flex", alignItems: "center" }}
            title="Geri"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <span className="font-bold tracking-widest text-[11px] uppercase">CodeQuest</span>
        <span className="opacity-40 text-xs">|</span>
        <span className="text-xs opacity-75 font-light">
          {pathname.startsWith("/learn") ? "Öğren"
            : pathname.startsWith("/sandbox") ? "Sandbox"
              : pathname.startsWith("/profile/edit") ? "Profil Düzenle"
                : pathname.startsWith("/profile") ? "Profil"
                  : pathname.startsWith("/portfolio") ? "Portfolio"
                    : ""}
        </span>
      </div>

      <div className="flex flex-col-reverse md:flex-row flex-1 overflow-hidden">
        {/* Activity Bar */}
        <div
          className="flex flex-row md:flex-col items-center justify-around md:justify-start py-1 md:py-2 w-full md:w-12 h-12 md:h-auto shrink-0 gap-0.5 border-t md:border-t-0 md:border-r border-[#1e1e1e]"
          style={{ background: "#333333" }}
        >
          {navItems.map((item) => {
            const active = pathname.startsWith(item.match);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className={`relative flex items-center justify-center w-12 h-12 transition-colors duration-150 group border-t-2 md:border-t-0 md:border-l-2 ${
                  active ? "border-[#007acc]" : "border-transparent"
                }`}
                style={{
                  color: active ? "#ffffff" : "#858585",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                }}
              >
                {item.icon}
                <span
                  className="absolute left-14 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity hidden md:block"
                  style={{ background: "#252526", color: "#d4d4d4", border: "1px solid #3c3c3c", fontSize: "11px" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {tabs.length > 0 && (
            <div
              className="flex items-end h-9 overflow-x-auto shrink-0 select-none"
              style={{ background: "#252526", borderBottom: "1px solid #1e1e1e" }}
            >
              {tabs.map((tab) => {
                const active = tab.id === currentTab;
                const dot = LANG_COLORS[tab.lang ?? "ts"];
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTab(tab.id)}
                    className="flex items-center gap-1.5 h-full px-4 text-xs whitespace-nowrap border-t-2 transition-colors duration-100"
                    style={{
                      background: active ? "#1e1e1e" : "transparent",
                      color: active ? "#d4d4d4" : "#6e6e6e",
                      borderTopColor: active ? "#007acc" : "transparent",
                      borderRight: "1px solid #1e1e1e",
                    }}
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: dot }} />
                    {tab.label}
                    {tab.modified && (
                      <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: "#e2c08d" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>

      {/* Status Bar */}
      <div
        className="flex items-center justify-between h-6 px-3 shrink-0 select-none"
        style={{ background: "#007acc", color: "#ffffff", fontSize: "11px" }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="opacity-70 hidden sm:inline">⎇ main</span>
          <span className="opacity-40 hidden sm:inline">|</span>
          <span>Lv.{level}</span>
          <span className="opacity-70">{xp.toLocaleString("tr-TR")} XP</span>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 sm:gap-1">
              <span>🔥</span>
              <span className="opacity-90">{streak}<span className="hidden sm:inline"> gün</span></span>
            </span>
          )}
          {weeklyRank != null && <span className="opacity-70 hidden sm:inline">#{weeklyRank} bu hafta</span>}
        </div>
        <HeartsIndicator hearts={hearts} heartsLastFill={heartsLastFill} />
      </div>
    </div>
  );
}