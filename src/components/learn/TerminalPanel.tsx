"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import io, { Socket } from "socket.io-client";

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  stderr: string;
}

export interface TerminalPanelProps {
  testResults?: TestResult[];
  isRunning?: boolean;
  code?: string;
  language?: string;
  onRunReady?: (runFn: (code: string, language: string) => void) => void;
  onRun?: (stdin: string) => void;
  output?: string;
  isError?: boolean;
  // EKLENDİ: İşlem bittiğinde üst component'e haber vermek için
  onFinished?: () => void;
}

function TestResultRow({ result, index }: { result: TestResult; index: number }) {
  const [open, setOpen] = useState(!result.passed);
  return (
    <div className="rounded overflow-hidden mb-1.5" style={{ border: `1px solid ${result.passed ? "#6a995533" : "#e0555533"}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-xs transition-colors"
        style={{ background: result.passed ? "#6a995514" : "#e0555514", color: result.passed ? "#6a9955" : "#e05555", fontFamily: "inherit" }}
      >
        <span className="font-semibold">{result.passed ? "✓" : "✗"}</span>
        <span className="font-medium">Test {index + 1}</span>
        <span className="opacity-50 text-[10px] ml-auto">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1 text-xs" style={{ background: "#1a1a1a" }}>
          <div><span className="opacity-40 mr-1">stdin:</span><code style={{ color: "#9cdcfe" }}>{result.input || "(boş)"}</code></div>
          <div><span className="opacity-40 mr-1">beklenen:</span><code style={{ color: "#ce9178" }}>{result.expectedOutput}</code></div>
          <div><span className="opacity-40 mr-1">gerçek:</span><code style={{ color: result.passed ? "#6a9955" : "#e05555" }}>{result.actualOutput || result.stderr || "(çıktı yok)"}</code></div>
        </div>
      )}
    </div>
  );
}

export function TerminalPanel({
  testResults,
  isRunning,
  code = "",
  language = "python",
  onRunReady,
  onFinished, // EKLENDİ
}: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<"terminal" | "tests">("terminal");
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onRunReadyRef = useRef(onRunReady);
  const onFinishedRef = useRef(onFinished); // EKLENDİ: Closure sorunlarını önlemek için
  const codeRef = useRef(code);
  const languageRef = useRef(language);

  useEffect(() => { onRunReadyRef.current = onRunReady; }, [onRunReady]);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const doRunRef = useRef<((code: string, lang: string) => void) | null>(null);

  useEffect(() => {
    if (onRunReady && doRunRef.current) {
      onRunReady(doRunRef.current);
      (window as any)._dbg_terminalRun = doRunRef.current;
    }
  }, [onRunReady]);

  useEffect(() => {
    if (!terminalRef.current) return;
    let disposed = false;

    const init = async () => {
      const { Terminal: XTerm } = await import("xterm");
      const { FitAddon: XTermFit } = await import("xterm-addon-fit");
      if (disposed) return;

      const term = new XTerm({
        theme: {
          background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4',
          selectionBackground: '#264f78', black: '#000000', red: '#cd3131',
          green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8',
          magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
        },
        fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        fontSize: 13,
        cursorBlink: true,
        disableStdin: false,
      });

      const fit = new XTermFit();
      term.loadAddon(fit);
      term.open(terminalRef.current!);
      termRef.current = term;
      fitRef.current = fit;

      setTimeout(() => { try { fit.fit(); } catch (e) { } }, 100);

      const prompt = 'PS C:\\codequest> ';
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || `http://${window.location.hostname}:3001`;
      const socket = io(socketUrl);
      socketRef.current = socket;
      (window as any)._dbg_socket = socket;

      let isProcessRunning = false;
      let currentInput = "";

      const doRun = (runCode: string, runLang: string) => {
        setActiveTab("terminal");
        term.scrollToBottom();
        const lang = runLang.toLowerCase();
        const ext = lang === 'python' || lang === 'py' ? 'py' : lang === 'java' ? 'java' : lang === 'sql' ? 'sql' : 'js';
        const cmd = lang === 'python' || lang === 'py' ? 'python' : lang === 'java' ? 'java' : lang === 'sql' ? 'sql' : 'node';
        term.writeln(`${cmd} script.${ext}`);
        // Doğrudan emit atıyoruz, bağlı değilse socket.io bunu sıraya alır ve bağlanınca atar.
        socket.emit('runCode', { code: runCode, language: runLang });
      };

      doRunRef.current = doRun;
      (window as any)._dbg_doRun = doRun;

      if (onRunReadyRef.current) {
        onRunReadyRef.current(doRun);
        (window as any)._dbg_terminalRun = doRun;
      }

      socket.on('connect', () => {
        term.write(prompt);
        if (onRunReadyRef.current) {
          onRunReadyRef.current(doRun);
        }
      });

      socket.on('runStart', () => { isProcessRunning = true; });

      socket.on('output', (data: string) => { term.write(data); });

      socket.on('finished', () => {
        isProcessRunning = false;
        currentInput = "";
        term.write('\r\n' + prompt);
        // EKLENDİ: İşlem bittiğinde üst component'e isRunning state'ini false yapması için haber ver
        if (onFinishedRef.current) onFinishedRef.current();
      });

      socket.on('disconnect', () => {
        isProcessRunning = false;
        term.writeln('\r\n\x1b[38;5;196m✗ Sunucu bağlantısı koptu.\x1b[0m');
        if (onFinishedRef.current) onFinishedRef.current();
      });

      term.onData((data) => {
        if (!socket.connected) return;
        if (data === '\r') {
          term.write('\r\n');
          if (isProcessRunning) {
            socket.emit('input', currentInput + '\n');
            currentInput = "";
          } else {
            const cmd = currentInput.trim();
            if (cmd === 'clear' || cmd === 'cls') term.clear();
            else if (cmd !== '') term.writeln(`codequest: ${cmd}: command not found`);
            currentInput = "";
            term.write(prompt);
          }
        } else if (data === '\x7f' || data === '\b') {
          if (currentInput.length > 0) { currentInput = currentInput.slice(0, -1); term.write('\b \b'); }
        } else if (data === '\x03') {
          term.write('^C\r\n');
          if (isProcessRunning) socket.emit('kill');
          else { currentInput = ""; term.write(prompt); }
        } else if (data === '\x0c') {
          term.clear();
          if (!isProcessRunning) term.write(prompt + currentInput);
        } else if (!data.startsWith('\x1b')) {
          currentInput += data;
          term.write(data);
        }
      });

      // EKLENDİ: Event listener hafıza sızıntısı önleme
      const handleResize = () => { try { fit.fit(); } catch (e) { } };
      window.addEventListener('resize', handleResize);

      // Cleanup için fonksiyona referans verdik ki kaldırabilelim
      (socket as any)._handleResize = handleResize;
    };

    init();

    return () => {
      disposed = true;
      if (socketRef.current) {
        window.removeEventListener('resize', (socketRef.current as any)._handleResize);
        socketRef.current.disconnect();
      }
      termRef.current?.dispose();
    };
  }, []);

  // DÜZELTİLDİ: isRunning Effect'i daha güvenli hale getirildi
  useEffect(() => {
    if (!isRunning) return;
    // Bağlantı kontrolü (!socket.connected) kaldırıldı, böylece socket o anlık bağlanıyor 
    // olsa bile komut kuyruğa alınır ve kaybolmaz.
    if (doRunRef.current) {
      doRunRef.current(codeRef.current, languageRef.current);
    }
  }, [isRunning]);

  const handleClear = useCallback(() => { termRef.current?.clear(); }, []);
  const handleKill = useCallback(() => { socketRef.current?.emit('kill'); }, []);

  const passedCount = testResults?.filter((r) => r.passed).length ?? 0;
  const totalCount = testResults?.length ?? 0;
  const allPassed = totalCount > 0 && passedCount === totalCount;

  return (
    <div className="flex flex-col shrink-0 h-[220px] max-md:h-full max-md:flex-1" style={{ background: "#1e1e1e", borderTop: "1px solid #2a2a2a" }}>
      <div className="flex items-center shrink-0 select-none h-[35px]" style={{ background: "#181818", borderBottom: "1px solid #2a2a2a" }}>
        <div className="flex items-center h-full">
          <button
            onClick={() => { setActiveTab("terminal"); setTimeout(() => { try { fitRef.current?.fit(); } catch (e) { } }, 50); }}
            className="px-3 h-full text-[11px] uppercase tracking-wider font-medium transition-colors"
            style={{ color: activeTab === "terminal" ? "#d4d4d4" : "#6e6e6e", borderBottom: activeTab === "terminal" ? "1px solid #d4d4d4" : "1px solid transparent", background: "transparent", fontFamily: "inherit" }}
          >Terminal</button>
          <button
            onClick={() => setActiveTab("tests")}
            className="px-3 h-full text-[11px] uppercase tracking-wider font-medium transition-colors"
            style={{ color: activeTab === "tests" ? "#d4d4d4" : "#6e6e6e", borderBottom: activeTab === "tests" ? "1px solid #d4d4d4" : "1px solid transparent", background: "transparent", fontFamily: "inherit" }}
          >{testResults ? `Testler ${allPassed ? "✓" : `${passedCount}/${totalCount}`}` : "Testler"}</button>
        </div>
        <div className="ml-auto flex items-center gap-1 mr-2">
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] mr-2" style={{ color: "#007acc" }}>
              <span className="animate-spin inline-block">⟳</span> Çalışıyor…
            </span>
          )}
          {!isRunning && testResults && activeTab === "tests" && (
            <span className="text-[11px] font-semibold mr-2" style={{ color: allPassed ? "#6a9955" : "#e05555" }}>
              {allPassed ? `✓ Tümü geçti (${totalCount})` : `✗ ${passedCount}/${totalCount}`}
            </span>
          )}
          <button onClick={handleKill} className="p-1 rounded transition-colors mr-1" style={{ color: "#e05555", background: "transparent" }} title="Durdur">
            <span style={{ fontSize: "16px", lineHeight: "14px" }}>■</span>
          </button>
          <button onClick={handleClear} className="p-1 rounded transition-colors" style={{ color: "#858585", background: "transparent" }} title="Temizle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div ref={terminalRef} style={{ width: "100%", height: "100%", position: activeTab === "terminal" ? "relative" : "absolute", visibility: activeTab === "terminal" ? "visible" : "hidden", zIndex: activeTab === "terminal" ? 1 : -1, padding: "8px 0 8px 12px", background: "#1e1e1e" }} />
        {activeTab === "tests" && (
          <div className="overflow-y-auto w-full h-full p-3" style={{ background: "#1e1e1e", fontFamily: "'JetBrains Mono', monospace" }}>
            {!testResults || testResults.length === 0
              ? <div className="text-xs" style={{ color: "#4e4e4e" }}>↑ Gönder butonuna bas — test case koşulur</div>
              : <div>{testResults.map((r, i) => <TestResultRow key={i} result={r} index={i} />)}</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}