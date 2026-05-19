// /src/app/profile/page.tsx
// Next.js 15 App Router — Server Component

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { prisma }         from "@/lib/prisma";
import { VSCodeLayout }   from "@/components/layout/VSCodeLayout";
import { checkAndAwardBadges } from "@/lib/gamification/engine";
import {
  ProfileHeader,
  StatsGrid,
  BadgeShelf,
  WeeklyLeaderboard,
  type ProfileUser,
  type ProfileStats,
  type BadgeData,
  type LeaderboardEntry,
} from "@/components/profile/index";
import { ProfileTour } from "./ProfileTour";
import { ProfileActions } from "@/components/profile/ProfileActions";

export const metadata = {
  title: "Profil",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  
  // Önce yeni veya hak kazanılmış rozetleri kontrol et ve veritabanına ekle
  await checkAndAwardBadges(user.id);

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      submissions: {
        where:   { status: "PASSED" },
        orderBy: { createdAt: "desc" },
        select:  { id: true, createdAt: true },
      },
      badges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
      },
      streak:        true,
      learningPaths: true,
    },
  });

  const topUsers = await prisma.user.findMany({
    orderBy: { weeklyXp: "desc" },
    take:    10,
    select:  { id: true, username: true, weeklyXp: true, level: true },
  });

  const profileUser: ProfileUser = {
    id:       dbUser.id,
    username: dbUser.username,
    level:    dbUser.level,
    xp:       dbUser.xp,
    hearts:   dbUser.hearts,
  };

  const stats: ProfileStats = {
    totalXp:             dbUser.xp,
    level:               dbUser.level,
    currentStreak:       dbUser.streak?.currentStreak ?? 0,
    completedChallenges: dbUser.submissions.length,
  };

  const allBadges = await prisma.badge.findMany({ orderBy: { requiredValue: "asc" } });
  const earnedSet = new Set(dbUser.badges.map((ub) => ub.badgeId));

  let badges: BadgeData[] = allBadges.map((badge) => {
    const userBadge = dbUser.badges.find((ub) => ub.badgeId === badge.id);
    return {
      id:          badge.id,
      name:        badge.name,
      description: badge.description,
      iconUrl:     badge.iconUrl,
      earned:      earnedSet.has(badge.id),
      earnedAt:    userBadge
        ? new Date(userBadge.earnedAt).toLocaleDateString("tr-TR")
        : undefined,
    };
  });



  const leaderboard: LeaderboardEntry[] = topUsers.map((u, i) => ({
    rank:     i + 1,
    userId:   u.id,
    username: u.username,
    weeklyXp: u.weeklyXp,
    level:    u.level,
  }));

  // Giriş yapan kullanıcının genel sıralamasını hesapla:
  const higherXpCount = await prisma.user.count({
    where: {
      weeklyXp: {
        gt: dbUser.weeklyXp,
      },
    },
  });
  const calculatedRank = higherXpCount + 1;

  const userRankInTop10 = leaderboard.find((e) => e.userId === user.id)?.rank ?? null;
  const currentUserEntry: LeaderboardEntry | null = !userRankInTop10
    ? {
        rank: calculatedRank,
        userId: dbUser.id,
        username: dbUser.username,
        weeklyXp: dbUser.weeklyXp,
        level: dbUser.level,
      }
    : null;

  // En son oluşturulan öğrenme yolundan doğru learn linki üret
  const firstPath = dbUser.learningPaths[0];
  const learnHref = firstPath
    ? `/learn/${firstPath.topicsOrder[0] ?? "variables"}?lpId=${firstPath.id}`
    : undefined;

  return (
    <VSCodeLayout
      userId={user.id}
      hearts={dbUser.hearts}
      xp={dbUser.xp}
      level={dbUser.level}
      streak={dbUser.streak?.currentStreak ?? 0}
      weeklyRank={calculatedRank}
      username={dbUser.username}
      learnHref={learnHref}
    >
      <div
        className="overflow-y-auto h-full px-6 py-6 space-y-6 relative"
        style={{ background: "#1e1e1e" }}
      >
        <ProfileTour />

        <div id="tour-step-1">
          <ProfileHeader user={profileUser} />
        </div>

        <ProfileActions portfolioUrl={`/portfolio/${dbUser.username}`} />

        <div id="tour-step-2">
          <StatsGrid     stats={stats} />
        </div>
        <div id="tour-step-3">
          <BadgeShelf    badges={badges} />
        </div>
        <div id="tour-step-4">
          <WeeklyLeaderboard
            leaderboard={leaderboard}
            currentUserId={user.id}
            currentUserEntry={currentUserEntry}
          />
        </div>
      </div>
    </VSCodeLayout>
  );
}