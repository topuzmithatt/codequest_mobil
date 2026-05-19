import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const db = new PrismaClient({ adapter });

    const challenges = await db.challenge.findMany({
        where: { isSandbox: false, source: "STATIC" },
        include: { testCases: true },
        orderBy: [{ language: "asc" }, { difficulty: "asc" }]
    });

    console.log("\n=== SORUNLU SORULAR ===\n");
    let sorunluSayisi = 0;

    for (const c of challenges) {
        const sorunlar: string[] = [];

        for (const tc of c.testCases) {
            if (!tc.expectedOutput || tc.expectedOutput.trim() === "") {
                sorunlar.push("❌ expectedOutput BOŞ");
                break;
            }
            if (tc.expectedOutput.includes("?") || tc.expectedOutput.includes("hata:")) {
                sorunlar.push(`⚠️  Şüpheli expectedOutput: "${tc.expectedOutput.slice(0, 60)}"`);
                break;
            }
        }

        if (sorunlar.length > 0) {
            sorunluSayisi++;
            console.log(`ID: ${c.id}`);
            console.log(`Başlık: ${c.title} | ${c.language} / diff:${c.difficulty}`);
            for (const s of sorunlar) console.log(`  ${s}`);
            console.log("");
        }
    }

    if (sorunluSayisi === 0) {
        console.log("✅ Tüm sorular temiz! Hiç sorun yok.\n");
    } else {
        console.log(`Toplam ${sorunluSayisi} sorunlu soru.\n`);
    }

    await db.$disconnect();
}

main().catch(console.error);