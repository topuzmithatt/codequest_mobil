"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  /**
   * Giriş sonrası kullanıcının onboarding durumunu kontrol et.
   * - onboardingDone === true ise → en son LearningPath'e yönlendir
   * - değilse → /onboarding'e yönlendir
   */
  const redirectAfterAuth = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.user?.onboardingDone && data.learningPaths?.length > 0) {
          // Mevcut kullanıcı — en son learning path ile learn sayfasına git
          const latestPath = data.learningPaths[0];
          const firstTopic = latestPath.topicsOrder?.[latestPath.currentTopicIndex] ?? latestPath.topicsOrder?.[0] ?? "intro";
          router.push(`/learn/${firstTopic}?lpId=${latestPath.id}`);
          return;
        }
      }
    } catch {
      // Profile API hatası → onboarding'e yönlendir (güvenli fallback)
    }
    router.push("/onboarding");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      // Yeni kayıt — her zaman onboarding'e
      router.push("/onboarding");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      // Mevcut kullanıcı — onboarding durumunu kontrol et
      await redirectAfterAuth();
    }
  };

  const handleAnonymous = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/onboarding");
  };
    
  return (
    <main style={{ minHeight: "100vh", background: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 8, padding: "32px 24px", width: "100%", maxWidth: 360, fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box" }}>
        <h1 style={{ color: "#d4d4d4", fontSize: 18, marginBottom: 24 }}>
          {isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </h1>

        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", background: "#1e1e1e", border: "1px solid #3c3c3c", borderRadius: 4, color: "#d4d4d4", marginBottom: 12, fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", background: "#1e1e1e", border: "1px solid #3c3c3c", borderRadius: 4, color: "#d4d4d4", marginBottom: 16, fontFamily: "inherit", boxSizing: "border-box" }}
        />

        {error && <p style={{ color: "#e05555", fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: "100%", padding: "10px", background: "#007acc", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, marginBottom: 12 }}
        >
          {loading ? "..." : isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </button>

        <button
          onClick={() => setIsRegister(!isRegister)}
          style={{ width: "100%", padding: "8px", background: "none", border: "1px solid #3c3c3c", borderRadius: 4, color: "#858585", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
        >
          {isRegister ? "Zaten hesabın var mı? Giriş yap" : "Hesabın yok mu? Kayıt ol"}
        </button>

        <button
          onClick={handleAnonymous}
          disabled={loading}
          style={{ width: "100%", padding: "8px", background: "none", border: "1px solid #007acc33", borderRadius: 4, color: "#007acc", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginTop: 8 }}
        >
          Misafir olarak devam et
        </button>
      </div>
    </main>
  );
}