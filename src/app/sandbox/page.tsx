// ═══════════════════════════════════════════════════════════════
// /app/sandbox/page.tsx
// Serbest Kodlama Alanı
// /src/app/sandbox/page.tsx
// Next.js 15 App Router — Server Component

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { SandboxClient }  from "./SandboxClient";

export const metadata = {
  title: "Sandbox",
};

export default async function SandboxPage() {
  // Oturum yok → getCurrentUser redirect("/login") çağırır
  const user = await getCurrentUser();

  return (
    <SandboxClient
      userId={user.id}
      hearts={user.hearts}
      xp={user.xp}
      level={user.level}
      streak={0}
      username={user.username}
    />
  );
}