// /src/app/api/onboarding/route.ts
// POST /api/onboarding — AI onboarding → LearningPath oluştur

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { runOnboarding, type OnboardingAnswers } from "@/lib/ai/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const isAnon = !user.email;
    const userEmail = user.email || `anon_${user.id}@codequest.app`;

    // E-posta adresiyle önceden eşleşen ama ID'si farklı (örn. eski veritabanından taşınmış) bir kullanıcı var mı kontrol et:
    if (!isAnon) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userEmail },
      });
      
      if (existingUser && existingUser.id !== user.id) {
        // ID'leri eşitlemek için PostgreSQL'deki ON UPDATE CASCADE özelliğini kullanıp ID'yi güncelle:
        await prisma.$executeRawUnsafe(
          'UPDATE public.users SET id = $1 WHERE email = $2',
          user.id,
          userEmail
        );
      }
    }

    await prisma.user.upsert({
      where:  { id: user.id },
      update: {
        ...(isAnon ? { email: userEmail } : {}),
      },
      create: {
        id:       user.id,
        email:    userEmail,
        username: `user_${user.id.slice(0, 8)}`,
      },
    });

    let body: OnboardingAnswers;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
    }

    const { language, goal, experience } = body;

    if (!language || !goal || !experience) {
      return NextResponse.json(
        { error: "language, goal ve experience alanları zorunlu." },
        { status: 400 }
      );
    }

    const existingPath = await prisma.learningPath.findFirst({
      where: {
        userId: user.id,
        language: language,
      },
    });

    if (existingPath) {
      const firstTopic = existingPath.topicsOrder[0] ?? "intro";
      return NextResponse.json(
        { learningPathId: existingPath.id, redirectTo: `/learn/${firstTopic}?lpId=${existingPath.id}` },
        { status: 200 }
      );
    }

    const payload = await runOnboarding({ language, goal, experience }, user.id);

    const [learningPath] = await prisma.$transaction([
      prisma.learningPath.create({ data: payload }),
      prisma.user.update({
        where: { id: user.id },
        data:  { onboardingDone: true, goal, experience },
      }),
    ]);

    const firstTopic = payload.topicsOrder[0] ?? "intro";

    return NextResponse.json(
      { learningPathId: learningPath.id, redirectTo: `/learn/${firstTopic}?lpId=${learningPath.id}` },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/onboarding] Gelen Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası: " + (err.message || "Bilinmeyen hata") }, { status: 500 });
  }
}