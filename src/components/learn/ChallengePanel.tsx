"use client";

// /src/components/learn/ChallengePanel.tsx
// CodeQuest — Challenge açıklaması + test case seçici

import { useState } from "react";

// ─── Tipler ──────────────────────────────────────────────────────

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  description?: string | null;
  hints?: string[];
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  hints: string[];
  difficulty: number;
  xpReward: number;
  testCases: TestCase[];
}

import type { TestResult } from "./TerminalPanel";

interface ChallengePanelProps {
  challenge: Challenge;
  testResults?: TestResult[];
  selectedTestIndex: number;
  completedTests: number[];         // Tamamlanan test index'leri
  onSelectTest: (index: number) => void;
}

// ─── Bileşen ──────────────────────────────────────────────────────

export function ChallengePanel({
  challenge,
  testResults,
  selectedTestIndex,
  completedTests,
  onSelectTest,
}: ChallengePanelProps) {
  const [activeTab, setActiveTab] = useState<"description" | "hints" | "tests">("description");
  const [expandedHints, setExpandedHints] = useState<number[]>([]);

  const selectedTest = challenge.testCases[selectedTestIndex];

  // Seçili test'in kendi açıklaması (boş string değilse) onu göster, yoksa challenge açıklaması
  const displayDescription = selectedTest?.description || challenge.description;

  // Seçili test'in kendi hint'leri varsa ve içi doluysa onları göster, yoksa challenge hint'leri
  const displayHints = selectedTest?.hints?.length ? selectedTest.hints : challenge.hints;

  const toggleHint = (index: number) => {
    setExpandedHints((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Test sonucu ikonları
  const getTestIcon = (index: number) => {
    if (completedTests.includes(index)) return "✓";
    const result = testResults?.[index];
    if (!result) return null;
    return result.passed ? "✓" : "✗";
  };

  const getTestColor = (index: number) => {
    if (completedTests.includes(index)) return "#6a9955";
    const result = testResults?.[index];
    if (!result) return "#858585";
    return result.passed ? "#6a9955" : "#e05555";
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden w-full md:w-[380px] shrink-0"
      style={{
        background: "#1e1e1e",
        borderRight: "1px solid #3c3c3c",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── Başlık ──────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #3c3c3c",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", margin: 0 }}>
            {challenge.title}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 3,
                background: "#007acc22",
                color: "#007acc",
                border: "1px solid #007acc44",
              }}
            >
              Lv.{challenge.difficulty}
            </span>
            <span style={{ fontSize: 10, color: "#6a9955" }}>
              +{challenge.xpReward} XP
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 1,
          background: "#252526",
          borderBottom: "1px solid #3c3c3c",
          padding: "0 8px",
        }}
      >
        {[
          { id: "description" as const, label: "Açıklama" },
          { id: "hints" as const, label: "İpuçları" },
          { id: "tests" as const, label: "Test Case'ler" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 11,
              background: activeTab === tab.id ? "#1e1e1e" : "transparent",
              color: activeTab === tab.id ? "#d4d4d4" : "#858585",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #007acc" : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── İçerik alanı ────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d4" }}
      >
        {/* Açıklama sekmesi */}
        {activeTab === "description" && (
          <div
            style={{ whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{ __html: displayDescription }}
          />
        )}

        {/* İpuçları sekmesi */}
        {activeTab === "hints" && (
          <div className="space-y-3">
            {displayHints.length === 0 ? (
              <p style={{ color: "#555", fontSize: 12 }}>Bu test için ipucu yok.</p>
            ) : (
              displayHints.map((hint, i) => (
                <div key={i}>
                  <button
                    onClick={() => toggleHint(i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#252526",
                      border: "1px solid #3c3c3c",
                      borderRadius: 4,
                      color: "#d4d4d4",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span>İpucu {i + 1}</span>
                    <span style={{ fontSize: 10, color: "#858585" }}>
                      {expandedHints.includes(i) ? "▼" : "▶"}
                    </span>
                  </button>
                  {expandedHints.includes(i) && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px 12px",
                        background: "#6a995518",
                        border: "1px solid #6a995540",
                        borderRadius: 4,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: "#9fcea8",
                      }}
                    >
                      {hint}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Test Case'ler sekmesi */}
        {activeTab === "tests" && (
          <div className="space-y-3">
            {/* Test seçici butonları */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {challenge.testCases.map((testCase, i) => {
                const isCompleted = completedTests.includes(i);
                const isSelected = selectedTestIndex === i;
                const icon = getTestIcon(i);
                const iconColor = getTestColor(i);

                return (
                  <button
                    key={testCase.id}
                    onClick={() => !isCompleted && onSelectTest(i)}
                    disabled={isCompleted}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: isSelected ? "#007acc22" : "#252526",
                      border: isSelected ? "1px solid #007acc" : "1px solid #3c3c3c",
                      borderRadius: 4,
                      color: isCompleted ? "#858585" : "#d4d4d4",
                      fontSize: 12,
                      cursor: isCompleted ? "not-allowed" : "pointer",
                      opacity: isCompleted ? 0.6 : 1,
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>Test {i + 1}</span>
                    {icon && (
                      <span style={{ fontSize: 14, color: iconColor, fontWeight: 700 }}>
                        {icon}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Seçili test detayları */}
            {selectedTest && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px",
                  background: "#252526",
                  border: "1px solid #3c3c3c",
                  borderRadius: 4,
                }}
              >
                <div style={{ fontSize: 11, color: "#858585", marginBottom: 8 }}>
                  Test {selectedTestIndex + 1} Detayları
                </div>

                {selectedTest.description && (
                  <div style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6, color: "#d4d4d4" }}>
                    {selectedTest.description}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#858585", marginBottom: 4 }}>
                      Girdi:
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: "6px 8px",
                        background: "#1e1e1e",
                        border: "1px solid #3c3c3c",
                        borderRadius: 3,
                        fontSize: 11,
                        color: "#ce9178",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontFamily: "inherit",
                      }}
                    >
                      {selectedTest.input || "(boş)"}
                    </pre>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "#858585", marginBottom: 4 }}>
                      Beklenen Çıktı:
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: "6px 8px",
                        background: "#1e1e1e",
                        border: "1px solid #3c3c3c",
                        borderRadius: 3,
                        fontSize: 11,
                        color: "#9cdcfe",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontFamily: "inherit",
                      }}
                    >
                      {selectedTest.expectedOutput}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}