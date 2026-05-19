// /src/app/profile/edit/page.tsx
// Next.js 15 App Router — Server Component

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { VSCodeLayout }   from "@/components/layout/VSCodeLayout";
import { EditClient }     from "./EditClient";

export default async function ProfileEditPage() {
  const user = await getCurrentUser();

  // Misafir hesap kontrolü — email `anon_` ile başlıyorsa anonymous login
  const isAnonymous = user.email ? user.email.startsWith("anon_") : true;

  return (
    <VSCodeLayout
      userId={user.id}
      hearts={user.hearts}
      xp={user.xp}
      level={user.level}
      streak={0}
      username={user.username}
    >
      <div style={{ background: "#1e1e1e", minHeight: "100vh" }}>
        <EditClient
          userId={user.id}
          currentUsername={user.username}
          isAnonymous={isAnonymous}
        />
      </div>
    </VSCodeLayout>
  );
}