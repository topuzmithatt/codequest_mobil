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
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <a
          href={portfolioUrl}
          style={{
            padding: "6px 16px",
            background: "#007acc22",
            border: "1px solid #007acc44",
            borderRadius: 4,
            color: "#007acc",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            textDecoration: "none",
          }}
        >
          Portfolio&apos;mu Gör
        </a>
        <a
          href="/profile/edit"
          style={{
            padding: "6px 16px",
            background: "#3c3c3c",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#d4d4d4",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            textDecoration: "none",
          }}
        >
          Profili Düzenle
        </a>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: "6px 16px",
            background: "#16825d22",
            border: "1px solid #16825d44",
            borderRadius: 4,
            color: "#4ec9b0",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
          }}
        >
          + Yeni Dil Ekle
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 16px",
            background: "#e0555522",
            border: "1px solid #e0555544",
            borderRadius: 4,
            color: "#e05555",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            marginLeft: "auto", // Sağ tarafa yaslanması için
          }}
        >
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
