// /src/lib/auth/getCurrentUser.ts
// Supabase session'ından aktif kullanıcıyı döndürür.
// Oturum yoksa Next.js redirect("/login") çağırır — Server Component ve route handler'larda kullanılır.

import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { refillHearts } from "@/lib/gamification/engine";

/**
 * Server Component veya Server Action içinde çağrılır.
 * Supabase session'ı doğrular, ardından Prisma'dan tam User kaydını döndürür.
 * Geçerli session yoksa /login'e yönlendirir (return etmez).
 *
 * @returns Prisma User kaydı (gamification alanları dahil)
 *
 * @example
 * // Server Component içinde:
 * const user = await getCurrentUser();
 * // user.hearts, user.xp, user.level — güvenle kullanılabilir
 */
export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  // Oturum yoksa veya token geçersizse login'e yönlendir
  if (error || !authUser) {
    redirect("/login");
  }

  // Prisma'dan tam kaydı çek — gamification alanları burada
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  // Auth var ama DB kaydı yoksa (ilk kayıt henüz tamamlanmamış edge case)
  if (!dbUser) {
    redirect("/login");
  }

  // Canları otomatik refill et ve güncel veriyi al
  const refillResult = await refillHearts(dbUser.id);
  dbUser.hearts = refillResult.newHearts;
  dbUser.heartsLastFill = refillResult.heartsLastFill;

  return dbUser;
}
