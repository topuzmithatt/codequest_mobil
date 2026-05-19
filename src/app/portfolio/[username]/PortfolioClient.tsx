"use client";

// /src/app/portfolio/[username]/PortfolioClient.tsx

import { useState, useEffect } from "react";
import { VSCodeLayout } from "@/components/layout/VSCodeLayout";

interface ReviewData {
  overallScore:        number;
  correctness:         number;
  readability:         number;
  timeComplexity:      number;
  spaceComplexity:     number;
  idiomaticStyle:      number;
  feedbackPositive:    string | null;
  feedbackImprovement: string | null;
  complexityNote:      string | null;
}

interface SubmissionData {
  id:           string;
  code:         string;
  language:     string;
  createdAt:    Date;
  isPublic:     boolean;
  reviewResult: ReviewData | null;
}

interface PortfolioClientProps {
  owner:       { username: string; level: number };
  submissions: SubmissionData[];
  isOwner:     boolean;
  viewer:      { id: string; hearts: number; xp: number; level: number; username: string } | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#6a9955";
  if (score >= 60) return "#e2c08d";
  return "#e05555";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Mükemmel";
  if (score >= 60) return "İyi";
  if (score >= 40) return "Geliştirilmeli";
  return "Yetersiz";
}

const LANG_COLORS: Record<string, string> = {
  PYTHON: "#ffda4b", JAVASCRIPT: "#f7df1e", JAVA: "#e07c5a",
  SQL: "#e8b84b", CSHARP: "#9b4f96", GO: "#00acd7",
  RUST: "#ce422b", KOTLIN: "#7f52ff", SWIFT: "#f05138",
  R: "#2167ba", HTML_CSS: "#e34c26",
};

const LANG_LABELS: Record<string, string> = {
  PYTHON: "Python", JAVASCRIPT: "JavaScript", JAVA: "Java",
  SQL: "SQL", CSHARP: "C#", GO: "Go", RUST: "Rust",
  KOTLIN: "Kotlin", SWIFT: "Swift", R: "R", HTML_CSS: "HTML/CSS",
};

type ScoreKeys = "correctness" | "readability" | "timeComplexity" | "spaceComplexity" | "idiomaticStyle";

const AXES: { key: ScoreKeys; label: string }[] = [
  { key: "correctness",     label: "Doğruluk"          },
  { key: "readability",     label: "Okunabilirlik"      },
  { key: "timeComplexity",  label: "Zaman Karmaşıklığı" },
  { key: "spaceComplexity", label: "Alan Karmaşıklığı"  },
  { key: "idiomaticStyle",  label: "Dil Stili"          },
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 5, background: "#3c3c3c", borderRadius: 9999, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: "100%", background: color, borderRadius: 9999 }} />
    </div>
  );
}

