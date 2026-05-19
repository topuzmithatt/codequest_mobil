// /src/lib/gamification/engine.ts
// CodeQuest — Gamification Motoru

import { prisma } from "@/lib/prisma";

const MAX_HEARTS           = 5;
const HEART_REFILL_MS      = 60 * 60 * 1000;
const XP_MULTIPLIER_STREAK = 1.5;
const XP_MULTIPLIER_BASE   = 1.0;

const LEVEL_THRESHOLDS: Record<number, number> = {
  1:    0,
  2:  100,
  3:  250,
  4:  450,
  5:  700,
  6: 1000,
  7: 1400,
  8: 1900,
  9: 2500,
  10: 3200,
};
const MAX_LEVEL = 10;

export interface AwardXPResult {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  badgeAwarded: string | null;
}

export interface LoseHeartResult {
  newHearts: number;
  isBlocked: boolean;
}

export interface RefillHeartsResult {
  newHearts:      number;
  refilledCount:  number;
  heartsLastFill: Date;   // Modal için eklendi
}

export interface UpdateStreakResult {
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  multiplierReset: boolean;
}

export interface ProcessSubmissionResult {
  passed: boolean;
  xpResult:      AwardXPResult     | null;
  heartResult:   LoseHeartResult   | null;
  streakResult:  UpdateStreakResult | null;
}

function calculateLevel(totalXp: number): number {
  let level = 1;
  for (let lvl = MAX_LEVEL; lvl >= 1; lvl--) {
    if (totalXp >= LEVEL_THRESHOLDS[lvl]) { level = lvl; break; }
  }
  return level;
}

export async function awardXP(userId: string, xpAmount: number): Promise<AwardXPResult> {
  const user       = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const multiplier = user.xpMultiplier ?? XP_MULTIPLIER_BASE;
  const earned     = Math.round(xpAmount * multiplier);
  const newXp      = user.xp + earned;
  const newWeekly  = user.weeklyXp + earned;
  const oldLevel   = user.level;
  const newLevel   = Math.min(MAX_LEVEL, calculateLevel(newXp));
  const leveledUp  = newLevel > oldLevel;

  await prisma.user.update({ where: { id: userId }, data: { xp: newXp, weeklyXp: newWeekly, level: newLevel } });

  return { newXp, newLevel, leveledUp, badgeAwarded: null };
}

export async function loseHeart(userId: string): Promise<LoseHeartResult> {
  const user      = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const newHearts = Math.max(0, user.hearts - 1);
  await prisma.user.update({
    where: { id: userId },
    data: {
      hearts: newHearts,
      ...(user.hearts === MAX_HEARTS ? { heartsLastFill: new Date() } : {}),
    },
  });
  return { newHearts, isBlocked: newHearts === 0 };
}

export async function refillHearts(userId: string): Promise<RefillHeartsResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.hearts >= MAX_HEARTS) {
    return { newHearts: MAX_HEARTS, refilledCount: 0, heartsLastFill: user.heartsLastFill };
  }

  const now          = Date.now();
  const lastFill     = new Date(user.heartsLastFill).getTime();
  const elapsed      = now - lastFill;
  const hoursElapsed = Math.max(0, Math.floor(elapsed / HEART_REFILL_MS));

  if (hoursElapsed === 0) {
    return { newHearts: user.hearts, refilledCount: 0, heartsLastFill: user.heartsLastFill };
  }

  const refilledCount = Math.min(hoursElapsed, MAX_HEARTS - user.hearts);
  const newHearts     = user.hearts + refilledCount;
  const newLastFill   = new Date(lastFill + refilledCount * HEART_REFILL_MS);

  await prisma.user.update({ where: { id: userId }, data: { hearts: newHearts, heartsLastFill: newLastFill } });

  return { newHearts, refilledCount, heartsLastFill: newLastFill };
}

export async function updateStreak(userId: string): Promise<UpdateStreakResult> {
  let streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await prisma.streak.create({ data: { userId, currentStreak: 0, longestStreak: 0, isActive: false } });
  }

  const now   = new Date();
  const today = toDateOnly(now);
  const last  = toDateOnly(new Date(streak.lastActivityAt));

  if (streak.isActive && today === last) {
    return { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, streakBroken: false, multiplierReset: false };
  }

  const dayGap       = dateDiffDays(last, today);
  const streakBroken = dayGap > 1;
  let newStreak: number;
  let multiplierReset = false;

  if (streakBroken) {
    newStreak = 1;
    multiplierReset = true;
    await prisma.user.update({ where: { id: userId }, data: { xpMultiplier: XP_MULTIPLIER_BASE } });
  } else {
    newStreak = streak.currentStreak + 1;
    await prisma.user.update({ where: { id: userId }, data: { xpMultiplier: XP_MULTIPLIER_STREAK } });
  }

  const newLongest = Math.max(streak.longestStreak, newStreak);
  await prisma.streak.update({
    where: { userId },
    data:  { currentStreak: newStreak, longestStreak: newLongest, lastActivityAt: now, isActive: true },
  });

  return { currentStreak: newStreak, longestStreak: newLongest, streakBroken, multiplierReset };
}

