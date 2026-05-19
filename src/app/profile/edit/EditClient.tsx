"use client";

// /src/app/profile/edit/EditClient.tsx
// Client Component — Kullanıcı adı + hesap kalıcılaştırma

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// ─── Tipler ──────────────────────────────────────────────────────

interface EditClientProps {
  userId:          string;
  currentUsername: string;
  isAnonymous:     boolean;
}

// ─── Bileşen ──────────────────────────────────────────────────────

export function EditClient({ userId, currentUsername, isAnonymous }: EditClientProps) {
  const router = useRouter();

  // ── Bölüm 1: Kullanıcı adı değiştirme ────────────────────────
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const handleUsernameUpdate = async () => {
    if (newUsername.trim() === currentUsername) return;
    setUsernameLoading(true);
    setUsernameError(null);
    setUsernameSuccess(false);

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız.");
      setUsernameSuccess(true);
      setTimeout(() => router.refresh(), 1000);
    } catch (err) {
      setUsernameError((err as Error).message);
    } finally {
      setUsernameLoading(false);
    }
  };

  // ── Bölüm 2: Hesabı kalıcılaştırma ───────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permanentLoading, setPermanentLoading] = useState(false);
  const [permanentError, setPermanentError] = useState<string | null>(null);
  const [permanentSuccess, setPermanentSuccess] = useState(false);

  const handlePermanent = async () => {
    setPermanentLoading(true);
    setPermanentError(null);
    setPermanentSuccess(false);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      setPermanentSuccess(true);
    } catch (err) {
      setPermanentError((err as Error).message);
    } finally {
      setPermanentLoading(false);
    }
  };

  return (
    <div
      className="max-w-xl mx-auto px-6 py-8 space-y-8"
      style={{ fontFamily: "'JetBrains Mono', monospace", color: "#d4d4d4" }}
    >
      {/* ── Başlık ────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Profil Ayarları</h1>
        <p style={{ fontSize: 12, color: "#858585" }}>
          Kullanıcı adın ve hesap bilgilerin.
        </p>
      </div>

      {/* ── Bölüm 1: Kullanıcı adı ─────────────────────────── */}
      <div
        style={{
          background: "#252526",
          border: "1px solid #3c3c3c",
          borderRadius: 8,
          padding: "16px 20px",
        }}
      >
        <label style={{ display: "block", fontSize: 11, color: "#858585", marginBottom: 8 }}>
          Kullanıcı Adı
        </label>
        <input
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: 13,
            background: "#1e1e1e",
            border: "1px solid #3c3c3c",
            borderRadius: 4,
            color: "#d4d4d4",
            fontFamily: "inherit",
          }}
          placeholder="kullanici_adi"
        />

        <button
          onClick={handleUsernameUpdate}
          disabled={usernameLoading || newUsername.trim() === currentUsername}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            background: "#007acc",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: usernameLoading ? "wait" : "pointer",
            opacity: usernameLoading || newUsername.trim() === currentUsername ? 0.5 : 1,
            fontFamily: "inherit",
          }}
        >
          {usernameLoading ? "Kaydediliyor…" : "Kaydet"}
        </button>

        {usernameError && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              fontSize: 11,
              background: "#e0555522",
              border: "1px solid #e0555544",
              borderRadius: 4,
              color: "#e05555",
            }}
          >
            {usernameError}
          </div>
        )}

        {usernameSuccess && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              fontSize: 11,
              background: "#6a995522",
              border: "1px solid #6a995544",
              borderRadius: 4,
              color: "#6a9955",
            }}
          >
            ✓ Kullanıcı adı güncellendi.
          </div>
        )}
      </div>

      {/* ── Bölüm 2: Hesabı kalıcılaştır ─────────────────────── */}
      {isAnonymous && (
        <div
          style={{
            background: "#252526",
            border: "1px solid #3c3c3c",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Hesabı Kalıcılaştır
            </h2>
            <p style={{ fontSize: 11, color: "#858585", lineHeight: 1.6 }}>
              Misafir hesabınızı bir email ile kalıcılaştırın. Tüm ilerlemeniz korunur.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#858585", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  background: "#1e1e1e",
                  border: "1px solid #3c3c3c",
                  borderRadius: 4,
                  color: "#d4d4d4",
                  fontFamily: "inherit",
                }}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "#858585", marginBottom: 6 }}>
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  background: "#1e1e1e",
                  border: "1px solid #3c3c3c",
                  borderRadius: 4,
                  color: "#d4d4d4",
                  fontFamily: "inherit",
                }}
                placeholder="Minimum 6 karakter"
              />
            </div>
          </div>

          <button
            onClick={handlePermanent}
            disabled={
              permanentLoading ||
              !email.trim() ||
              password.length < 6
            }
            style={{
              marginTop: 12,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "#6a9955",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: permanentLoading ? "wait" : "pointer",
              opacity:
                permanentLoading || !email.trim() || password.length < 6
                  ? 0.5
                  : 1,
              fontFamily: "inherit",
            }}
          >
            {permanentLoading ? "Kaydediliyor…" : "Hesabı Bağla"}
          </button>

          {permanentError && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                fontSize: 11,
                background: "#e0555522",
                border: "1px solid #e0555544",
                borderRadius: 4,
                color: "#e05555",
              }}
            >
              {permanentError}
            </div>
          )}

          {permanentSuccess && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                fontSize: 11,
                background: "#6a995522",
                border: "1px solid #6a995544",
                borderRadius: 4,
                color: "#6a9955",
                lineHeight: 1.6,
              }}
            >
              ✓ Email doğrulama linki gönderildi. Lütfen posta kutunuzu kontrol edin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}