"use client";

// /src/components/learn/ReviewModal.tsx
// CodeQuest — Submission sonuç modalı
// passed=true → review objesiyle 5 eksen gösterilir
// passed=false → sadece başarısız mesajı, review gelmez

import { useEffect, useRef } from "react";

// ─── Tipler ──────────────────────────────────────────────────────

export interface ReviewData {
  overallScore:        number;
  correctness:         number;
  readability:         number;
  timeComplexity:      number;
  spaceComplexity:     number;
  idiomaticStyle:      number;
  feedbackPositive:    string;
  feedbackImprovement: string;
  complexityNote:      string;
}

export interface ReviewModalProps {
  open:       boolean;
  passed:     boolean;
  review?:    ReviewData;           // Yalnızca passed=true ise gelir
  xpEarned?:  number;               // Kazanılan XP (opsiyonel, status bar'dan)
  newBadges?: { name: string; iconUrl: string; description: string }[];
  onClose:    () => void;
}

// ─── Sabitler ────────────────────────────────────────────────────

const AXES: { key: keyof Omit<ReviewData, "overallScore" | "feedbackPositive" | "feedbackImprovement" | "complexityNote">; label: string }[] = [
  { key: "correctness",    label: "Doğruluk"        },
  { key: "readability",    label: "Okunabilirlik"    },
  { key: "timeComplexity", label: "Zaman Karmaşıklığı" },
  { key: "spaceComplexity",label: "Alan Karmaşıklığı" },
  { key: "idiomaticStyle", label: "Dil Stili"        },
];

// ─── Yardımcılar ─────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#6a9955";   // VS Code yorum yeşili
  if (score >= 60) return "#e2c08d";   // VS Code string sarısı
  return "#e05555";                     // Hata kırmızısı
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Mükemmel";
  if (score >= 60) return "İyi";
  if (score >= 40) return "Geliştirilmeli";
  return "Yetersiz";
}

// ─── Alt bileşenler ──────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{ height: 6, background: "#3c3c3c" }}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

function AxisRow({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#858585", fontFamily: "inherit" }}>
          {label}
        </span>
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color, fontFamily: "'JetBrains Mono', monospace", minWidth: 32, textAlign: "right" }}
        >
          {value}
        </span>
      </div>
      <ProgressBar value={value} color={color} />
    </div>
  );
}