export async function processSubmission(
  userId: string,
  submissionId: string,
  allPassed: boolean,
  xpReward: number
): Promise<ProcessSubmissionResult> {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });

  if (allPassed) {
    const { xp: xpBefore } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
    const [xpResult, streakResult] = await Promise.all([awardXP(userId, xpReward), updateStreak(userId)]);
    const xpEarned = xpResult.newXp - xpBefore;
    await prisma.submission.update({ where: { id: submissionId }, data: { status: "PASSED", xpEarned } });
    return { passed: true, xpResult, heartResult: null, streakResult };
  } else {
    const heartResult = submission.isSandbox ? null : await loseHeart(userId);
    await prisma.submission.update({ where: { id: submissionId }, data: { status: "FAILED" } });
    return { passed: false, xpResult: null, heartResult, streakResult: null };
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function dateDiffDays(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / msPerDay);
}

export async function checkAndAwardBadges(userId: string): Promise<{ name: string; iconUrl: string; description: string }[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      submissions: {
        where: { status: "PASSED" },
        include: { reviewResult: true },
      },
      streak: true,
      badges: true,
    }
  });

  const earnedBadgeIds = new Set(user.badges.map(b => b.badgeId));
  const allBadges = await prisma.badge.findMany();
  
  const badgesToAward: string[] = [];
  const newlyAwardedBadges: { name: string; iconUrl: string; description: string }[] = [];

  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    let shouldAward = false;

    if (badge.type === "LEVEL") {
      shouldAward = user.level >= badge.requiredValue;
    } else if (badge.type === "CHALLENGE") {
      const completedCount = user.submissions.length;
      shouldAward = completedCount >= badge.requiredValue;
    } else if (badge.type === "STREAK") {
      const longestStreak = user.streak?.longestStreak ?? 0;
      shouldAward = longestStreak >= badge.requiredValue;
    } else if (badge.type === "SPECIAL") {
      if (badge.name === "Gece Kuşu") {
        // Night Owl: a passed submission between 00:00 and 05:00 AM
        shouldAward = user.submissions.some(sub => {
          const hours = new Date(sub.createdAt).getHours();
          return hours >= 0 && hours < 5;
        });
      } else if (badge.name === "Kusursuz Kod") {
        // Perfect Code: review result with score >= 90
        shouldAward = user.submissions.some(sub => {
          return sub.reviewResult ? sub.reviewResult.overallScore >= 90 : false;
        });
      } else if (badge.name === "Hızlı Çözücü") {
        // Fast Solver: let's award it if they have solved at least 1 challenge successfully
        shouldAward = user.submissions.length >= 1;
      } else if (badge.name === "Meraklı Zihin") {
        // Sandbox Mind: solved at least 1 sandbox challenge
        shouldAward = user.submissions.some(sub => sub.isSandbox);
      } else if (badge.name === "Erken Kalkan Yol Alır") {
        // Early Bird: passed submission between 05:00 and 08:00 AM
        shouldAward = user.submissions.some(sub => {
          const hours = new Date(sub.createdAt).getHours();
          return hours >= 5 && hours < 8;
        });
      } else if (badge.name === "Çok Yönlü") {
        // Polyglot: solved challenges in at least 2 distinct languages
        const languages = new Set(user.submissions.map(sub => sub.language));
        shouldAward = languages.size >= 2;
      } else if (badge.name === "Dil Uzmanı") {
        // Language Expert: solved challenges in at least 3 distinct languages
        const languages = new Set(user.submissions.map(sub => sub.language));
        shouldAward = languages.size >= 3;
      } else if (badge.name === "Hata Avcısı") {
        // Bug Hunter: at least 5 submissions with review score >= 90
        const perfectSubs = user.submissions.filter(sub => 
          sub.reviewResult ? sub.reviewResult.overallScore >= 90 : false
        );
        shouldAward = perfectSubs.length >= 5;
      }
    }

    if (shouldAward) {
      badgesToAward.push(badge.id);
      newlyAwardedBadges.push({
        name: badge.name,
        iconUrl: badge.iconUrl,
        description: badge.description,
      });
    }
  }

  if (badgesToAward.length > 0) {
    // Save all to database in a single transaction
    await prisma.$transaction(
      badgesToAward.map(badgeId => 
        prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId } },
          create: { userId, badgeId },
          update: {},
        })
      )
    );
  }

  return newlyAwardedBadges;
}