// /src/components/profile/index.tsx
// CodeQuest — Profil sayfası bileşenleri
// Export: ProfileHeader, StatsGrid, BadgeShelf, WeeklyLeaderboard

"use client";

import { useState, useRef, useEffect } from "react";

// ─── Tipler ──────────────────────────────────────────────────────

export interface ProfileUser {
  id:            string;
  username:      string;
  level:         number;
  xp:            number;
  hearts:        number;
}

export interface ProfileStats {
  totalXp:           number;
  level:             number;
  currentStreak:     number;
  completedChallenges: number;
}

export interface BadgeData {
  id:          string;
  name:        string;
  description: string;
  iconUrl:     string;
  earned:      boolean;
  earnedAt?:   string;
}

export interface LeaderboardEntry {
  rank:       number;
  userId:     string;
  username:   string;
  weeklyXp:   number;
  level:      number;
}

// ─── Yardımcılar ─────────────────────────────────────────────────

function scoreColor(level: number): string {
  if (level >= 8) return "#c586c0";   // Mor — ileri
  if (level >= 5) return "#007acc";   // Mavi — orta
  return "#6a9955";                    // Yeşil — başlangıç
}

function levelLabel(level: number): string {
  if (level >= 8) return "İleri";
  if (level >= 5) return "Orta";
  return "Başlangıç";
}

// XP'den sonraki seviye eşiğini döndürür (progress bar için)
const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 100, 2: 250, 3: 450, 4: 700, 5: 1000,
  6: 1400, 7: 1900, 8: 2500, 9: 3200, 10: 9999,
};
const LEVEL_BASES: Record<number, number> = {
  1: 0, 2: 100, 3: 250, 4: 450, 5: 700,
  6: 1000, 7: 1400, 8: 1900, 9: 2500, 10: 3200,
};

function xpProgress(xp: number, level: number): number {
  const base  = LEVEL_BASES[level]  ?? 0;
  const next  = LEVEL_THRESHOLDS[level] ?? 9999;
  const span  = next - base;
  const done  = xp - base;
  return Math.min(100, Math.max(0, Math.round((done / span) * 100)));
}

// ─────────────────────────────────────────────
// 1. ProfileHeader
// ─────────────────────────────────────────────

