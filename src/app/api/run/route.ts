// /src/app/api/run/route.ts
// POST /api/run — "Çalıştır" butonu: kodu Piston üzerinden çalıştırır

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runCode } from "@/lib/sandbox/pistonClient";
import type { Language } from "@prisma/client";

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
  let code: string, language: Language, stdin: string | undefined;
  try {
    const body = await req.json();
    code     = body.code;
    language = body.language;
    stdin    = body.stdin;
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
      { error: `Desteklenmeyen dil: ${language}. Desteklenenler: ${SUPPORTED.join(", ")}` },
      { status: 422 }
    );
  }

  // ── Çalıştır ──────────────────────────────────────────────────
  try {
    const result = await runCode(code, language, stdin);
    return NextResponse.json({
      stdout:   result.stdout,
      stderr:   result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    });
} catch (err) {
  console.error("[POST /api/run]", err);
  return NextResponse.json({ error: "Kod çalıştırılamadı.", detail: (err as Error).message }, { status: 500 });
}}
