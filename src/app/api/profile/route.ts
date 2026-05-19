// /src/app/api/profile/route.ts
// GET /api/profile — Kullanıcı bilgilerini ve learning path'lerini döndür

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // ── Oturum kontrolü ──────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  // ── Kullanıcı + LearningPath'leri çek ────────────────────────
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const learningPaths = await prisma.learningPath.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      language: true,
      topicsOrder: true,
      currentTopicIndex: true,
      currentDifficulty: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    user: {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      onboardingDone: dbUser.onboardingDone,
      hearts: dbUser.hearts,
      xp: dbUser.xp,
      level: dbUser.level,
    },
    learningPaths,
  });
}
