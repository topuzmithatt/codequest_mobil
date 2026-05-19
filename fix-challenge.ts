import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Groq from "groq-sdk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";
const TEMP_DIR = path.join(process.cwd(), ".temp_exec_api");

// Son kalan inatçı SQL sorusu
const TARGET_ID = "cmp100y9s000opgi9edns47yd";

function turkishToAscii(s: string): string {
    return s
        .replace(/ş/g, "s").replace(/Ş/g, "s")
        .replace(/ç/g, "c").replace(/Ç/g, "c")
        .replace(/ğ/g, "g").replace(/Ğ/g, "g")
        .replace(/ü/g, "u").replace(/Ü/g, "u")
        .replace(/ö/g, "o").replace(/Ö/g, "o")
        .replace(/ı/g, "i").replace(/İ/g, "i");
}

function normalize(s: string): string {
    return turkishToAscii(
        s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
            .split("\n").map(l => l.trimEnd()).join("\n")
            .trim().toLocaleLowerCase("tr-TR")
    );
}

function runSQL(code: string): string {
    const id = crypto.randomBytes(6).toString("hex");
    const filePath = path.join(TEMP_DIR, `fix_${id}.py`);
    const b64Code = Buffer.from(code).toString("base64");
    const runner = `# -*- coding: utf-8 -*-
import sys, sqlite3, base64
sys.stdout.reconfigure(encoding='utf-8')
sql_code = base64.b64decode('${b64Code}').decode('utf-8')
try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    for stmt in sql_code.split(';'):
        stmt = stmt.strip()
        if not stmt: continue
        cursor.execute(stmt)
        if cursor.description:
            for row in cursor.fetchall():
                print("\\t".join(str(v) for v in row))
        elif stmt.upper().startswith(("INSERT","UPDATE","DELETE")):
            print(f"{cursor.rowcount} row(s) affected")
    conn.commit()
except Exception as e:
    print(f"Hata: {e}")
finally:
    conn.close()
`;
    fs.writeFileSync(filePath, runner, "utf8");
    try {
        return execSync(`python "${filePath}"`, { timeout: 8000, encoding: "utf8" }).trim();
    } catch (e: any) {
        return (e.stdout ?? "").trim();
    } finally {
        try { fs.unlinkSync(filePath); } catch { }
    }
}

async function main() {
    console.log(`\n🔧 ${TARGET_ID} düzeltiliyor...\n`);

    const prompt = `
Sen CodeQuest platformunun içerik üreticisisin.
SQLite3 SQL dilinde zorluk 8/10 bir soru üret.

SQL KURALLAR:
- Görev MUTLAKA SELECT sorgusu döndürmeli.
- Kullanıcı stdin'den input OKUMAZ — saf SQL kodu yazar.
- starterCode: Sadece SQL yorumu olmalı.
- testInputs MUTLAKA ["","",""] olmalı.
- Tablo verisi görevin kendi SQL kodu içinde olmalı.
- Görev; tablo oluştur, veri ekle, karmaşık SELECT yap (JOIN, GROUP BY vb.) şeklinde olmalı.

SADECE JSON döndür:
{
  "title": "...",
  "description": "...",
  "starterCode": "-- Sorgunuzu buraya yazın",
  "hints": ["...", "..."],
  "testInputs": ["", "", ""]
}
`.trim();

    const step1Res = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
    });
    const step1 = JSON.parse(step1Res.choices[0]?.message?.content ?? "");
    console.log(`✓ Soru üretildi: "${step1.title}"`);

    const solutionPrompt = `
Sen bir SQLite3 SQL uzmanısın.
Aşağıdaki görevi çözen REFERANS ÇÖZÜMÜ yaz.

Görev: ${step1.title}
Açıklama: ${step1.description}

Kurallar:
- Saf SQL kodu yaz.
- CREATE TABLE + INSERT + SELECT içermeli.
- Sütun isimlerinde veya tablo alias'larında (O.id gibi) DİKKATLİ OL. Tanımlamadığın alias'ı kesinlikle kullanma!
- String içinde çift tırnak yerine tek tırnak kullan.
- SADECE "solutionCode" ile JSON döndür.

SADECE JSON:
{"solutionCode": "..."}
`.trim();

    const step2Res = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: solutionPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
    });
    const { solutionCode } = JSON.parse(step2Res.choices[0]?.message?.content ?? "");

    const output = runSQL(solutionCode);
    console.log(`✓ Çıktı:\n"${output}"\n`);

    // Hata kontrolünü daha geniş tuttuk
    if (!output || output.toLowerCase().includes("hata:")) {
        console.log("❌ Yapay zeka yine hatalı SQL üretti. Lütfen komutu tekrar çalıştır.");
        await db.$disconnect();
        return;
    }

    const testCases = [
        { input: "", expectedOutput: normalize(output) },
        { input: "", expectedOutput: normalize(output) },
        { input: "", expectedOutput: normalize(output) },
    ];

    // Soruyu UPDATE ediyoruz (ID değişmeyecek)
    await db.challenge.update({
        where: { id: TARGET_ID },
        data: {
            title: step1.title,
            description: step1.description,
            starterCode: step1.starterCode,
            solutionCode,
            hints: step1.hints,
            testCases: {
                deleteMany: {},
                create: testCases.map(tc => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    description: "",
                    hints: [],
                    isHidden: false,
                }))
            },
        },
    });

    console.log(`✅ Son soru da başarıyla düzeltildi! Yeni Başlık: "${step1.title}"\n`);
    await db.$disconnect();
}

main().catch(console.error);