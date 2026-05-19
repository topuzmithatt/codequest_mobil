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

    for (const c of challenges) {
        console.log("\n" + "=".repeat(60));
        console.log("Başlık   :", c.title);
        console.log("Dil      :", c.language, "| Zorluk:", c.difficulty);
        console.log("\nAçıklama :", c.description);
        console.log("\nStarter  :\n" + c.starterCode);
        console.log("\nÇözüm    :\n" + c.solutionCode);
        console.log("\nTest Cases:");
        for (const tc of c.testCases) {
            console.log("  Input   :", JSON.stringify(tc.input));
            console.log("  Beklenen:", JSON.stringify(tc.expectedOutput));
        }
    }

    await db.$disconnect();
}

main().catch(console.error);