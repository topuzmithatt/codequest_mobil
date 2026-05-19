"use client";

// /src/components/profile/AddLanguageModal.tsx
// Yeni dil ekleme modalı

import { useState } from "react";

const LANGUAGES = [
  { value: "PYTHON",     label: "Python",     color: "#ffda4b" },
  { value: "JAVASCRIPT", label: "JavaScript", color: "#f7df1e" },
  { value: "JAVA",       label: "Java",       color: "#e07c5a" },
  { value: "SQL",        label: "SQL",        color: "#e8b84b" },
];

const GOALS = [
  { value: "EXAM_PREP",   label: "Sınav Hazırlığı",      emoji: "📝" },
  { value: "JOB_HUNTING", label: "İş Bulmak",            emoji: "💼" },
  { value: "CURIOSITY",   label: "Merak / Kişisel Gelişim", emoji: "🔍" },
];

const EXPERIENCES = [
  { value: "NONE", label: "Hiç deneyimim yok",  emoji: "🌱" },
  { value: "SOME", label: "Biraz bilgim var",    emoji: "🌿" },
  { value: "YES",  label: "Daha önce yazdım",   emoji: "🌳" },
];

interface AddLanguageModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddLanguageModal({ open, onClose }: AddLanguageModalProps) {
  const [language,   setLanguage]   = useState("");
  const [goal,       setGoal]       = useState("");
  const [experience, setExperience] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  if (!open) return null;

  const canSubmit = language && goal && experience && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/add-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, goal, experience }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Bir hata oluştu.");
        return;
      }

      if (data.alreadyExists) {
        // Zaten bu dil öğreniliyor — yine de yönlendir
        if (confirm("Bu dili zaten öğreniyorsun. Devam etmek ister misin?")) {
          window.location.href = data.redirectTo;
        }
      } else {
        window.location.href = data.redirectTo;
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1e1e1e",
          border: "1px solid #3c3c3c",
          borderRadius: 8,
          padding: "24px 20px",
          width: "90%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          fontFamily: "'JetBrains Mono', monospace",
          boxSizing: "border-box",
        }}
      >
        {/* Başlık */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#4ec9b0", margin: 0 }}>
            + Yeni Dil Ekle
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#858585", cursor: "pointer", fontSize: 18, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Dil Seçimi */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#858585", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Programlama Dili
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: language === lang.value ? `${lang.color}18` : "#252526",
                  border: `1px solid ${language === lang.value ? `${lang.color}88` : "#3c3c3c"}`,
                  borderRadius: 6,
                  color: language === lang.value ? lang.color : "#d4d4d4",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: language === lang.value ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: lang.color, display: "inline-block" }} />
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hedef Seçimi */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#858585", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Hedefin
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: goal === g.value ? "#007acc18" : "#252526",
                  border: `1px solid ${goal === g.value ? "#007acc88" : "#3c3c3c"}`,
                  borderRadius: 6,
                  color: goal === g.value ? "#9cdcfe" : "#d4d4d4",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: goal === g.value ? 600 : 400,
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span>{g.emoji}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Deneyim Seçimi */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#858585", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Deneyim Seviyesi
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {EXPERIENCES.map((exp) => (
              <button
                key={exp.value}
                onClick={() => setExperience(exp.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: experience === exp.value ? "#6a995518" : "#252526",
                  border: `1px solid ${experience === exp.value ? "#6a995588" : "#3c3c3c"}`,
                  borderRadius: 6,
                  color: experience === exp.value ? "#9fcea8" : "#d4d4d4",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: experience === exp.value ? 600 : 400,
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span>{exp.emoji}</span>
                <span>{exp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hata mesajı */}
        {error && (
          <div style={{
            padding: "8px 12px",
            marginBottom: 12,
            background: "#e0555518",
            border: "1px solid #e0555540",
            borderRadius: 4,
            color: "#e05555",
            fontSize: 11,
          }}>
            {error}
          </div>
        )}

        {/* Gönder butonu */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: canSubmit ? "#16825d" : "#3c3c3c",
            border: "1px solid transparent",
            borderRadius: 6,
            color: canSubmit ? "#fff" : "#858585",
            fontSize: 13,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          {loading ? "Oluşturuluyor..." : "Dil Ekle →"}
        </button>
      </div>
    </div>
  );
}