function FeedbackBox({
  text,
  variant,
}: {
  text: string;
  variant: "positive" | "improvement";
}) {
  const styles =
    variant === "positive"
      ? { bg: "#6a995518", border: "#6a995540", color: "#9fcea8", icon: "✓" }
      : { bg: "#e2c08d18", border: "#e2c08d40", color: "#e2c08d", icon: "→" };

  return (
    <div
      className="flex gap-2.5 px-3 py-2.5 rounded text-xs leading-relaxed"
      style={{
        background: styles.bg,
        border:     `1px solid ${styles.border}`,
        color:      styles.color,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span className="shrink-0 mt-0.5 font-semibold">{styles.icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────

export function ReviewModal({ open, passed, review, xpEarned, newBadges, onClose }: ReviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape tuşu ile kapat
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Modal açıldığında "Devam Et" butonuna focus
  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  const overallColor = passed && review ? scoreColor(review.overallScore) : "#e05555";

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="flex flex-col w-full max-w-md max-h-screen overflow-y-auto rounded-lg"
        style={{
          background: "#252526",
          border:     "1px solid #3c3c3c",
          fontFamily: "'JetBrains Mono', monospace",
          margin: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Başlık çubuğu ──────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid #1e1e1e" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: passed ? "#6a9955" : "#e05555" }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: "#d4d4d4" }}
            >
              {passed ? "Tebrikler!" : "Testler Başarısız"}
            </span>
          </div>

          {/* XP kazanıldıysa göster */}
          {passed && xpEarned != null && xpEarned > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "#007acc22", color: "#007acc", border: "1px solid #007acc44" }}
            >
              +{xpEarned} XP
            </span>
          )}

          {/* Kapat × */}
          <button
            onClick={onClose}
            className="text-xs transition-colors"
            style={{ color: "#6e6e6e", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* ── PASSED: Review içeriği ──────────────────── */}
          {passed && review ? (
            <>
              {/* Yeni Kazanılan Rozetler */}
              {newBadges && newBadges.length > 0 && (
                <div
                  className="flex flex-col gap-3 p-3.5 rounded"
                  style={{
                    border: "1px solid rgba(234, 179, 8, 0.25)",
                    background: "rgba(234, 179, 8, 0.04)",
                  }}
                >
                  <div className="flex items-center gap-2 text-yellow-500 font-bold text-xs">
                    <span>🏆</span> YENİ ROZET KAZANDIN!
                  </div>
                  {newBadges.map((badge, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div
                        className="text-2xl p-2 rounded-lg"
                        style={{
                          background: "rgba(234, 179, 8, 0.08)",
                          border: "1px solid rgba(234, 179, 8, 0.15)",
                        }}
                      >
                        {badge.iconUrl}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-200">{badge.name}</span>
                        <span className="text-[10px] text-gray-400" style={{ lineHeight: 1.4 }}>
                          {badge.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Genel skor */}
              <div className="flex flex-col items-center gap-1 py-2">
                <span
                  className="font-bold tabular-nums"
                  style={{ fontSize: 52, lineHeight: 1, color: overallColor }}
                >
                  {review.overallScore}
                </span>
                <span className="text-xs" style={{ color: "#858585" }}>
                  {scoreLabel(review.overallScore)} · genel skor
                </span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#1e1e1e" }} />

              {/* 5 eksen */}
              <div className="flex flex-col gap-4">
                {AXES.map(({ key, label }) => (
                  <AxisRow key={key} label={label} value={review[key]} />
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#1e1e1e" }} />

              {/* Feedback kutuları */}
              <div className="flex flex-col gap-2.5">
                <FeedbackBox text={review.feedbackPositive}    variant="positive"    />
                <FeedbackBox text={review.feedbackImprovement} variant="improvement" />
              </div>

              {/* Karmaşıklık notu */}
              <div
                className="px-3 py-2 rounded text-xs"
                style={{
                  background: "#1e1e1e",
                  color:      "#858585",
                  border:     "1px solid #2a2a2a",
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                }}
              >
                {review.complexityNote}
              </div>
            </>
          ) : (
            /* ── FAILED: Testler geçilemedi ─────────────── */
            <div className="flex flex-col items-center gap-3 py-4">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 56, height: 56, background: "#e0555522", border: "1px solid #e0555540" }}
              >
                <span style={{ fontSize: 24, color: "#e05555" }}>✗</span>
              </div>
              <p className="text-sm text-center" style={{ color: "#d4d4d4", lineHeight: 1.7 }}>
                Test case'lerin bir kısmı geçilemedi.
              </p>
              <p className="text-xs text-center" style={{ color: "#858585", lineHeight: 1.7 }}>
                Sol panelde hangi test'lerin başarısız olduğunu görebilirsin.
                Kodu gözden geçirip tekrar gönderebilirsin.
              </p>
              <p
                className="text-xs text-center px-3 py-2 rounded"
                style={{ color: "#e2c08d", background: "#e2c08d18", border: "1px solid #e2c08d33" }}
              >
                −1 can harcandı
              </p>
            </div>
          )}
        </div>

        {/* ── Devam Et butonu ─────────────────────────── */}
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid #1e1e1e" }}
        >
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-full py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-75"
            style={{
              background: passed ? "#007acc" : "#3c3c3c",
              color:      "#ffffff",
              border:     "none",
              cursor:     "pointer",
              fontFamily: "inherit",
            }}
          >
            Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
