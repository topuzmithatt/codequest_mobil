"use client";

import { useState, useEffect } from "react";

const STEPS = [
  { id: "tour-step-1", title: "Profil Bilgilerin", color: "blue",   desc: "Kullanıcı adın, seviye ve XP bilgin burada. Profil resmine tıklayarak düzenleyebilirsin." },
  { id: "tour-step-2", title: "İstatistikler",     color: "green",  desc: "Toplam XP, çözülen görev sayısı ve serinle ilgili istatistiklerini buradan takip edebilirsin." },
  { id: "tour-step-3", title: "Rozetler",          color: "yellow", desc: "Görevleri tamamladıkça ve hedeflere ulaştıkça rozetler kazanırsın. Koleksiyonunu burada görürsün." },
  { id: "tour-step-4", title: "Liderboard",        color: "purple", desc: "Bu haftanın en aktif kullanıcıları burada. Sıralamada yükselmek için görev çöz!" },
];

const RING_COLORS: Record<string, string> = {
  blue:   "ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]",
  green:  "ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]",
  yellow: "ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]",
  purple: "ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]",
};

const TOOLTIP_COLORS: Record<string, string> = {
  blue:   "border-blue-500 text-blue-400",
  green:  "border-green-500 text-green-400",
  yellow: "border-yellow-500 text-yellow-400",
  purple: "border-purple-500 text-purple-400",
};

const BTN_COLORS: Record<string, string> = {
  blue:   "bg-blue-600 hover:bg-blue-500",
  green:  "bg-green-600 hover:bg-green-500",
  yellow: "bg-yellow-600 hover:bg-yellow-500",
  purple: "bg-purple-600 hover:bg-purple-500",
};

export function ProfileTour() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tour') === 'true') {
      setStep(1);
    }
  }, []);

  useEffect(() => {
    if (step === 0) return;
    const current = STEPS[step - 1];
    if (!current) return;
    const el = document.getElementById(current.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-4", ...RING_COLORS[current.color].split(" "), "rounded-xl", "transition-all", "duration-300");
    return () => {
      el?.classList.remove("ring-4", ...RING_COLORS[current.color].split(" "), "rounded-xl", "transition-all", "duration-300");
    };
  }, [step]);

  if (step === 0) return null;

  const current = STEPS[step - 1];
  if (!current) return null;

  const isLast = step === STEPS.length;

  const handleNext = () => {
    if (isLast) {
      setStep(0);
      window.location.href = '/learn/intro?tour=finished';
    } else {
      setStep(step + 1);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />
      <div className={`fixed bottom-4 right-4 left-4 md:left-auto md:bottom-8 md:right-8 w-[calc(100%-2rem)] md:w-80 pointer-events-auto bg-[#1e1e1e] border ${TOOLTIP_COLORS[current.color].split(" ")[0]} text-white p-5 rounded-lg shadow-2xl z-50`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-bold text-base ${TOOLTIP_COLORS[current.color].split(" ")[1]}`}>{current.title}</h3>
          <span className="text-xs text-gray-500">{step}/{STEPS.length}</span>
        </div>
        <p className="text-sm text-gray-300 mb-4 leading-relaxed">{current.desc}</p>
        <button
          onClick={handleNext}
          className={`${BTN_COLORS[current.color]} text-white px-4 py-2 rounded text-sm font-bold transition-colors w-full`}
        >
          {isLast ? "Göreve Başla 🚀" : "Sıradaki →"}
        </button>
      </div>
    </>
  );
}
