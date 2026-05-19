// /src/app/api/submission/visibility/route.ts
// PATCH /api/submission/visibility — Submission public/private toggle

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
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
  let submissionId: string, isPublic: boolean;
  try {
    const body = await req.json();
    submissionId = body.submissionId;
    isPublic     = body.isPublic;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (!submissionId || typeof isPublic !== "boolean") {
    return NextResponse.json(
      { error: "submissionId ve isPublic zorunlu." },
      { status: 400 }
    );
  }

  // ── Submission sahiplik kontrolü ─────────────────────────────
  const submission = await prisma.submission.findUnique({
    where:  { id: submissionId },
    select: { userId: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission bulunamadı." }, { status: 404 });
  }

  if (submission.userId !== user.id) {
    return NextResponse.json({ error: "Bu submission'ı düzenleme yetkin yok." }, { status: 403 });
  }

  // ── Güncelleme ────────────────────────────────────────────────
  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data:  { isPublic },
    });

    return NextResponse.json({ success: true, isPublic });
  } catch (err) {
    console.error("[PATCH /api/submission/visibility]", err);
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }
}