// /src/app/portfolio/page.tsx
// Giriş yapmış kullanıcıyı kendi portfolio sayfasına yönlendirir.

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect }       from "next/navigation";

export default async function PortfolioIndexPage() {
  const user = await getCurrentUser();
  redirect(`/portfolio/${user.username}`);
}
