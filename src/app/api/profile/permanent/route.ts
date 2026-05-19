// /src/app/api/profile/permanent/route.ts
// POST /api/profile/permanent — Misafir hesabı kalıcılaştır (email + şifre ekle)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  let email: string, password: string;
  try {
    const body = await req.json();
    email    = body.email?.trim();
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email ve şifre zorunlu." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Şifre en az 6 karakter olmalı." },
      { status: 400 }
    );
  }

  // ── Supabase: updateUser ile email + şifre ekle ──────────────
  // Misafir hesap zaten var, şimdi credential'lar ekleniyor.
  try {
    const { error } = await supabase.auth.updateUser({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/profile/permanent]", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Hesap kaydedilemedi." },
      { status: 500 }
    );
  }
}