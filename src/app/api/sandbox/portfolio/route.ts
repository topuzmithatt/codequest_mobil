// /src/app/api/sandbox/portfolio/route.ts
// POST /api/sandbox/portfolio
// Sandbox kodunu AI ile değerlendirir.
// overallScore >= 80 → submission + reviewResult kaydeder, portfolyoya ekler.
// overallScore < 80  → 422 döner, kullanıcıya skor ve öneri bildirilir.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { reviewCode } from "@/lib/ai/reviewer";
import type { Language } from "@prisma/client";

const PORTFOLIO_THRESHOLD = 60;

const SUPPORTED: Language[] = ["PYTHON", "JAVASCRIPT", "JAVA", "SQL"];

export async function POST(req: NextRequest) {
  // ── Oturum kontrolü ──────────────────────────────────────────
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

  // ── Body doğrulama ────────────────────────────────────────────
  let code: string, language: Language, isPublic: boolean;
  try {
    const body = await req.json();
    code     = body.code;
    language = body.language;
    isPublic = body.isPublic ?? true;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!code || !language) {
    return NextResponse.json(
      { error: "code ve language alanları zorunlu." },
      { status: 400 }
    );
  }

  if (!SUPPORTED.includes(language)) {
    return NextResponse.json(
      { error: `Desteklenmeyen dil: ${language}.` },
      { status: 422 }
    );
  }

  if (!code.trim()) {
    return NextResponse.json(
      { error: "Boş kod portfolyoya eklenemez." },
      { status: 400 }
    );
  }

  // ── AI Code Review ────────────────────────────────────────────
  let review: Awaited<ReturnType<typeof reviewCode>>;
  try {
    review = await reviewCode({
      code,
      language,
      // Sandbox'ta görev açıklaması yok — reviewer bağlamı genel tutar
      challengeDescription: "Sandbox serbest çalışma. Genel kod kalitesini değerlendir.",
      difficulty: 5,   // Sabit orta seviye çıta — sandbox'ta ELO yok
    });
  } catch (err) {
    console.error("[POST /api/sandbox/portfolio] reviewCode hatası:", err);
    return NextResponse.json({ error: "Kod değerlendirilemedi." }, { status: 500 });
  }

  // ── Eşik kontrolü ─────────────────────────────────────────────
  if (review.overallScore < PORTFOLIO_THRESHOLD) {
    return NextResponse.json(
      {
        score:   review.overallScore,
        message: `Portfolyo için minimum skor ${PORTFOLIO_THRESHOLD}. Mevcut skorun: ${review.overallScore}. ${review.feedbackImprovement}`,
        review,          // Frontend'de detaylı geri bildirim gösterilebilir
      },
      { status: 422 }
    );
  }

  // ── Skor yeterliyse: Submission + ReviewResult kaydet ─────────
  try {
    // Sandbox submission'ları challengeId gerektirmez — nullable
    const submission = await prisma.submission.create({
      data: {
        userId:    user.id,
        // challengeId sandbox'ta zorunlu değil ama şema nullable değil;
        // bunun için şemaya `challengeId String?` yapılması veya
        // "sandbox-placeholder" gibi özel bir challenge kaydı kullanılması önerilir.
        // Burada learningPath olmadan direkt challenge bağlantısı gerektirmeyen
        // bir sandbox challenge kaydının var olduğu varsayılmaktadır.
        // Gerçek implementasyonda: challengeId: SANDBOX_CHALLENGE_ID (seed verisi)
        challengeId:    await getSandboxChallengeId(language),
        code,
        language,
        isSandbox:      true,
        isPublic,
        status:         "PASSED",
        xpEarned:       0,         // Sandbox XP vermez
        executionOutput: null,
      },
    });

    await prisma.reviewResult.create({
      data: {
        submissionId:        submission.id,
        correctness:         review.correctness,
        readability:         review.readability,
        timeComplexity:      review.timeComplexity,
        spaceComplexity:     review.spaceComplexity,
        idiomaticStyle:      review.idiomaticStyle,
        overallScore:        review.overallScore,
        feedbackPositive:    review.feedbackPositive,
        feedbackImprovement: review.feedbackImprovement,
        complexityNote:      review.complexityNote,
      },
    });

    return NextResponse.json(
      {
        submissionId: submission.id,
        score:        review.overallScore,
        review,
        message:      "Kod portfolyona eklendi!",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/sandbox/portfolio] DB hatası:", err);
    return NextResponse.json({ error: "Portfolyo kaydedilemedi." }, { status: 500 });
  }
}

// ─── Yardımcı: Dile göre sandbox placeholder challenge ID'si ─────
//
// Her dil için seed'lenmiş bir "sandbox" challenge kaydı olmalı.
// Bu kayıtlar `source: STATIC, isSandbox: true` ile prisma/seed.ts'te oluşturulur.
// Örnek seed:
//   prisma.challenge.create({ data: { title: "Python Sandbox", language: "PYTHON",
//     isSandbox: true, source: "STATIC", difficulty: 1, xpReward: 0, ... } })

async function getSandboxChallengeId(language: Language): Promise<string> {
  const placeholder = await prisma.challenge.findFirst({
    where:  { isSandbox: true, source: "STATIC", language },
    select: { id: true },
  });

  if (!placeholder) {
    throw new Error(
      `[getSandboxChallengeId] ${language} için sandbox placeholder challenge bulunamadı. ` +
      `prisma/seed.ts dosyasını kontrol edin.`
    );
  }

  return placeholder.id;
}

export async function DELETE(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Submission ID gereklidir." }, { status: 400 });
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!submission) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    }

    if (submission.userId !== user.id) {
      return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    }

    await prisma.submission.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Silme başarılı." }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/sandbox/portfolio] DB hatası:", err);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
}
