// /src/app/api/submit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { runTests } from "@/lib/sandbox/pistonClient";
import { processSubmission, checkAndAwardBadges } from "@/lib/gamification/engine";
import { reviewCode } from "@/lib/ai/reviewer";
import type { Language } from "@prisma/client";

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

  let code: string, language: Language, challengeId: string;
  let learningPathId: string | undefined;
  let singleTestCase: { input: string; expectedOutput: string } | undefined;

  try {
    const body       = await req.json();
    code             = body.code;
    language         = body.language;
    challengeId      = body.challengeId;
    learningPathId   = body.learningPathId;
    singleTestCase   = body.singleTestCase;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!code || !language || !challengeId) {
    return NextResponse.json({ error: "code, language ve challengeId zorunlu." }, { status: 400 });
  }

  const challenge = await prisma.challenge.findUnique({
    where:   { id: challengeId },
    include: { testCases: true },
  });

  if (!challenge) {
    return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });
  }

  if (!challenge.isSandbox) {
    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { hearts: true },
    });
    if ((dbUser?.hearts ?? 0) <= 0) {
      return NextResponse.json(
        { error: "Can kalmadı. Sandbox veya eski konu tekrarına geçebilirsin." },
        { status: 403 }
      );
    }
  }

  const submission = await prisma.submission.create({
    data: {
      userId:         user.id,
      challengeId,
      learningPathId: learningPathId ?? null,
      code,
      language,
      isSandbox:      challenge.isSandbox,
      status:         "PENDING",
    },
  });

  try {
    // Tek test case mi yoksa tümü mü?
    const testCasesToRun = singleTestCase
      ? [singleTestCase]
      : challenge.testCases;

    const testRun = await runTests(code, language, testCasesToRun);

    const gamification = await processSubmission(
      user.id,
      submission.id,
      testRun.allPassed,
      challenge.xpReward
    );

    let review = null;
    if (testRun.allPassed) {
      const rawReview = await reviewCode({
        code,
        language,
        challengeDescription: challenge.description,
        difficulty:           challenge.difficulty,
      });
      review = await prisma.reviewResult.create({
        data: { ...rawReview, submissionId: submission.id },
      });
    }

    if (learningPathId) {
      const lp = await prisma.learningPath.findUnique({ where: { id: learningPathId } });
      if (lp) {
        let { currentDifficulty, consecutiveCorrect, consecutiveWrong } = lp;
        if (testRun.allPassed) {
          consecutiveWrong   = 0;
          consecutiveCorrect += 1;
          if (consecutiveCorrect >= 3) { currentDifficulty = Math.min(10, currentDifficulty + 1); consecutiveCorrect = 0; }
        } else {
          consecutiveCorrect = 0;
          consecutiveWrong  += 1;
          if (consecutiveWrong >= 2) { currentDifficulty = Math.max(1, currentDifficulty - 1); consecutiveWrong = 0; }
        }
        await prisma.learningPath.update({
          where: { id: learningPathId },
          data:  { currentDifficulty, consecutiveCorrect, consecutiveWrong },
        });
      }
    }

    const newBadges = await checkAndAwardBadges(user.id);

    return NextResponse.json({
      submissionId: submission.id,
      passed:       testRun.allPassed,
      testResults:  testRun.results,
      passedCount:  testRun.passedCount,
      totalCount:   testRun.totalCount,
      gamification: {
        xpResult:     gamification.xpResult,
        heartResult:  gamification.heartResult,
        streakResult: gamification.streakResult,
        newBadges:    newBadges,
      },
      review: review ? {
        overallScore:        review.overallScore,
        correctness:         review.correctness,
        readability:         review.readability,
        timeComplexity:      review.timeComplexity,
        spaceComplexity:     review.spaceComplexity,
        idiomaticStyle:      review.idiomaticStyle,
        feedbackPositive:    review.feedbackPositive,
        feedbackImprovement: review.feedbackImprovement,
        complexityNote:      review.complexityNote,
      } : null,
    });
  } catch (err) {
    await prisma.submission.update({ where: { id: submission.id }, data: { status: "FAILED" } }).catch(() => {});
    console.error("[POST /api/submit]", err);
    return NextResponse.json({ error: "Gönderim işlenirken hata oluştu." }, { status: 500 });
  }
}