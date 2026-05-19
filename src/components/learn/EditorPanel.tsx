"use client";

// /src/components/learn/EditorPanel.tsx

import { useRef, useState, useEffect, useCallback } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import type { Challenge, Language } from "@prisma/client";

interface TestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  description?: string | null;
  hints?: string[];
}

import type { TestResult } from "./TerminalPanel";

interface ChallengeWithTests extends Omit<Challenge, "testCases"> {
  testCases: TestCase[];
}

export interface EditorPanelProps {
  challenge?: ChallengeWithTests;
  isSandbox?: boolean;
  learningPathId?: string;
  stdin?: string;
  selectedTestIndex?: number;
  onRunResult?:        (output: string, isError: boolean) => void;
  onTestResults?:      (results: TestResult[]) => void;
  onReviewReady?:      (submissionId: string, data: any) => void;
  onPortfolioRequest?: (code: string, language: string) => void;
  onRunReady?:         (fn: (stdin: string) => void) => void;
  /** Kod veya dil değiştiğinde çağrılır — terminal input tespiti için */
  onCodeChange?:       (code: string, language: string) => void;
  /** Çalıştır butonuna basıldığında üst bileşene bildirir */
  onRunRequest?:       () => void;
}

const MONACO_LANG: Record<string, string> = {
  PYTHON: "python", JAVASCRIPT: "javascript", JAVA: "java",
  SQL: "sql", CSHARP: "csharp", GO: "go", RUST: "rust",
  KOTLIN: "kotlin", SWIFT: "swift", R: "r", HTML_CSS: "html",
};

const DEFAULT_STARTER: Record<string, string> = {
  python:     "# Kodunu buraya yaz\n\n",
  javascript: "// Kodunu buraya yaz\n\n",
  java:       "public class Main {\n    public static void main(String[] args) {\n        // Kodunu buraya yaz\n    }\n}\n",
  sql:        "-- Sorgunuzu buraya yazın\n\n",
};

const SANDBOX_LANGS: { value: Language; label: string }[] = [
  { value: "PYTHON",     label: "Python"     },
  { value: "JAVASCRIPT", label: "JavaScript" },
  { value: "JAVA",       label: "Java"       },
  { value: "SQL",        label: "SQL"        },
];

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("codequest-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",  foreground: "6a9955", fontStyle: "italic" },
      { token: "string",   foreground: "ce9178" },
      { token: "keyword",  foreground: "c586c0", fontStyle: "bold"   },
      { token: "variable", foreground: "9cdcfe" },
      { token: "function", foreground: "dcdcaa" },
      { token: "number",   foreground: "b5cea8" },
      { token: "type",     foreground: "4ec9b0" },
      { token: "class",    foreground: "4ec9b0" },
    ],
    colors: {
      "editor.background":              "#1e1e1e",
      "editor.foreground":              "#d4d4d4",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editor.selectionBackground":     "#264f78",
      "editorLineNumber.foreground":    "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorCursor.foreground":        "#d4d4d4",
      "editorWidget.background":        "#252526",
      "editorSuggestWidget.background": "#252526",
      "editorSuggestWidget.border":     "#454545",
      "editorSuggestWidget.selectedBackground": "#062f4a",
      "scrollbarSlider.background":     "#424242",
    },
  });
}

