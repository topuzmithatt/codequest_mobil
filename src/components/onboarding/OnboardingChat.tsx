"use client";

// /src/components/onboarding/OnboardingChat.tsx
// CodeQuest — AI Onboarding Chat
// Üç soru sırayla chat balonu olarak gösterilir.
// Seçim yapılınca sonraki soru açılır, 3. soru tamamlanınca /api/onboarding çağrılır.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Language, UserGoal, ExperienceLevel } from "@prisma/client";

// ─── Tipler ──────────────────────────────────────────────────────

interface OnboardingAnswers {
  language:   Language;
  goal:       UserGoal;
  experience: ExperienceLevel;
}

type Step = 0 | 1 | 2 | 3;   // 0-2: sorular, 3: gönderiliyor

// ─── Dil verileri ─────────────────────────────────────────────────

interface LangOption {
  value: Language;
  label: string;
  ext:   string;    // Dosya uzantısı (görsel ipucu)
  color: string;    // Dil ikonu rengi (VS Code renklerinden)
}

const LANG_OPTIONS: LangOption[] = [
  { value: "PYTHON",     label: "Python",     ext: ".py",   color: "#ffda4b" },
  { value: "JAVASCRIPT", label: "JavaScript", ext: ".js",   color: "#f7df1e" },
  { value: "JAVA",       label: "Java",       ext: ".java", color: "#e07c5a" },
  { value: "SQL",        label: "SQL",        ext: ".sql",  color: "#e8b84b" },
];

const GOAL_OPTIONS: { value: UserGoal; label: string; sub: string }[] = [
  { value: "EXAM_PREP",   label: "Sınav Hazırlığı",   sub: "Temel kavramlar, sık sorular"  },
  { value: "JOB_HUNTING", label: "İş Bulmak",         sub: "Algoritmalar, pratik projeler" },
  { value: "CURIOSITY",   label: "Merak",             sub: "Kendi temponda öğren"          },
];

const EXP_OPTIONS: { value: ExperienceLevel; label: string; sub: string }[] = [
  { value: "NONE", label: "Hayır",  sub: "Hiç kod yazmadım"   },
  { value: "SOME", label: "Biraz",  sub: "Temel seviyedeyim"  },
  { value: "YES",  label: "Evet",   sub: "Kod yazıyorum"       },
];

// ─── Alt bileşenler ──────────────────────────────────────────────

