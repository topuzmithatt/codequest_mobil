"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { VSCodeLayout }          from "@/components/layout/VSCodeLayout";
import { EditorPanel }           from "@/components/learn/EditorPanel";
import { TerminalPanel }         from "@/components/learn/TerminalPanel";
import { ReviewModal }           from "@/components/learn/ReviewModal";
import type { EditorTab }        from "@/components/layout/VSCodeLayout";
import type { TestResult }       from "@/components/learn/TerminalPanel";
import type { ReviewData }       from "@/components/learn/ReviewModal";

interface SandboxClientProps {
  userId:   string;
  hearts:   number;
  xp:       number;
  level:    number;
  streak:   number;
  username: string;
}

function PortfolioModal({
  open,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onConfirm: (isPublic: boolean) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 8, padding: 24, width: "90%", maxWidth: 320, fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box" }}>
        <p style={{ color: "#d4d4d4", fontSize: 13, marginBottom: 16 }}>Bu kodu portfolyona eklemek istiyor musun?</p>
        <p style={{ color: "#858585", fontSize: 11, marginBottom: 20 }}>Görünürlük ayarını seç:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => onConfirm(true)} style={{ padding: "10px 16px", background: "#007acc22", border: "1px solid #007acc44", borderRadius: 4, color: "#9cdcfe", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
            🌐 Public — herkes görebilir
          </button>
          <button onClick={() => onConfirm(false)} style={{ padding: "10px 16px", background: "#3c3c3c22", border: "1px solid #3c3c3c", borderRadius: 4, color: "#d4d4d4", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
            🔒 Private — sadece sen görebilirsin
          </button>
          <button onClick={onClose} style={{ padding: "6px 16px", background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", marginTop: 4 }}>
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

export function SandboxClient({ userId, hearts, xp, level, streak, username }: SandboxClientProps) {
  const [terminalOutput,   setTerminalOutput]   = useState<string | undefined>(undefined);
  const [terminalError,    setTerminalError]    = useState(false);
  const [isRunning,        setIsRunning]        = useState(false);
  const [reviewOpen,       setReviewOpen]       = useState(false);
  const [reviewData,       setReviewData]       = useState<ReviewData | undefined>(undefined);
  const [portfolioModal,   setPortfolioModal]   = useState(false);
  const [pendingPortfolio, setPendingPortfolio] = useState<{ code: string; language: string } | null>(null);
  const [currentCode,      setCurrentCode]      = useState("");
  const [currentLang,      setCurrentLang]      = useState("PYTHON");
  const [showSandboxTour,  setShowSandboxTour]  = useState(false);
  
  // Mobil tab bar secimi
  const [sandboxTab, setSandboxTab] = useState<"editor" | "terminal">("editor");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tour') === 'true') {
      setShowSandboxTour(true);
    }
  }, []);

  const runWithStdinRef = useRef<((stdin: string) => void) | null>(null);

  const tabs: EditorTab[] = [
    { id: "sandbox", label: "sandbox.py", lang: "py" },
  ];

  const handleRunResult = useCallback((output: string, isError: boolean) => {
    setTerminalOutput(output);
    setTerminalError(isError);
    setIsRunning(false);
  }, []);

  const handleTestResults = useCallback((_results: TestResult[]) => {}, []);

  const handleReviewReady = useCallback((_submissionId: string, data: any) => {
    if (data.review) setReviewData(data.review);
    setReviewOpen(true);
  }, []);

  const handlePortfolioRequest = useCallback((code: string, language: string) => {
    setPendingPortfolio({ code, language });
    setPortfolioModal(true);
  }, []);

  const handlePortfolioConfirm = useCallback(async (isPublic: boolean) => {
    setPortfolioModal(false);
    if (!pendingPortfolio) return;
    try {
      const res  = await fetch("/api/sandbox/portfolio", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...pendingPortfolio, isPublic }),
      });
      const data = await res.json();
      if (res.ok && data.review) {
        setReviewData(data.review);
        setReviewOpen(true);
      } else if (!res.ok) {
        alert(data.message ?? data.error ?? "Portfolyo eklenemedi.");
      }
    } catch {
      alert("Sunucu hatası.");
    } finally {
      setPendingPortfolio(null);
    }
  }, [pendingPortfolio]);

  const handleTerminalRun = useCallback((stdin: string) => {
    runWithStdinRef.current?.(stdin);
  }, []);

  return (
    <VSCodeLayout userId={userId} tabs={tabs} hearts={hearts} xp={xp} level={level} streak={streak} username={username}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Mobile Tabs Switcher */}
        <div className="flex md:hidden bg-[#252526] border-b border-[#3c3c3c] shrink-0 select-none">
          <button
            onClick={() => setSandboxTab("editor")}
            className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-all ${
              sandboxTab === "editor" ? "text-green-400 border-green-500 bg-[#1e1e1e]" : "text-gray-400 border-transparent"
            }`}
          >
            💻 Kod Editörü
          </button>
          <button
            onClick={() => setSandboxTab("terminal")}
            className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-all ${
              sandboxTab === "terminal" ? "text-amber-500 border-amber-500 bg-[#1e1e1e]" : "text-gray-400 border-transparent"
            }`}
          >
            🖥️ Terminal
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className={`flex-1 overflow-hidden md:block ${sandboxTab === "editor" ? "block h-full" : "hidden"}`}>
            <EditorPanel
              isSandbox
              onRunResult={handleRunResult}
              onTestResults={handleTestResults}
              onReviewReady={handleReviewReady}
              onPortfolioRequest={handlePortfolioRequest}
              onRunReady={(fn) => { runWithStdinRef.current = fn; }}
              onCodeChange={(c, l) => { setCurrentCode(c); setCurrentLang(l); }}
              onRunRequest={() => setIsRunning(true)}
            />
          </div>

          <div className={`md:block ${sandboxTab === "terminal" ? "block flex-1 h-full" : "hidden"}`}>
            <TerminalPanel
              output={terminalOutput}
              isError={terminalError}
              isRunning={isRunning}
              code={currentCode}
              language={currentLang}
              onRun={() => {}}
            />
          </div>
        </div>
      </div>

      <PortfolioModal
        open={portfolioModal}
        onConfirm={handlePortfolioConfirm}
        onClose={() => { setPortfolioModal(false); setPendingPortfolio(null); }}
      />

      <ReviewModal
        open={reviewOpen}
        passed={true}
        review={reviewData}
        onClose={() => { setReviewOpen(false); setReviewData(undefined); }}
      />

      {/* Sandbox tur modalı */}
      {showSandboxTour && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 pointer-events-none" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[384px] pointer-events-auto bg-[#1e1e1e] border border-amber-500 text-white p-6 rounded-lg shadow-2xl z-50">
            <div className="text-4xl mb-4 text-center">🧪</div>
            <h3 className="font-bold text-xl mb-3 text-amber-400 text-center">Sandbox</h3>
            <p className="text-sm mb-4 text-gray-300 leading-relaxed">
              Burası serbest kodlama alanın! Görev olmadan istediğin kodu yazabilir, çalıştırabilir ve hatta portfolyona ekleyebilirsin.
              <br/><br/>
              Python, JavaScript, Java ve SQL destekleniyor.
            </p>
            <button
              onClick={() => {
                setShowSandboxTour(false);
                window.location.href = `/portfolio/${username}?tour=true`;
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded text-sm font-bold transition-colors w-full"
            >
              Tamam, portfolyoya geçelim →
            </button>
          </div>
        </>
      )}
    </VSCodeLayout>
  );
}