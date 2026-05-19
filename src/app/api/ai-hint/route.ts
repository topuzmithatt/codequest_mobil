// /src/app/api/ai-hint/route.ts
// POST /api/ai-hint — AI destekli ipucu üretimi

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Groq from "groq-sdk";

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key_for_build" });
const MODEL = "llama-3.3-70b-versatile";

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
  let code: string, language: string, challengeDescription: string, errorOutput: string | undefined;
  try {
    const body = await req.json();
    code                 = body.code;
    language             = body.language;
    challengeDescription = body.challengeDescription;
    errorOutput          = body.errorOutput ?? undefined;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!code || !language || !challengeDescription) {
    return NextResponse.json(
      { error: "code, language ve challengeDescription alanları zorunlu." },
      { status: 400 }
    );
  }

  // ── Groq ile ipucu üret ───────────────────────────────────────
  try {
    const userMessage = `
Görev açıklaması:
${challengeDescription}

Dil: ${language}

Kullanıcının kodu:
\`\`\`
${code}
\`\`\`
${errorOutput ? `\nHata çıktısı:\n${errorOutput}` : ""}
`.trim();

    const response = await groq.chat.completions.create({
      model:       MODEL,
      messages: [
        {
          role:    "system",
          content: "Sen bir yazılım eğitmenisin. Kullanıcının kodunu ve varsa hata çıktısını inceleyerek ne yapması gerektiğine dair bir ipucu ver. Cevabı doğrudan verme, yönlendir. Türkçe yaz. 2-4 cümle.",
        },
        {
          role:    "user",
          content: userMessage,
        },
      ],
      temperature: 0.7,
      max_tokens:  300,
    });

    const hint = response.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ hint });
  } catch (err: unknown) {
    console.error("[POST /api/ai-hint]", err);
    const statusCode = (err as { status?: number })?.status;
    if (statusCode === 429) {
      return NextResponse.json({ error: "AI motoru şu an meşgul (günlük limit). Birkaç dakika sonra tekrar dene." }, { status: 429 });
    }
    return NextResponse.json({ error: "İpucu üretilemedi." }, { status: 500 });
  }
}