function AIChatBubble({ text, visible }: { text: string; visible: boolean }) {
  return (
    <div
      className="flex items-start gap-3 transition-all duration-500"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* AI avatar */}
      <div
        className="flex items-center justify-center rounded shrink-0 text-xs font-bold"
        style={{
          width: 28, height: 28,
          background: "#007acc",
          color: "#fff",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          marginTop: 2,
        }}
      >
        CQ
      </div>
      <div
        className="px-4 py-3 rounded-lg text-sm leading-relaxed max-w-sm"
        style={{
          background: "#252526",
          color: "#d4d4d4",
          border: "1px solid #3c3c3c",
          borderTopLeftRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function UserBubble({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <div
      className="flex justify-end transition-all duration-500"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <div
        className="px-4 py-3 rounded-lg text-sm max-w-xs"
        style={{
          background: "#007acc22",
          color: "#9cdcfe",
          border: "1px solid #007acc44",
          borderTopRightRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── LanguageSelector ─────────────────────────────────────────────

function LanguageSelector({
  onSelect,
  disabled,
}: {
  onSelect: (lang: Language) => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState<Language | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      {LANG_OPTIONS.map((lang) => (
        <button
          key={lang.value}
          onClick={() => !disabled && onSelect(lang.value)}
          onMouseEnter={() => setHovered(lang.value)}
          onMouseLeave={() => setHovered(null)}
          disabled={disabled}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all duration-150 disabled:opacity-40"
          style={{
            background:  hovered === lang.value && !disabled ? "#2a2d2e" : "#1e1e1e",
            border:      `1px solid ${hovered === lang.value && !disabled ? "#007acc" : "#3c3c3c"}`,
            cursor:      disabled ? "default" : "pointer",
            fontFamily:  "'JetBrains Mono', monospace",
          }}
        >
          {/* Dil renk noktası */}
          <span
            className="rounded-sm shrink-0"
            style={{ width: 10, height: 10, background: lang.color }}
          />
          <span className="text-xs" style={{ color: "#d4d4d4" }}>{lang.label}</span>
          <span className="text-xs ml-auto" style={{ color: "#555", fontSize: 10 }}>{lang.ext}</span>
        </button>
      ))}
    </div>
  );
}

// ─── OptionPicker ─────────────────────────────────────────────────

function OptionPicker<T extends string>({
  options,
  onSelect,
  disabled,
}: {
  options: { value: T; label: string; sub: string }[];
  onSelect: (value: T) => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState<T | null>(null);

  return (
    <div className="flex flex-col gap-2 mt-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !disabled && onSelect(opt.value)}
          onMouseEnter={() => setHovered(opt.value)}
          onMouseLeave={() => setHovered(null)}
          disabled={disabled}
          className="flex items-center justify-between px-4 py-2.5 rounded text-left transition-all duration-150 disabled:opacity-40"
          style={{
            background: hovered === opt.value && !disabled ? "#2a2d2e" : "#1e1e1e",
            border:     `1px solid ${hovered === opt.value && !disabled ? "#007acc" : "#3c3c3c"}`,
            cursor:     disabled ? "default" : "pointer",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span className="text-sm font-medium" style={{ color: "#d4d4d4" }}>{opt.label}</span>
          <span className="text-xs ml-4" style={{ color: "#6a9955" }}>{opt.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Hata mesajı ──────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded text-xs"
      style={{
        background: "#e0555522",
        border:     "1px solid #e0555544",
        color:      "#e05555",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span>✗</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────

export function OnboardingChat() {
  const router = useRouter();

  const [step,       setStep]       = useState<Step>(0);
  const [answers,    setAnswers]    = useState<Partial<OnboardingAnswers>>({});
  const [error,      setError]      = useState<string | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Yeni adım açıldığında en alta kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  // ── Seçim işleyicileri ────────────────────────────────────────

  const handleLanguage = (language: Language) => {
    setAnswers((a) => ({ ...a, language }));
    setStep(1);
  };

  const handleGoal = (goal: UserGoal) => {
    setAnswers((a) => ({ ...a, goal }));
    setStep(2);
  };

  const handleExperience = async (experience: ExperienceLevel) => {
    const finalAnswers = { ...answers, experience } as OnboardingAnswers;
    setAnswers(finalAnswers);
    setStep(3);
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(finalAnswers),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Bir hata oluştu.");
      }

      router.push(data.redirectTo);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
      setStep(2);   // Kullanıcı tekrar deneyebilsin
    }
  };

  // ── Görünen etiketler (seçim yapıldıktan sonra kullanıcı balonunda) ──

  const langLabel = LANG_OPTIONS.find((l) => l.value === answers.language)?.label;
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label;
  const expLabel  = EXP_OPTIONS.find((e) => e.value === answers.experience)?.label;

  return (
    <div
      className="flex flex-col w-full max-w-md mx-auto px-4 py-8 gap-6 overflow-y-auto"
      style={{ maxHeight: "100vh" }}
    >
      {/* ── Soru 1: Dil ─────────────────────────────────────── */}
      <AIChatBubble
        text="Merhaba! Sana özel bir öğrenme yolu oluşturmak için birkaç soru sormak istiyorum. Hangi programlama dilini öğrenmek istiyorsun?"
        visible={true}
      />

      {step >= 0 && (
        <div
          className="transition-all duration-500"
          style={{
            opacity:   step >= 0 ? 1 : 0,
            transform: step >= 0 ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <LanguageSelector onSelect={handleLanguage} disabled={step > 0} />
        </div>
      )}

      {/* Seçim balonu: Dil */}
      {step >= 1 && langLabel && (
        <UserBubble visible={true}>{langLabel}</UserBubble>
      )}

      {/* ── Soru 2: Hedef ───────────────────────────────────── */}
      {step >= 1 && (
        <AIChatBubble
          text="Harika seçim! Peki amacın ne? Bu sayede müfredatını buna göre ayarlayabilirim."
          visible={step >= 1}
        />
      )}

      {step >= 1 && (
        <div
          className="transition-all duration-500"
          style={{
            opacity:   step >= 1 ? 1 : 0,
            transform: step >= 1 ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <OptionPicker
            options={GOAL_OPTIONS}
            onSelect={handleGoal}
            disabled={step > 1}
          />
        </div>
      )}

      {step >= 2 && goalLabel && (
        <UserBubble visible={true}>{goalLabel}</UserBubble>
      )}

      {/* ── Soru 3: Deneyim ─────────────────────────────────── */}
      {step >= 2 && (
        <AIChatBubble
          text="Anlıyorum. Son olarak — daha önce hiç kod yazdın mı? Başlangıç noktanı doğru belirleyelim."
          visible={step >= 2}
        />
      )}

      {step >= 2 && (
        <div
          className="transition-all duration-500"
          style={{
            opacity:   step >= 2 ? 1 : 0,
            transform: step >= 2 ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <OptionPicker
            options={EXP_OPTIONS}
            onSelect={handleExperience}
            disabled={step > 2}
          />
        </div>
      )}

      {step >= 3 && expLabel && (
        <UserBubble visible={true}>{expLabel}</UserBubble>
      )}

      {/* ── Yükleniyor / hata ───────────────────────────────── */}
      {isLoading && (
        <AIChatBubble
          text="Senin için özel bir öğrenme yolu oluşturuyorum..."
          visible={true}
        />
      )}

      {error && <ErrorBanner message={error} />}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