function LangBadge({ language }: { language: string }) {
  const color = LANG_COLORS[language] ?? "#858585";
  const label = LANG_LABELS[language] ?? language;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 10px", borderRadius: 4, fontSize: 11,
      background: color + "22", color, border: `1px solid ${color}44`,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export function PortfolioClient({ owner, submissions: initialSubmissions, isOwner, viewer }: PortfolioClientProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [showTour, setShowTour] = useState(false);
  const [isTour, setIsTour] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tour') === 'true' && isOwner) {
      setIsTour(true);
      setShowTour(true);
    }
  }, [isOwner]);

  const completeTour = () => {
    setShowTour(false);
    if (isTour) {
      window.location.href = '/profile?tour=true';
    }
  };

  const handleToggleVisibility = async (submissionId: string) => {
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return;

    setSubmissions((prev) =>
      prev.map((s) => (s.id === submissionId ? { ...s, isPublic: !s.isPublic } : s))
    );

    try {
      const res = await fetch("/api/submission/visibility", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ submissionId, isPublic: !sub.isPublic }),
      });
      if (!res.ok) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? { ...s, isPublic: sub.isPublic } : s))
        );
      }
    } catch {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, isPublic: sub.isPublic } : s))
      );
    }
  };

  const handleDelete = async (submissionId: string) => {
    setDeletingId(submissionId);
    try {
      const res = await fetch(`/api/sandbox/portfolio?id=${submissionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      } else {
        alert("Silme işlemi başarısız oldu.");
      }
    } catch {
      alert("Sunucu hatası.");
    } finally {
      setDeletingId(null);
    }
  };

  const publicCount = submissions.filter((s) => s.isPublic).length;

  return (
    <div style={{ display: "contents" }}>
      {viewer ? (
        <VSCodeLayout
          userId={viewer.id}
          hearts={viewer.hearts}
          xp={viewer.xp}
          level={viewer.level}
          streak={0}
          username={viewer.username}
        >
          <PortfolioContent />
        </VSCodeLayout>
      ) : (
        <PortfolioContent />
      )}

      {/* Silme Onay Modalı */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}
        >
          <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 8, padding: 24, width: "90%", maxWidth: 340, fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box" }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑️</div>
            <h3 style={{ color: "#e05555", fontSize: 16, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Portfolyodan Sil</h3>
            <p style={{ color: "#d4d4d4", fontSize: 12, marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>
              Bu kodu portfolyondan silmek istediğine emin misin? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{ padding: "8px 16px", background: "#3c3c3c", border: "1px solid #555", borderRadius: 4, color: "#d4d4d4", fontSize: 12, cursor: "pointer", flex: 1 }}
              >
                İptal
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                style={{ padding: "8px 16px", background: "#e0555522", border: "1px solid #e0555544", borderRadius: 4, color: "#e05555", fontSize: 12, cursor: "pointer", flex: 1, fontWeight: 700 }}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function PortfolioContent() {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: "#1e1e1e", color: "#d4d4d4", fontFamily: "'JetBrains Mono', monospace", position: "relative" }}>

      {/* Portfolyo tur modalı */}
      {showTour && (
        <>
          <div className="absolute inset-0 z-40 bg-black/50 pointer-events-none" style={{ position: "fixed" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[384px] pointer-events-auto bg-[#1e1e1e] border border-teal-500 text-white p-6 rounded-lg shadow-2xl z-50" style={{ position: "fixed" }}>
            <div className="text-4xl mb-4 text-center">📁</div>
            <h3 className="font-bold text-xl mb-3 text-teal-400 text-center">Portfolyo</h3>
            <p className="text-sm mb-4 text-gray-300 leading-relaxed">
              Yazdığın kodları burada sergiliyorsun. Görevlerden veya Sandbox'tan eklediğin çalışmaların hep burada.
              <br/><br/>
              Kodlarını herkese açık/gizli yapabilir, AI'ın verdiği kalite puanlarını görebilirsin.
            </p>
            <button onClick={completeTour} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded text-sm font-bold transition-colors w-full">
              {isTour ? "Tamam, profile geçelim →" : "Anlaşıldı!"}
            </button>
          </div>
        </>
      )}

      {/* Başlık çubuğu kaldırıldı çünkü VSCodeLayout içinde var */}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 700, fontSize: 18,
            background: "#007acc22", border: "1px solid #007acc44", color: "#007acc",
          }}>
            {owner.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#d4d4d4" }}>
              {owner.username}
            </div>
            <div style={{ fontSize: 11, color: "#858585", marginTop: 2 }}>
              Lv.{owner.level} · {publicCount} public proje
              {isOwner && submissions.length > publicCount && (
                <span style={{ color: "#555", marginLeft: 8 }}>
                  ({submissions.length - publicCount} private)
                </span>
              )}
            </div>
          </div>
        </div>

        {submissions.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center", borderRadius: 8,
            background: "#252526", border: "1px solid #3c3c3c", color: "#555", fontSize: 13,
          }}>
            {isOwner ? "Henüz portfolyo yok. Sandbox'ta kod yaz ve portfolyoya ekle." : "Henüz public portfolio yok."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {submissions.map((sub) => {
            const review = sub.reviewResult;
            const oScore = review?.overallScore ?? 0;
            const oColor = scoreColor(oScore);

            return (
              <div key={sub.id} style={{
                background: "#252526", border: "1px solid #3c3c3c",
                borderRadius: 8, overflow: "hidden",
                opacity: !sub.isPublic && isOwner ? 0.6 : 1,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 8,
                  padding: "12px 16px", borderBottom: "1px solid #1e1e1e",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <LangBadge language={sub.language} />
                    <span style={{ fontSize: 11, color: "#555" }}>
                      {new Date(sub.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {isOwner && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleToggleVisibility(sub.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "4px 10px", borderRadius: 4, fontSize: 10,
                            background: sub.isPublic ? "#6a995522" : "#3c3c3c",
                            color: sub.isPublic ? "#6a9955" : "#858585",
                            border: `1px solid ${sub.isPublic ? "#6a995544" : "#555"}`,
                            cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                          }}
                          title={sub.isPublic ? "Herkese açık" : "Sadece sen görebilirsin"}
                        >
                          <span>{sub.isPublic ? "🌐" : "🔒"}</span>
                          <span>{sub.isPublic ? "Public" : "Private"}</span>
                        </button>
                        <button
                          onClick={() => setDeletingId(sub.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "4px 10px", borderRadius: 4, fontSize: 10,
                            background: "#e0555522",
                            color: "#e05555",
                            border: "1px solid #e0555544",
                            cursor: "pointer",
                            fontFamily: "inherit", fontWeight: 600,
                          }}
                          title="Portfolyodan Sil"
                        >
                          <span>🗑️</span>
                          <span>Sil</span>
                        </button>
                      </div>
                    )}

                    {review && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: oColor, lineHeight: 1 }}>{oScore}</span>
                        <span style={{ fontSize: 11, color: "#858585" }}>{scoreLabel(oScore)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e1e" }}>
                  <pre style={{
                    margin: 0, fontSize: 12, lineHeight: 1.7, color: "#ce9178", overflowX: "auto",
                    fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap",
                    wordBreak: "break-all", maxHeight: 320, overflowY: "auto",
                  }}>
                    {sub.code}
                  </pre>
                </div>

                {review && (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {AXES.map(({ key, label }) => {
                        const val   = review[key] ?? 0;
                        const color = scoreColor(val);
                        return (
                          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, color: "#858585" }}>{label}</span>
                              <span style={{ fontSize: 10, color, fontWeight: 600 }}>{val}</span>
                            </div>
                            <ProgressBar value={val} color={color} />
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {review.feedbackPositive && (
                        <div style={{
                          display: "flex", gap: 8, padding: "8px 12px", borderRadius: 6, fontSize: 11,
                          lineHeight: 1.6, background: "#6a995518", border: "1px solid #6a995540", color: "#9fcea8",
                        }}>
                          <span style={{ fontWeight: 700, marginTop: 1 }}>✓</span>
                          <span>{review.feedbackPositive}</span>
                        </div>
                      )}
                      {review.feedbackImprovement && (
                        <div style={{
                          display: "flex", gap: 8, padding: "8px 12px", borderRadius: 6, fontSize: 11,
                          lineHeight: 1.6, background: "#e2c08d18", border: "1px solid #e2c08d40", color: "#e2c08d",
                        }}>
                          <span style={{ fontWeight: 700, marginTop: 1 }}>→</span>
                          <span>{review.feedbackImprovement}</span>
                        </div>
                      )}
                      {review.complexityNote && (
                        <div style={{
                          padding: "6px 12px", borderRadius: 6, fontSize: 11,
                          lineHeight: 1.6, background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#858585",
                        }}>
                          {review.complexityNote}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 40, textAlign: "center", fontSize: 10, color: "#3c3c3c" }}>
          CodeQuest · codequest.dev
        </div>
      </div>
    </div>
  );
}
}