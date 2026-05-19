// /src/app/api/profile/update/route.ts
// POST /api/profile/update — Kullanıcı adı güncelleme

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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
  let username: string;
  try {
    const body = await req.json();
    username = body.username?.trim();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Kullanıcı adı en az 3 karakter olmalı." },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "Kullanıcı adı yalnızca harf, rakam ve _ içerebilir." },
      { status: 400 }
    );
  }

  // ── Unique kontrolü ───────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "Bu kullanıcı adı zaten kullanılıyor." },
      { status: 409 }
    );
  }

  // ── Güncelleme ────────────────────────────────────────────────
  try {
    await prisma.user.update({
      where: { id: user.id },
      data:  { username },
    });

    return NextResponse.json({ success: true, username });
  } catch (err) {
    console.error("[POST /api/profile/update]", err);
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }
}