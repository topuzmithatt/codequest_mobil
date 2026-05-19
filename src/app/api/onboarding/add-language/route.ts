// /src/app/api/onboarding/add-language/route.ts
// POST /api/onboarding/add-language — Mevcut kullanıcıya yeni dil LearningPath'i ekle

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { runOnboarding, type OnboardingAnswers } from "@/lib/ai/orchestrator";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: OnboardingAnswers;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const { language, goal, experience } = body;

  if (!language || !goal || !experience) {
    return NextResponse.json(
      { error: "language, goal ve experience zorunlu." },
      { status: 400 }
    );
  }

  // Aynı dil zaten varsa mevcut patha yönlendir
  const existingPath = await prisma.learningPath.findFirst({
    where: { userId: user.id, language },
  });

  if (existingPath) {
    const firstTopic = existingPath.topicsOrder[0] ?? "intro";
    return NextResponse.json(
      { learningPathId: existingPath.id, redirectTo: `/learn/${firstTopic}?lpId=${existingPath.id}`, alreadyExists: true },
      { status: 200 }
    );
  }

  // Yeni LearningPath oluştur — onboardingDone'a dokunma
  try {
    const payload = await runOnboarding({ language, goal, experience }, user.id);
    const learningPath = await prisma.learningPath.create({ data: payload });
    const firstTopic = payload.topicsOrder[0] ?? "intro";

    return NextResponse.json(
      { learningPathId: learningPath.id, redirectTo: `/learn/${firstTopic}?lpId=${learningPath.id}` },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/onboarding/add-language]", err);
    return NextResponse.json({ error: "Dil eklenemedi." }, { status: 500 });
  }
}