export function EditorPanel({
  challenge,
  isSandbox = false,
  learningPathId,
  stdin,
  selectedTestIndex = 0,
  onRunResult,
  onTestResults,
  onReviewReady,
  onPortfolioRequest,
  onRunReady,
  onCodeChange,
  onRunRequest,
}: EditorPanelProps) {
  const [sandboxLang, setSandboxLang] = useState<Language>("PYTHON");
  const activeLang: Language = challenge ? challenge.language : sandboxLang;
  const monacoLang = MONACO_LANG[activeLang] ?? "plaintext";

  const [code, setCodeRaw] = useState(() =>
    challenge?.starterCode ?? DEFAULT_STARTER[monacoLang] ?? ""
  );
  const setCode = useCallback((v: string) => {
    setCodeRaw(v);
    onCodeChange?.(v, activeLang);
  }, [onCodeChange, activeLang]);
  const [isRunning,    setIsRunning]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // code ve activeLang her değişince onRunReady'i güncelle
  useEffect(() => {
    onRunReady?.((stdinValue: string) => {
      setIsRunning(true);
      fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: activeLang, stdin: stdinValue }),
      })
        .then((r) => r.json())
        .then((data) => {
          onRunResult?.(data.stdout || data.stderr || "(çıktı yok)", !!data.stderr);
        })
        .catch(() => onRunResult?.("Sunucu hatası.", true))
        .finally(() => setIsRunning(false));
    });
  }, [code, activeLang, onRunReady, onRunResult]);

  useEffect(() => {
    if (isSandbox) setCode(DEFAULT_STARTER[MONACO_LANG[sandboxLang]] ?? "");
  }, [sandboxLang, isSandbox]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    defineTheme(monaco);
    monaco.editor.setTheme("codequest-dark");
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handleRun());
  };

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    
    // Eğer dışarıdan onRunRequest verildiyse (interaktif terminal vb. için) 
    // fetch yapmadan direkt üst bileşene haber ver.
    if (onRunRequest) {
      onRunRequest();
      // isRunning durumunu biraz bekletip kapatabiliriz veya üst bileşenden prop almalıyız
      setTimeout(() => setIsRunning(false), 500); 
      return;
    }

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: activeLang, stdin }),
      });
      const data = await res.json();
      onRunResult?.(data.stdout || data.stderr || "(çıktı yok)", !!data.stderr);
    } catch {
      onRunResult?.("Sunucu hatası — lütfen tekrar deneyin.", true);
    } finally {
      setIsRunning(false);
    }
  }, [code, activeLang, stdin, isRunning, onRunResult, onRunRequest]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !challenge) return;
    setIsSubmitting(true);

    const selectedTestCase = challenge.testCases[selectedTestIndex];
    if (!selectedTestCase) {
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: activeLang,
          challengeId: challenge.id,
          learningPathId,
          testCaseIndex: selectedTestIndex,
          singleTestCase: {
            input: selectedTestCase.input,
            expectedOutput: selectedTestCase.expectedOutput,
          },
        }),
      });
      const data = await res.json();
      onTestResults?.(data.testResults);
      if (data.submissionId) onReviewReady?.(data.submissionId, data);
    } catch {
      onRunResult?.("Gönderim başarısız — lütfen tekrar deneyin.", true);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, activeLang, challenge, learningPathId, selectedTestIndex, isSubmitting, onRunResult, onTestResults, onReviewReady]);

  const handlePortfolio = useCallback(() => {
    onPortfolioRequest?.(code, activeLang);
  }, [code, activeLang, onPortfolioRequest]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#1e1e1e" }}>
      <div
        className="flex items-center justify-between px-3 h-9 shrink-0 gap-2"
        style={{ background: "#252526", borderBottom: "1px solid #1e1e1e" }}
      >
        <div className="flex items-center gap-2">
          {isSandbox ? (
            <select
              value={sandboxLang}
              onChange={(e) => setSandboxLang(e.target.value as Language)}
              className="text-xs px-2 py-0.5 rounded outline-none cursor-pointer"
              style={{ background: "#3c3c3c", color: "#d4d4d4", border: "1px solid #555", fontFamily: "inherit" }}
            >
              {SANDBOX_LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#3c3c3c", color: "#9cdcfe" }}>
              {activeLang.charAt(0) + activeLang.slice(1).toLowerCase()}
            </span>
          )}
          <span className="text-xs" style={{ color: "#858585", fontSize: "11px" }}>
            {isSandbox ? "Serbest mod" : `Zorluk: ${challenge?.difficulty}/10 · ${challenge?.xpReward} XP`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: "#3c3c3c", color: "#d4d4d4", border: "1px solid #555" }}
            title="Çalıştır (Ctrl+Enter)"
          >
            {isRunning ? <span className="animate-pulse">▶ Çalışıyor…</span> : <><span>▶</span> Çalıştır</>}
          </button>

          {!isSandbox && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "#007acc", color: "#ffffff" }}
            >
              {isSubmitting ? <span className="animate-pulse">Gönderiliyor…</span> : "↑ Gönder"}
            </button>
          )}

          {isSandbox && (
            <button
              onClick={handlePortfolio}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold"
              style={{ background: "#6a9955", color: "#fff" }}
            >
              ＋ Portfolyo
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={monacoLang}
          value={code}
          onChange={(v) => setCode(v ?? "")}
          onMount={handleMount}
          options={{
            fontSize:                    14,
            fontFamily:                  "'JetBrains Mono', 'Cascadia Code', monospace",
            fontLigatures:               true,
            lineNumbers:                 "on",
            minimap:                     { enabled: false },
            scrollBeyondLastLine:        false,
            wordWrap:                    "on",
            tabSize:                     4,
            insertSpaces:                true,
            cursorBlinking:              "smooth",
            cursorSmoothCaretAnimation:  "on",
            smoothScrolling:             true,
            renderLineHighlight:         "all",
            bracketPairColorization:     { enabled: true },
            guides:                      { bracketPairs: true, indentation: true },
            padding:                     { top: 12, bottom: 12 },
          }}
          loading={
            <div className="flex items-center justify-center h-full text-xs" style={{ color: "#858585" }}>
              Editor yükleniyor…
            </div>
          }
        />
      </div>
    </div>
  );
}