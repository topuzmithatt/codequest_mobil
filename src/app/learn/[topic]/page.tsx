// src/app/learn/[topic]/page.tsx
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getChallenge } from "@/lib/learn/getChallenge";
import { LearnClient } from "./LearnClient";
import { redirect } from "next/navigation";

import { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  return {
    title: topic.charAt(0).toUpperCase() + topic.slice(1).replace(/-/g, ' '),
  };
}

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ lpId?: string }>;
}) {
  const { topic } = await params;
  const { lpId } = await searchParams;
  const user = await getCurrentUser();

  console.log(`[LearnPage] Triggered for user=${user.id}, topic=${topic}, lpId=${lpId}`);

  let result: Awaited<ReturnType<typeof getChallenge>>;
  try {
    result = await getChallenge(user.id, topic, lpId);
  } catch (err: unknown) {
    const statusCode = (err as { status?: number })?.status;
    const isRateLimit = statusCode === 429;

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1e1e1e",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div style={{
          maxWidth: 440,
          padding: 32,
          background: "#252526",
          border: "1px solid #3c3c3c",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {isRateLimit ? "⏳" : "⚠️"}
          </div>
          <h2 style={{ color: "#e2c08d", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            {isRateLimit ? "AI Motoru Dinleniyor" : "Görev Yüklenemedi"}
          </h2>
          <p style={{ color: "#858585", fontSize: 12, lineHeight: 1.8, marginBottom: 24 }}>
            {isRateLimit
              ? "AI görev üretici şu an çok meşgul (günlük limit). Birkaç dakika sonra tekrar dene."
              : "Görev yüklenirken bir hata oluştu. Lütfen tekrar dene."}
          </p>
          <a
            href={`/learn/${topic}`}
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#007acc",
              borderRadius: 4,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Tekrar Dene
          </a>
        </div>
      </div>
    );
  }

  // Redirect check outside try/catch!
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  const { challenge, learningPath } = result;

  console.log(`[LearnPage] Challenge selected successfully: id=${challenge.id}, title=${challenge.title}`);

  return (
    <LearnClient
      challenge={challenge}
      learningPathId={learningPath.id}
      userId={user.id}
      hearts={user.hearts}
      xp={user.xp}
      level={user.level}
      streak={0}
    />
  );
}