export function ProfileHeader({ user }: { user: ProfileUser }) {
  const initials   = user.username.slice(0, 2).toUpperCase();
  const lvlColor   = scoreColor(user.level);
  const progress   = xpProgress(user.xp, user.level);
  const nextThresh = LEVEL_THRESHOLDS[user.level] ?? 9999;
  const baseXP     = LEVEL_BASES[user.level] ?? 0;

  return (
    <div
      className="flex items-center gap-5 px-6 py-5 rounded-lg"
      style={{ background: "#252526", border: "1px solid #3c3c3c" }}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center rounded-lg shrink-0 font-bold"
        style={{
          width: 56, height: 56,
          background: lvlColor + "22",
          border:     `1px solid ${lvlColor}44`,
          color:      lvlColor,
          fontSize:   20,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {initials}
      </div>

      {/* İsim + seviye */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold truncate"
            style={{ color: "#d4d4d4", fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {user.username}
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold shrink-0"
            style={{
              background: lvlColor + "22",
              color:      lvlColor,
              border:     `1px solid ${lvlColor}44`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize:   10,
            }}
          >
            Lv.{user.level} · {levelLabel(user.level)}
          </span>
        </div>

        {/* XP progress */}
        <div className="flex flex-col gap-1">
          <div
            className="relative rounded-full overflow-hidden"
            style={{ height: 5, background: "#3c3c3c" }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${progress}%`, background: lvlColor, transition: "width 0.8s ease" }}
            />
          </div>
          <span style={{ color: "#858585", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            {user.xp.toLocaleString("tr-TR")} XP · bir sonraki seviye: {nextThresh.toLocaleString("tr-TR")} XP
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2. StatsGrid
// ─────────────────────────────────────────────

interface StatCardProps {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: string;
}

function StatCard({ label, value, sub, accent = "#007acc" }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1.5 px-4 py-4 rounded-lg w-full"
      style={{ background: "#252526", border: "1px solid #3c3c3c" }}
    >
      <span style={{ color: "#858585", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </span>
      <span
        className="font-bold tabular-nums"
        style={{ color: accent, fontSize: 24, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}
      >
        {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
      </span>
      {sub && (
        <span style={{ color: "#555", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function StatsGrid({ stats }: { stats: ProfileStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Toplam XP"
        value={stats.totalXp}
        sub="tüm zamanlar"
        accent="#007acc"
      />
      <StatCard
        label="Seviye"
        value={stats.level}
        sub={levelLabel(stats.level)}
        accent={scoreColor(stats.level)}
      />
      <StatCard
        label="Güncel Seri"
        value={stats.currentStreak === 0 ? "—" : `${stats.currentStreak} gün`}
        sub={stats.currentStreak > 0 ? "🔥 devam ediyor" : "henüz başlamadı"}
        accent="#e2c08d"
      />
      <StatCard
        label="Tamamlanan Görev"
        value={stats.completedChallenges}
        sub="başarılı submission"
        accent="#6a9955"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// 3. BadgeShelf
// ─────────────────────────────────────────────

function BadgeCard({ badge }: { badge: BadgeData }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({
    bottom: "115%",
    left: "50%",
    transform: "translateX(-50%)",
  });
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({
    left: "50%",
    transform: "translateX(-50%) rotate(45deg)",
  });
  
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const tooltipWidth = 220;
      const sidebarWidth = 48;
      const minLeft = sidebarWidth + 8; // 48px sidebar + 8px safety gap
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
      const maxRight = viewportWidth - 8; // 8px safety gap from right edge
      
      const cardCenter = cardRect.left + cardRect.width / 2;
      const expectedLeft = cardCenter - tooltipWidth / 2;
      const expectedRight = cardCenter + tooltipWidth / 2;
      
      if (expectedLeft < minLeft) {
        const shiftAmount = minLeft - expectedLeft;
        setTooltipStyle({
          bottom: "115%",
          left: `calc(50% + ${shiftAmount}px)`,
          transform: "translateX(-50%)",
        });
        setArrowStyle({
          left: `calc(50% - ${shiftAmount}px)`,
          transform: "translateX(-50%) rotate(45deg)",
        });
      } else if (expectedRight > maxRight) {
        const shiftAmount = expectedRight - maxRight;
        setTooltipStyle({
          bottom: "115%",
          left: `calc(50% - ${shiftAmount}px)`,
          transform: "translateX(-50%)",
        });
        setArrowStyle({
          left: `calc(50% + ${shiftAmount}px)`,
          transform: "translateX(-50%) rotate(45deg)",
        });
      } else {
        setTooltipStyle({
          bottom: "115%",
          left: "50%",
          transform: "translateX(-50%)",
        });
        setArrowStyle({
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
        });
      }
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={cardRef}
      className="relative flex flex-col items-center gap-2 p-2 rounded-lg text-center transition-all duration-300"
      style={{
        background: "#252526",
        border:     `1px solid ${badge.earned ? "#3c3c3c" : "#2a2a2a"}`,
        width:      "100%",
        height:     "80px",
        display:    "flex",
        justifyContent: "center",
        cursor:     "pointer",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="flex flex-col items-center gap-1.5 w-full"
        style={{
          opacity: badge.earned ? 1 : 0.4,
          transition: "opacity 0.2s ease",
        }}
      >
        {/* İkon — URL varsa img, emoji ise metin, yoksa baş harf fallback */}
        {badge.iconUrl ? (
          badge.iconUrl.startsWith("/") || badge.iconUrl.startsWith("http") ? (
            <img
              src={badge.iconUrl}
              alt={badge.name}
              style={{ width: 28, height: 28, objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: 22, lineHeight: "28px", height: 28 }}>
              {badge.iconUrl}
            </div>
          )
        ) : (
          <div
            className="flex items-center justify-center rounded-full font-bold"
            style={{
              width: 28, height: 28,
              background: badge.earned ? "#007acc22" : "#3c3c3c",
              color:      badge.earned ? "#007acc"   : "#555",
              fontSize:   12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {badge.name.charAt(0)}
          </div>
        )}
        <span
          className="text-center leading-tight w-full px-1"
          style={{
            color:      badge.earned ? "#d4d4d4" : "#858585",
            fontSize:   8,
            fontFamily: "'JetBrains Mono', monospace",
            overflow:   "hidden",
            display:    "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {badge.name}
        </span>
      </div>

      {/* Dynamic, visually stunning premium Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 flex flex-col gap-2 p-3 text-left rounded-lg pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
          style={{
            ...tooltipStyle,
            width: "220px",
            background: "rgba(30, 30, 30, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid #3c3c3c",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {/* Header with badge icon and name */}
          <div className="flex items-center gap-2 pb-1.5" style={{ borderBottom: "1px solid #3c3c3c" }}>
            <span style={{ fontSize: 16 }}>{badge.iconUrl && !badge.iconUrl.startsWith("/") && !badge.iconUrl.startsWith("http") ? badge.iconUrl : "🏆"}</span>
            <span style={{ color: "#d4d4d4", fontSize: 11, fontWeight: "bold" }}>
              {badge.name}
            </span>
          </div>

          {/* Description */}
          <div style={{ color: "#a0a0a0", fontSize: 10, lineHeight: 1.4 }}>
            {badge.description}
          </div>

          {/* Earning Status & Date */}
          <div className="flex items-center gap-1.5 mt-1 pt-1.5" style={{ borderTop: "1px solid #2d2d2d" }}>
            {badge.earned ? (
              <>
                <span style={{ color: "#6a9955", fontSize: 9, fontWeight: "bold" }}>✓ Kazanıldı</span>
                <span style={{ color: "#858585", fontSize: 9 }}>· {badge.earnedAt}</span>
              </>
            ) : (
              <span style={{ color: "#e05555", fontSize: 9, fontWeight: "bold" }}>🔒 Kilitli</span>
            )}
          </div>

          {/* Tooltip arrow */}
          <div
            style={{
              position: "absolute",
              bottom: "-5px",
              ...arrowStyle,
              width: "10px",
              height: "10px",
              background: "rgba(30, 30, 30, 0.95)",
              borderRight: "1px solid #3c3c3c",
              borderBottom: "1px solid #3c3c3c",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function getBadgeDifficulty(name: string): number {
  const order: Record<string, number> = {
    "İlk Görev Tamamlandı": 1,
    "Hızlı Çözücü": 2,
    "Bronz Programcı": 3,
    "3 Gün Üst Üste Giriş": 4,
    "Meraklı Zihin": 5,
    "Erken Kalkan Yol Alır": 6,
    "5. Görev": 7,
    "Seviye Üç": 8,
    "7 Gün Streak": 9,
    "Çok Yönlü": 10,
    "Gümüş Kodlayıcı": 11,
    "10. Görev": 12,
    "Gece Kuşu": 13,
    "15. Görev": 14,
    "Kod Ustası": 15,
    "İki Hafta Kesintisiz": 16,
    "Kusursuz Kod": 17,
    "25. Görev": 18,
    "30 Gün Streak": 19,
    "Dil Uzmanı": 20,
    "Efsanevi Yazılımcı": 21,
    "50. Görev": 22,
    "Hata Avcısı": 23,
    "Yenilmez": 24,
  };
  return order[name] ?? 999;
}

export function BadgeShelf({ badges }: { badges: BadgeData[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const earned   = badges.filter((b) => b.earned);
  const ordered  = [...badges].sort((a, b) => getBadgeDifficulty(a.name) - getBadgeDifficulty(b.name));
  const displayed = (isMobile && !isExpanded) ? ordered.slice(0, 8) : ordered;

  return (
    <div
      className="px-5 py-4 rounded-lg"
      style={{ background: "#252526", border: "1px solid #3c3c3c" }}
    >
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: "#858585", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Rozetler
        </span>
        <div className="flex items-center gap-3">
          <span style={{ color: "#555", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            {earned.length}/{badges.length} kazanıldı
          </span>
          {isMobile && badges.length > 8 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] transition-all px-2 py-0.5 rounded border border-[#3c3c3c] hover:bg-[#3c3c3c] hover:text-[#d4d4d4]"
              style={{
                background: "transparent",
                color: "#858585",
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
              }}
            >
              {isExpanded ? "Daralt ▲" : "Tümünü Gör ▼"}
            </button>
          )}
        </div>
      </div>

      {badges.length === 0 ? (
        <p style={{ color: "#555", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          Henüz rozet yok.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
          {displayed.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 4. WeeklyLeaderboard
// ─────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 14 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 14 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 14 }}>🥉</span>;
  return (
    <span
      className="tabular-nums"
      style={{ color: "#555", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", minWidth: 20, textAlign: "right" }}
    >
      {rank}
    </span>
  );
}

export function WeeklyLeaderboard({
  leaderboard,
  currentUserId,
  currentUserEntry,
}: {
  leaderboard:   LeaderboardEntry[];
  currentUserId: string;
  currentUserEntry?: LeaderboardEntry | null;
}) {
  return (
    <div
      className="px-5 py-4 rounded-lg"
      style={{ background: "#252526", border: "1px solid #3c3c3c" }}
    >
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: "#858585", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Bu Hafta
        </span>
        <span style={{ color: "#555", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          Pazartesi sıfırlanır
        </span>
      </div>

      {leaderboard.length === 0 ? (
        <p style={{ color: "#555", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          Bu hafta henüz sıralama yok.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {leaderboard.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-3 py-2 rounded"
                style={{
                  background: isCurrentUser ? "#007acc18" : "transparent",
                  border:     isCurrentUser ? "1px solid #007acc33" : "1px solid transparent",
                }}
              >
                {/* Sıra */}
                <div style={{ minWidth: 24, display: "flex", justifyContent: "center" }}>
                  <RankMedal rank={entry.rank} />
                </div>

                {/* Kullanıcı adı */}
                <span
                  className="flex-1 truncate text-sm"
                  style={{
                    color:      isCurrentUser ? "#9cdcfe" : "#d4d4d4",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: isCurrentUser ? 600 : 400,
                  }}
                >
                  {entry.username}
                  {isCurrentUser && (
                    <span style={{ color: "#007acc", fontSize: 9, marginLeft: 6 }}>(sen)</span>
                  )}
                </span>

                {/* Seviye */}
                <span
                  style={{ color: "#555", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", minWidth: 36, textAlign: "right" }}
                >
                  Lv.{entry.level}
                </span>

                {/* Haftalık XP */}
                <span
                  className="tabular-nums text-xs font-semibold"
                  style={{
                    color:      isCurrentUser ? "#007acc" : "#6a9955",
                    fontFamily: "'JetBrains Mono', monospace",
                    minWidth:   56,
                    textAlign:  "right",
                  }}
                >
                  {entry.weeklyXp.toLocaleString("tr-TR")} XP
                </span>
              </div>
            );
          })}

          {/* Top 10 dışındaki giriş yapan kullanıcı kendi sıralamasını görsün */}
          {currentUserEntry && (
            <>
              {/* Kendisi */}
              <div
                key={currentUserEntry.userId}
                className="flex items-center gap-3 px-3 py-2 rounded"
                style={{
                  background: "rgba(0, 122, 204, 0.12)",
                  border:     "1px solid rgba(0, 122, 204, 0.35)",
                  boxShadow:  "0 2px 8px -2px rgba(0,0,0,0.4)",
                  marginTop:  4, // İlk 10 satırdan hafifçe ayrışması için ufak bir üst boşluk
                }}
              >
                {/* Sıra */}
                <div style={{ minWidth: 24, display: "flex", justifyContent: "center" }}>
                  <span
                    className="tabular-nums font-bold"
                    style={{ color: "#9cdcfe", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", minWidth: 20, textAlign: "right" }}
                  >
                    {currentUserEntry.rank}
                  </span>
                </div>

                {/* Kullanıcı adı */}
                <span
                  className="flex-1 truncate text-sm"
                  style={{
                    color:      "#9cdcfe",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  {currentUserEntry.username}
                  <span style={{ color: "#007acc", fontSize: 9, marginLeft: 6 }}>(sen)</span>
                </span>

                {/* Seviye */}
                <span
                  style={{ color: "#858585", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", minWidth: 36, textAlign: "right" }}
                >
                  Lv.{currentUserEntry.level}
                </span>

                {/* Haftalık XP */}
                <span
                  className="tabular-nums text-xs font-bold"
                  style={{
                    color:      "#007acc",
                    fontFamily: "'JetBrains Mono', monospace",
                    minWidth:   56,
                    textAlign:  "right",
                  }}
                >
                  {currentUserEntry.weeklyXp.toLocaleString("tr-TR")} XP
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
