import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
    const r = await db.challenge.deleteMany({ where: { source: "AI_GENERATED" } });
    console.log("Silindi:", r.count);
    await db.$disconnect();
}

main().catch(console.error);