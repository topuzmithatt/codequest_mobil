"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { VSCodeLayout } from "@/components/layout/VSCodeLayout";
import { ChallengePanel } from "@/components/learn/ChallengePanel";
import { EditorPanel } from "@/components/learn/EditorPanel";
import { TerminalPanel } from "@/components/learn/TerminalPanel";
import { ReviewModal } from "@/components/learn/ReviewModal";
import type { EditorTab } from "@/components/layout/VSCodeLayout";
import type { TestResult } from "@/components/learn/TerminalPanel";
import type { ReviewData } from "@/components/learn/ReviewModal";
import type { Challenge } from "@prisma/client";

interface ChallengeWithTests extends Omit<Challenge, "testCases"> {
  testCases: {
    id: string;
    input: string;
    expectedOutput: string;
    description?: string | null;
    hints?: string[];
  }[];
}

interface LearnClientProps {
  challenge: ChallengeWithTests;
  learningPathId: string;
  userId: string;
  hearts: number;
  xp: number;
  level: number;
  streak: number;
}

const LANG_EXT: Record<string, EditorTab["lang"]> = {
  PYTHON: "py", JAVASCRIPT: "js", JAVA: "java", SQL: "sql",
};

export function LearnClient({
  challenge,
  learningPathId,
  userId,
  hearts,
  xp,
  level,
  streak,
}: LearnClientProps) {
  const [terminalOutput, setTerminalOutput] = useState<string | undefined>(undefined);
  const [terminalError, setTerminalError] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | undefined>(undefined);
  const [submissionPassed, setSubmissionPassed] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | undefined>(undefined);
  const [newBadges, setNewBadges] = useState<{ name: string; iconUrl: string; description: string }[]>([]);
  const [selectedTestIndex, setSelectedTestIndex] = useState(0);
  const [completedTests, setCompletedTests] = useState<number[]>([]);
  const [currentCode, setCurrentCode] = useState(challenge?.starterCode ?? "");
  const [currentLang, setCurrentLang] = useState<string>(challenge?.language ?? "PYTHON");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const [stageComplete, setStageComplete] = useState(false);
  const [stageSummary, setStageSummary] = useState<{ timeStr: string; failedAttempts: number } | null>(null);

  // Hearts local state — submit sonucu güncellenir
  const [currentHearts, setCurrentHearts] = useState(hearts);

  // Mobil tab bar secimi
  const [mobileTab, setMobileTab] = useState<"challenge" | "editor" | "terminal">("challenge");

  // Tur sistemi
  const [tourStep, setTourStep] = useState(0);
  const [showFinishedModal, setShowFinishedModal] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tour') === 'finished') {
      setShowFinishedModal(true);
    } else if (urlParams.get('tour') === 'true') {
      setTourStep(1);
    }
  }, []);

  // Tur adimina gore mobil tab degistir
  useEffect(() => {
    if (tourStep === 1) {
      setMobileTab("challenge");
    } else if (tourStep === 2) {
      setMobileTab("editor");
    } else if (tourStep === 3) {
      setMobileTab("terminal");
    }
  }, [tourStep]);

  // AI İpucu state'leri
  const MAX_AI_HINTS = 3;
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(0);

  // Challenge değişince AI hint hakkını ve aşama state'lerini sıfırla
  useEffect(() => {
    setAiUsed(0);
    setAiHint("");
    setAiOpen(false);
    setFailedAttempts(0);
    startTimeRef.current = Date.now();
    setStageComplete(false);
    setStageSummary(null);
  }, [challenge.id]);

  // EditorPanel'deki run fonksiyonuna dışarıdan stdin ile erişmek için ref
  const runWithStdinRef = useRef<((stdin: string) => void) | null>(null);
  // TerminalPanel'in socket emit fonksiyonuna erişmek için ref
  const terminalRunRef = useRef<((code: string, language: string) => void) | null>(null);

  const tabs: EditorTab[] = [
    {
      id: "challenge",
      label: `${challenge.topic}.${LANG_EXT[challenge.language] ?? "ts"}`,
      lang: LANG_EXT[challenge.language] ?? "ts",
    },
  ];

  const handleRunResult = useCallback((output: string, isError: boolean) => {
    setTerminalOutput(output);
    setTerminalError(isError);
    setIsRunning(false);
  }, []);

  const handleTestResults = useCallback((results: TestResult[]) => {
    setTestResults(results);
  }, []);

  const handleSelectTest = useCallback((index: number) => {
    setSelectedTestIndex(index);
  }, []);

  const handleReviewReady = useCallback((_submissionId: string, data: any) => {
    console.log("🎯 SUBMIT SONRASI GELEN DATA:", data); // BUNU EKLE

    // ... kodun devamı    
    if (data.review) setReviewData(data.review);
    setSubmissionPassed(!!data.passed);
    if (data.gamification?.xpResult?.xpEarned != null) {
      setXpEarned(Math.max(0, data.gamification.xpResult.xpEarned));
    }
    // Hearts azaltma — yanlış cevap gelince UI'ı güncelle
    if (data.gamification?.heartResult != null) {
      setCurrentHearts(data.gamification.heartResult.newHearts);
    }
    if (data.gamification?.newBadges) {
      setNewBadges(data.gamification.newBadges);
    } else {
      setNewBadges([]);
    }
    if (data.passed) {
      setCompletedTests((prev) =>
        prev.includes(selectedTestIndex) ? prev : [...prev, selectedTestIndex]
      );
    } else {
      setFailedAttempts(prev => prev + 1);
    }
    setReviewOpen(true);
  }, [selectedTestIndex]);

  const handleTerminalRun = useCallback((stdin: string) => {
    runWithStdinRef.current?.(stdin);
  }, []);

  const handleTerminalRunReady = useCallback((fn: (code: string, language: string) => void) => {
    terminalRunRef.current = fn;
    (window as any)._dbg_terminalRun = fn; // debug
    console.log('terminalRunRef set edildi');
  }, []);

  const handleReviewClose = useCallback(() => {
    setReviewOpen(false);
    setReviewData(undefined);

    const isJustCompleted = submissionPassed;
    const newCompleted = isJustCompleted && !completedTests.includes(selectedTestIndex)
      ? completedTests.length + 1
      : completedTests.length;

    if (newCompleted >= challenge.testCases.length) {
      setStageComplete(true);
      const timeSpentSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const mins = Math.floor(timeSpentSec / 60);
      const secs = timeSpentSec % 60;
      setStageSummary({
        timeStr: `${mins}dk ${secs}sn`,
        failedAttempts,
      });
    } else if (submissionPassed && selectedTestIndex < challenge.testCases.length - 1) {
      setSelectedTestIndex(selectedTestIndex + 1);
    }
  }, [completedTests, selectedTestIndex, submissionPassed, challenge.testCases.length, failedAttempts]);

  const askAI = async () => {
    if (aiUsed >= MAX_AI_HINTS) return;
    setAiLoading(true);
    setAiHint("");
    try {
      const res = await fetch("/api/ai-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          language: currentLang,
          challengeDescription: challenge.description,
          errorOutput: terminalError ? terminalOutput : null,
        }),
      });
      const data = await res.json();
      setAiHint(data.hint || data.error || "Bir hata oluştu.");
      setAiUsed(prev => prev + 1);
    } catch {
      setAiHint("Sunucuya bağlanılamadı, tekrar dene.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <VSCodeLayout
      userId={userId}
      tabs={tabs}
      hearts={currentHearts}
      xp={xp}
      level={level}
      streak={streak}
    >
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* Mobile Tabs Switcher */}
        <div className="flex md:hidden bg-[#252526] border-b border-[#3c3c3c] shrink-0 select-none">
          <button
            onClick={() => setMobileTab("challenge")}
            className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-all ${
              mobileTab === "challenge" ? "text-blue-400 border-blue-500 bg-[#1e1e1e]" : "text-gray-400 border-transparent"
            }`}
          >
            📝 Görev
          </button>
          <button
            onClick={() => setMobileTab("editor")}
            className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-all ${
              mobileTab === "editor" ? "text-green-400 border-green-500 bg-[#1e1e1e]" : "text-gray-400 border-transparent"
            }`}
          >
            💻 Kod
          </button>
          <button
            onClick={() => setMobileTab("terminal")}
            className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-all ${
              mobileTab === "terminal" ? "text-amber-500 border-amber-500 bg-[#1e1e1e]" : "text-gray-400 border-transparent"
            }`}
          >
            🖥️ Terminal {testResults ? `(${testResults.filter(r => r.passed).length}/${challenge.testCases.length})` : ""}
          </button>
        </div>

        <div className="flex flex-1 h-full overflow-hidden relative">
          {/* Tur overlay */}
          {tourStep > 0 && (
            <div className="absolute inset-0 z-40 pointer-events-none bg-black/40" />
          )}

          {/* Hazırsın! modalı */}
          {showFinishedModal && (
            <>
              <div className="absolute inset-0 z-40 bg-black/60 pointer-events-auto" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] pointer-events-auto bg-[#1e1e1e] border border-green-500 text-white p-8 rounded-lg shadow-2xl z-50 flex flex-col items-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="font-bold text-2xl mb-3 text-green-400 text-center">Hazırsın!</h3>
                <p className="text-sm mb-6 text-gray-300 text-center leading-relaxed">
                  Platformu tanıma turunu tamamladın. Artık görevleri çözmeye başlayabilirsin — bol bol pratik yap, XP kazan ve sıralamada yüksel!
                </p>
                <button
                  onClick={() => {
                    setShowFinishedModal(false);
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg text-sm font-bold transition-colors w-full shadow-lg"
                >
                  Hadi Başlayalım!
                </button>
              </div>
            </>
          )}

          {/* ChallengePanel wrapper */}
          <div className={`relative shrink-0 md:block ${mobileTab === "challenge" ? "block w-full h-full" : "hidden"} ${tourStep === 1 ? 'z-50 ring-4 ring-blue-500 rounded-lg shadow-[0_0_30px_rgba(59,130,246,0.5)]' : ''}`}>
            <ChallengePanel
              challenge={challenge}
              testResults={testResults}
              selectedTestIndex={selectedTestIndex}
              completedTests={completedTests}
              onSelectTest={handleSelectTest}
            />
            {tourStep === 1 && (
              <div className="absolute top-[20%] left-4 right-4 md:left-full md:ml-4 w-auto md:w-72 pointer-events-auto bg-[#1e1e1e] border border-blue-500 text-white p-5 rounded-lg shadow-2xl z-50">
                <h3 className="font-bold text-lg mb-2 text-blue-400">Görev Paneli</h3>
                <p className="text-sm mb-4 text-gray-300">Çözmesi gereken görev burada. Ne yapman gerektiğini ve beklenen çıktıyı buradan okuyabilirsin.</p>
                <button onClick={() => setTourStep(2)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors w-full">Anladım, sıradaki →</button>
              </div>
            )}
          </div>

          <div className={`flex-col flex-1 overflow-hidden md:flex ${mobileTab !== "challenge" ? "flex h-full w-full" : "hidden"}`}>
            <div className={`flex-1 overflow-hidden relative md:block ${mobileTab === "editor" ? "block w-full h-full" : "hidden"} ${tourStep === 2 ? 'z-50 ring-4 ring-green-500 rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.5)]' : ''}`}>
              <EditorPanel
                challenge={challenge}
                learningPathId={learningPathId}
                selectedTestIndex={selectedTestIndex}
                onRunResult={handleRunResult}
                onTestResults={handleTestResults}
                onReviewReady={handleReviewReady}
                onRunReady={(fn) => { runWithStdinRef.current = fn; }}
                onCodeChange={(c, l) => { setCurrentCode(c); setCurrentLang(l); }}
                onRunRequest={() => {
                  setIsRunning(true);
                  // terminalRunRef bağlıysa direkt socket emit yap
                  if (terminalRunRef.current) {
                    terminalRunRef.current(currentCode, currentLang);
                  }
                }}
              />
              {tourStep === 2 && (
                <div className="absolute top-[30%] left-4 right-4 md:left-1/2 md:-translate-x-1/2 w-auto md:w-80 pointer-events-auto bg-[#1e1e1e] border border-green-500 text-white p-5 rounded-lg shadow-2xl z-50">
                  <h3 className="font-bold text-lg mb-2 text-green-400">Kod Editörü</h3>
                  <p className="text-sm mb-4 text-gray-300">Kodunu buraya yazıyorsun. VS Code'a benzer bir editör — otomatik tamamlama ve sözdizimi vurgulaması var.</p>
                  <button onClick={() => setTourStep(3)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors w-full">Tamam, anladım →</button>
                </div>
              )}
            </div>

            <div className={`relative md:block ${mobileTab === "terminal" ? "block w-full flex-1" : "hidden"} ${tourStep === 3 ? 'z-50 ring-4 ring-purple-500 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.5)]' : ''}`}>
              <TerminalPanel
                output={terminalOutput}
                isError={terminalError}
                testResults={testResults}
                isRunning={isRunning}
                code={currentCode}
                language={currentLang}
                onRun={() => { }}
                onRunReady={handleTerminalRunReady}
                onFinished={() => setIsRunning(false)} // İŞTE EKLENEN KRİTİK SATIR BURASI!
              />
              {tourStep === 3 && (
                <div className="absolute bottom-[110%] right-4 left-4 md:right-[10%] md:left-auto w-auto md:w-80 pointer-events-auto bg-[#1e1e1e] border border-purple-500 text-white p-5 rounded-lg shadow-2xl z-50">
                  <h3 className="font-bold text-lg mb-2 text-purple-400">Terminal</h3>
                  <p className="text-sm mb-4 text-gray-300">Kodunu çalıştırınca çıktısı burada görünür. input() gibi kullanıcıdan veri alan komutlar için de bu terminali kullanabilirsin.</p>
                  <button onClick={() => setTourStep(4)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors w-full">Süper! →</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tur adım 4 — Sandbox yönlendirme */}
      {tourStep === 4 && (
        <div className="fixed top-[90px] left-4 right-4 md:left-16 md:right-auto w-auto md:w-72 pointer-events-auto bg-[#1e1e1e] border border-orange-500 text-white p-4 rounded-lg shadow-2xl z-50">
          <h3 className="font-bold text-base mb-1 text-orange-400">Sandbox</h3>
          <p className="text-sm mb-3 text-gray-300">Görev olmadan serbest kod yazmak istersen Sandbox tam sana göre. Hadi bir bakalım!</p>
          <button onClick={() => window.location.href = '/sandbox?tour=true'} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors w-full">
            Sandbox'a Git →
          </button>
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        passed={submissionPassed}
        review={reviewData}
        xpEarned={xpEarned}
        newBadges={newBadges}
        onClose={handleReviewClose}
      />

      {/* AI İpucu Butonu */}
      <button
        onClick={() => { setAiOpen(!aiOpen); if (!aiOpen && !aiHint && aiUsed < MAX_AI_HINTS) askAI(); }}
        className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${aiUsed >= MAX_AI_HINTS ? 'bg-gray-600 opacity-60' : 'bg-gradient-to-br from-violet-600 to-indigo-600'}`}
        title={aiUsed >= MAX_AI_HINTS ? `Bu görev için ${MAX_AI_HINTS} hakkını kullandın` : 'AI Asistan'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.73-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
          <circle cx="10" cy="14" r="1.5" fill="currentColor" />
          <circle cx="14" cy="14" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {/* AI İpucu Paneli */}
      {aiOpen && (
        <div className="fixed bottom-36 md:bottom-24 right-4 md:right-8 z-50 w-[calc(100vw-32px)] sm:w-[360px] bg-[#1e1e1e] border border-violet-500/50 rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-violet-500/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="text-sm font-semibold text-violet-300">AI Asistan</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${aiUsed >= MAX_AI_HINTS ? 'bg-red-500/20 text-red-400' : 'bg-violet-500/20 text-violet-300'}`}>
                {MAX_AI_HINTS - aiUsed}/{MAX_AI_HINTS}
              </span>
            </div>
            <button onClick={() => setAiOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto">
            {aiLoading ? (
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                Kodunu inceliyorum...
              </div>
            ) : aiHint ? (
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{aiHint}</p>
            ) : (
              <p className="text-sm text-gray-500">Yardım almak için butona bas.</p>
            )}
          </div>
          <div className="px-4 py-3 border-t border-[#3c3c3c]">
            {aiUsed >= MAX_AI_HINTS ? (
              <p className="text-xs text-center text-red-400 py-1">Bu görev için {MAX_AI_HINTS} ipucu hakkını kullandın.</p>
            ) : (
              <button
                onClick={askAI}
                disabled={aiLoading}
                className="w-full py-2 rounded text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {aiLoading ? "Düşünüyorum..." : `Tekrar Sor (${MAX_AI_HINTS - aiUsed} kaldı)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Aşama Tamamlandı Modalı */}
      {stageComplete && stageSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 pointer-events-auto">
          <div className="w-[400px] bg-[#1e1e1e] border border-green-500 text-white p-8 rounded-lg shadow-2xl flex flex-col items-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="font-bold text-2xl mb-3 text-green-400 text-center">Aşama Tamamlandı!</h3>

            <div className="flex flex-col gap-3 w-full mb-6 bg-[#252526] p-4 rounded border border-[#3c3c3c]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Tamamlama Süresi:</span>
                <span className="text-white font-mono">{stageSummary.timeStr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Hatalı Deneme:</span>
                <span className="text-red-400 font-mono">{stageSummary.failedAttempts} ❤️</span>
              </div>
            </div>

            <p className="text-sm mb-6 text-gray-300 text-center leading-relaxed">
              Harika iş çıkardın! Şimdi bir sonraki aşamaya geçiyoruz.
            </p>
            <button
              onClick={() => {
                // Cache-busting query parameter (?t=timestamp) ekleyerek tarayıcı ve CDN cache'lerini tamamen by-pass ederiz
                const searchParams = new URLSearchParams(window.location.search);
                searchParams.set("t", Date.now().toString());
                window.location.href = window.location.pathname + "?" + searchParams.toString();
              }}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg text-sm font-bold transition-colors w-full shadow-lg"
            >
              Sıradaki Aşamaya Geç →
            </button>
          </div>
        </div>
      )}
    </VSCodeLayout>
  );
}