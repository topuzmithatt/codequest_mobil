// /src/lib/learn/getChallenge.ts

import { prisma } from "@/lib/prisma";
import type { Challenge, LearningPath } from "@prisma/client";

interface TestCaseWithDetails {
  id: string;
  input: string;
  expectedOutput: string;
  description: string | null;
  hints: string[];
}

interface ChallengeWithTests extends Challenge {
  testCases: TestCaseWithDetails[];
}

export interface GetChallengeResult {
  challenge: ChallengeWithTests;
  learningPath: LearningPath;
}

const TEST_CASE_SELECT = {
  id: true,
  input: true,
  expectedOutput: true,
  description: true,
  hints: true,
};

export interface RedirectResult {
  redirectTo: string;
}

export class NoChallengeAvailableError extends Error {
  constructor(public topic: string, public language: string) {
    super(`[getChallenge] ${language} / ${topic} için statik görev bulunamadı.`);
    this.name = "NoChallengeAvailableError";
  }
}

export async function getChallenge(
  userId: string,
  topic: string,
  lpId?: string
): Promise<GetChallengeResult | RedirectResult> {
  // lpId varsa o spesifik LearningPath'i kullan, yoksa en son olanı al
  let learningPath: LearningPath | null = null;

  if (lpId) {
    learningPath = await prisma.learningPath.findFirst({
      where: { id: lpId, userId },
    });
  }

  // lpId yoksa veya bulunamadıysa → en son oluşturulan LearningPath
  if (!learningPath) {
    learningPath = await prisma.learningPath.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!learningPath) {
    throw new Error(`[getChallenge] userId=${userId} için LearningPath bulunamadı.`);
  }

  const answeredIds = await prisma.submission.findMany({
    where: { userId, challenge: { topic }, status: "PASSED" },
    select: { challengeId: true },
  }).then((rows) => rows.map((r) => r.challengeId));

  console.log(`[getChallenge] User=${userId}, Topic=${topic}, Language=${learningPath.language}, CurrentDifficulty=${learningPath.currentDifficulty}, AnsweredIds Count=${answeredIds.length}, AnsweredIds=${JSON.stringify(answeredIds)}`);

  // 1. Önce zorluk aralığına uyan statik soruyu dene
  const staticChallenge = await prisma.challenge.findFirst({
    where: {
      topic,
      source: "STATIC",
      isSandbox: false,
      language: learningPath.language,
      id: { notIn: answeredIds },
      difficulty: {
        gte: Math.max(1, learningPath.currentDifficulty - 1),
        lte: Math.min(10, learningPath.currentDifficulty + 1),
      },
    },
    include: { testCases: { select: TEST_CASE_SELECT } },
    orderBy: { difficulty: "asc" },
  });

  if (staticChallenge) {
    return { challenge: staticChallenge as ChallengeWithTests, learningPath };
  }

  // 2. Zorluk aralığı dışında da olsa aynı dil + topic'te soru var mı?
  const fallbackChallenge = await prisma.challenge.findFirst({
    where: {
      topic,
      source: "STATIC",
      isSandbox: false,
      language: learningPath.language,
      id: { notIn: answeredIds },
    },
    include: { testCases: { select: TEST_CASE_SELECT } },
    orderBy: { difficulty: "asc" },
  });

  if (fallbackChallenge) {
    return { challenge: fallbackChallenge as ChallengeWithTests, learningPath };
  }

  // EĞER BURAYA GELİNDİYSE: Kullanıcı bu konudaki tüm statik soruları başarıyla ÇÖZMÜŞTÜR!
  // Bir sonraki konuya geçişi otomatik tetikleyelim.
  const topicIndex = learningPath.topicsOrder.indexOf(topic);
  if (topicIndex !== -1) {
    if (topicIndex < learningPath.topicsOrder.length - 1) {
      const nextTopic = learningPath.topicsOrder[topicIndex + 1];
      
      // Eğer bitirdiği konu öğrenme yolundaki aktif konuya eşitse index'i ilerlet
      if (topicIndex === learningPath.currentTopicIndex) {
        await prisma.learningPath.update({
          where: { id: learningPath.id },
          data: { currentTopicIndex: topicIndex + 1 },
        });
      }
      
      console.log(`[getChallenge] Topic completed! Advancing from ${topic} to ${nextTopic} for user ${userId}`);
      return { redirectTo: `/learn/${nextTopic}?lpId=${learningPath.id}` };
    } else {
      // Tüm konular bitmiş! Kullanıcıyı tebrik ekranı için profile yönlendir
      console.log(`[getChallenge] All topics completed for user ${userId}! Redirecting to profile.`);
      return { redirectTo: `/profile?completedPath=${learningPath.id}` };
    }
  }

  // 3. Eğer konu topicsOrder içinde değilse (fallback olarak tekrar göster)
  const repeatChallenge = await prisma.challenge.findFirst({
    where: {
      topic,
      source: "STATIC",
      isSandbox: false,
      language: learningPath.language,
    },
    include: { testCases: { select: TEST_CASE_SELECT } },
    orderBy: { difficulty: "asc" },
  });

  if (repeatChallenge) {
    return { challenge: repeatChallenge as ChallengeWithTests, learningPath };
  }

  // 4. Hiç statik soru yoksa hata fırlat — AI üretimine düşme
  throw new NoChallengeAvailableError(topic, learningPath.language);
}