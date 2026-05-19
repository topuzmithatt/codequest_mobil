"use client";

// /src/components/profile/ProfileActions.tsx
// Profil sayfasındaki aksiyon butonları (client component wrapper)

import { useState } from "react";
import { AddLanguageModal } from "./AddLanguageModal";
import { createBrowserClient } from "@supabase/ssr";

export function ProfileActions({ portfolioUrl }: { portfolioUrl: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%", boxSizing: "border-box" }}>
        {/* Sol Sütun (3 Buton Alt Alta) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <a
            href={portfolioUrl}
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#007acc22",
              border: "1px solid #007acc44",
              borderRadius: 4,
              color: "#007acc",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Portfolio&apos;mu Gör
          </a>
          <a
            href="/profile/edit"
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#3c3c3c",
              border: "1px solid #555",
              borderRadius: 4,
              color: "#d4d4d4",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Profili Düzenle
          </a>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#16825d22",
              border: "1px solid #16825d44",
              borderRadius: 4,
              color: "#4ec9b0",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            + Yeni Dil Ekle
          </button>
        </div>

        {/* Sağ Sütun (Kare Çıkış Yap Butonu) */}
        {/* Yükseklik hesabı: 3 * 36px (butonlar) + 2 * 8px (boşluklar) = 124px */}
        <button
          onClick={handleLogout}
          style={{
            width: 124,
            height: 124,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "#e0555522",
            border: "1px solid #e0555544",
            borderRadius: 4,
            color: "#e05555",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Çıkış Yap
        </button>
      </div>

      <AddLanguageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
