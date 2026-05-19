import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

    const empty = await db.challenge.findMany({
        where: { isSandbox: false, description: "" },
        select: { id: true, title: true, source: true, language: true, difficulty: true }
    });

    const all = await db.challenge.findMany({
        where: { isSandbox: false },
        select: { id: true, title: true, source: true, language: true, difficulty: true, description: true }
    });

    console.log(`\nToplam challenge: ${all.length}`);
    console.log(`Açıklaması boş: ${empty.length}\n`);

    if (empty.length > 0) {
        console.log("=== AÇIKLAMASI BOŞ OLANLAR ===");
        for (const c of empty) {
            console.log(`  [${c.source}] ${c.language} diff:${c.difficulty} — ${c.title} (${c.id})`);
        }
    }

    console.log("\n=== TÜM SORULAR ===");
    for (const c of all) {
        const desc = c.description?.slice(0, 60) || "(BOŞ)";
        console.log(`  [${c.source}] ${c.language} diff:${c.difficulty} — ${desc}`);
    }

    await db.$disconnect();
}

main().catch(console.error);