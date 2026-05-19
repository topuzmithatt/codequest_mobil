// prisma/seed.ts
// CodeQuest — Veritabanı Seed Script
// Her challenge için solutionCode da üretilip kaydedilir.

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

type SeedLanguage = "PYTHON" | "JAVASCRIPT" | "JAVA" | "SQL";

const LANGUAGES: SeedLanguage[] = ["PYTHON", "JAVASCRIPT", "JAVA", "SQL"];

const TOPICS: { topic: string; label: string }[] = [
  { topic: "variables", label: "Değişkenler ve Veri Tipleri" },
  { topic: "conditions", label: "Koşullar ve If/Else" },
  { topic: "loops", label: "Döngüler" },
  { topic: "functions", label: "Fonksiyonlar" },
  { topic: "arrays", label: "Diziler ve Listeler" },
];

const LANG_LABEL: Record<SeedLanguage, string> = {
  PYTHON: "Python 3",
  JAVASCRIPT: "JavaScript (ES2022)",
  JAVA: "Java 15",
  SQL: "SQLite3 SQL",
};

const MODEL = "llama-3.3-70b-versatile";
const TEMP_DIR = path.join(process.cwd(), ".temp_exec_api");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ─────────────────────────────────────────────
// Türkçe dahil normalize — pistonClient ile aynı mantık
// ─────────────────────────────────────────────
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
    s
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
      .toLocaleLowerCase("tr-TR")
  );
}

// ─────────────────────────────────────────────
// Kodu çalıştır ve stdout döndür
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Kodu çalıştır ve stdout döndür (Windows uyumlu)
// Input dosyaya yazılır, < ile stdin'e yönlendirilir
// ─────────────────────────────────────────────
function runCode(code: string, language: SeedLanguage, input: string): string {
  const id = crypto.randomBytes(6).toString("hex");
  const inputFile = path.join(TEMP_DIR, `input_${id}.txt`);
  fs.writeFileSync(inputFile, input, "utf8");

  let filePath = "";
  let javaDir = "";
  let cmd: string;

  if (language === "JAVA") {
    javaDir = path.join(TEMP_DIR, id);
    fs.mkdirSync(javaDir, { recursive: true });
    filePath = path.join(javaDir, "Main.java");
    fs.writeFileSync(filePath, code, "utf8");
    try {
      execSync(`javac "${filePath}"`, { timeout: 10000, encoding: "utf8" });
    } catch { /* derleme hatası */ }
    cmd = `java -cp "${javaDir}" Main < "${inputFile}"`;

  } else if (language === "SQL") {
    filePath = path.join(TEMP_DIR, `seed_${id}.py`);
    const b64Code = Buffer.from(code).toString("base64");
    const b64Input = Buffer.from(input).toString("base64");
    const runner = `# -*- coding: utf-8 -*-
import sys, sqlite3, base64
sys.stdout.reconfigure(encoding='utf-8')
sql_code  = base64.b64decode('${b64Code}').decode('utf-8')
test_input= base64.b64decode('${b64Input}').decode('utf-8')
try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    for stmt in test_input.split(';'):
        stmt = stmt.strip()
        if stmt: cursor.execute(stmt)
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
    cmd = `python "${filePath}"`;

  } else if (language === "JAVASCRIPT") {
    // Model bazen readline() (browser API) veya /dev/stdin kullanır — ikisini de düzelt
    let fixed = code
      // /dev/stdin → argüman dosyası
      .replace(
        /require\s*\(\s*['"]fs['"]\s*\)\s*\.readFileSync\s*\(\s*['"]\/dev\/stdin['"]/g,
        `require('fs').readFileSync(process.argv[2]`
      )
      .replace(/['"]\/dev\/stdin['"]/g, "process.argv[2]")
      // bare readline() → fs.readFileSync
      .replace(
        /\breadline\(\)/g,
        `require('fs').readFileSync(process.argv[2],'utf8').trim()`
      )
      // hardcoded 'input.txt' → argüman dosyası
      .replace(
        /readFileSync\s*\(\s*['"]input\.txt['"]/g,
        `readFileSync(process.argv[2]`
      );
    filePath = path.join(TEMP_DIR, `seed_${id}.js`);
    fs.writeFileSync(filePath, fixed, "utf8");
    cmd = `node "${filePath}" "${inputFile}"`;

  } else {
    // Python koduna encoding satırı ekle
    const pyCode = `# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')
` + code;
    filePath = path.join(TEMP_DIR, `seed_${id}.py`);
    fs.writeFileSync(filePath, pyCode, "utf8");
    cmd = `python "${filePath}" < "${inputFile}"`;
  }

  try {
    const stdout = execSync(cmd, { timeout: 8000, encoding: "utf8" });
    return stdout.trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string };
    return (err.stdout ?? "").trim();
  } finally {
    try { fs.unlinkSync(inputFile); } catch { /* yoksay */ }
    try {
      if (javaDir) fs.rmSync(javaDir, { recursive: true, force: true });
      else if (filePath) fs.unlinkSync(filePath);
    } catch { /* yoksay */ }
  }
}


// ─────────────────────────────────────────────
// Aşama 1 — Soru metni + test input'ları üret
// ─────────────────────────────────────────────
interface Step1Result {
  title: string;
  description: string;
  starterCode: string;
  difficulty: number;
  hints: string[];
  testInputs: string[];   // sadece input'lar, expectedOutput yok
}

async function generateStep1(
  topic: string,
  topicLabel: string,
  language: SeedLanguage,
  difficultyTarget: number
): Promise<Step1Result> {
  const isSql = language === "SQL";
  const prompt = `
Sen CodeQuest platformunun içerik üreticisisin.
${LANG_LABEL[language]} dilinde "${topicLabel}" konusunda BİR kodlama sorusu üret.
Zorluk seviyesi: ${difficultyTarget}/10

Seviye kısıtları:
${difficultyTarget <= 2 ? "- SADECE değişken atama ve print/SELECT kullan. Döngü, koşul, fonksiyon YASAK." : ""}
${difficultyTarget >= 3 && difficultyTarget <= 4 ? "- if/else ve basit for döngüsü kullanabilirsin. Fonksiyon tanımlama YASAK." : ""}
${difficultyTarget >= 5 && difficultyTarget <= 6 ? "- Fonksiyon tanımlama, listeler, döngüler serbest. Recursion ve class YASAK." : ""}
${difficultyTarget >= 7 ? "- Tüm yapılar serbest. Algoritmik düşünme beklenir." : ""}

${isSql ? `SQL ÖZEL KURALLAR:
- Görev MUTLAKA SELECT sorgusu döndürmeli — sonuç üretmeyen CREATE TABLE / INSERT gibi sorular YASAK.
- Kullanıcı stdin'den input OKUMAZ — saf SQL kodu yazar.
- starterCode: Sadece SQL yorumu olmalı. Örnek: "-- Sorgunuzu buraya yazın"
- testInputs: SQL için her zaman ["","",""] döndür.
- Gerekirse görevin içine CREATE TABLE + INSERT yapıp sonra SELECT yap — ama çıktı üretmeyen sorular OLMAYACAK.
- Örnek iyi görev: "Kullanıcılar tablosunu oluştur, 2 kayıt ekle, sonra tüm isimleri SELECT ile getir."
- testInputs MUTLAKA ["","",""] olmalı — JSON, küme parantezi veya başka format YASAK.
- Tablo verisi görevin kendi SQL kodu içinde olmalı, dışarıdan input gerekmez.` : `INPUT FORMAT KURALI (ÇOK ÖNEMLİ):
- Eğer birden fazla sayı/değer gerekiyorsa MUTLAKA tek satırda boşlukla ayır: "3 4" değil "3\\n4"
- Python'da buna göre: a, b = map(int, input().split()) kullan, iki ayrı input() YASAK
- Java'da: sc.nextLine().split(" ") ile tek satırdan oku
- testInputs içindeki değerler de bu formata uygun olmalı: ["3 4", "10 20", "7 8"]`}

Kurallar:
1. description: Türkçe, net, 2-4 cümle. Örnek girdi/çıktı içer.
2. starterCode: İskelet kod. Çözümü içermemeli. Java'da class adı "Main" olmalı.
3. hints: 1-2 Türkçe ipucu. Cevabı verme, yönlendir.
4. testInputs: TAM OLARAK 3 farklı test girdisi. Sadece ham değer.

SADECE JSON döndür (string içinde çift tırnak yerine tek tırnak kullan, triple-quote YASAK):
{
  "title": "...",
  "description": "...",
  "starterCode": "...",
  "difficulty": ${difficultyTarget},
  "hints": ["..."],
  "testInputs": ["...", "...", "..."]
}
`.trim();


  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw) as Step1Result;
  } catch {
    throw new Error(`[seed step1] JSON parse hatası: ${raw.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────
// Aşama 2 — Referans çözüm üret (deterministik)
// ─────────────────────────────────────────────
async function generateStep2(
  step1: Step1Result,
  language: SeedLanguage
): Promise<string> {
  const isSql = language === "SQL";
  const inputNote = isSql
    ? "Bu bir SQL sorusudur. Kullanıcı sadece SQL kodu yazar, stdin'den input okuma OLMAZ. Saf SQL sorgusu yaz."
    : language === "PYTHON"
      ? "Input okuma: Tek değer için input(), birden fazla için a, b = map(int, input().split()) kullan. İKİ AYRI input() KULLANMA."
      : language === "JAVASCRIPT"
        ? `Input okuma ZORUNLU KURAL:
- SADECE şu pattern'i kullan (sync, event-based değil):
  const fs = require('fs');
  const lines = fs.readFileSync(process.argv[2], 'utf8').trim().split('\\n');
  const parts = lines[0].split(' ');
- readline.createInterface KULLANMA — async olduğu için test edilemiyor.
- /dev/stdin KULLANMA — Windows'ta çalışmıyor.`
        : `Java ZORUNLU KURALLAR:
- Kod MUTLAKA şu yapıda olmalı, eksik olursa derlenmez:
  import java.util.Scanner;
  public class Main {
      public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          // kod buraya
      }
  }
- Sadece System.out.println(...) satırları YAZMA — class wrapper olmadan derlenmez.
- Input okuma: String line = sc.nextLine(); veya int a = sc.nextInt(); kullan.`;

  const prompt = `
Sen bir ${LANG_LABEL[language]} uzmanısın.
Aşağıdaki kodlama görevini çözen REFERANS ÇÖZÜMÜ yaz.

Görev: ${step1.title}
Açıklama: ${step1.description}
İskelet Kod:
${step1.starterCode}

Test Girdileri: ${step1.testInputs.filter(Boolean).join(" | ") || "(input yok)"}

ÖNEMLI: ${inputNote}

Ek kurallar:
- Çıktı formatı tutarlı olmalı. Türkçe karakter kullanıyorsan her test'te aynı şekilde yaz.
- String içinde çift tırnak kullanman gerekiyorsa escape et: \\"
- Triple-quote (""") KULLANMA — JSON bozulur.
- SADECE "solutionCode" alanıyla JSON döndür.

SADECE JSON döndür:
{"solutionCode": "..."}
`.trim();

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw);
    return parsed.solutionCode as string;
  } catch {
    throw new Error(`[seed step2] JSON parse hatası: ${raw.slice(0, 200)}`);
  }
}


// ─────────────────────────────────────────────
// Java doğrulama — kod derlenebiliyor mu?
// ─────────────────────────────────────────────
function isValidJava(code: string): boolean {
  // Basit statik kontrol — derleme yapmadan
  if (!code.includes("public class Main")) return false;
  if (!code.includes("public static void main")) return false;
  if (!code.includes("Scanner")) return false;
  // Açık parantez/süslü parantez dengesi kontrolü
  const opens = (code.match(/\{/g) ?? []).length;
  const closes = (code.match(/\}/g) ?? []).length;
  if (opens !== closes) return false;
  return true;
}

// ─────────────────────────────────────────────
// Python doğrulama — sözdizimi geçerli mi?
// ─────────────────────────────────────────────
function isValidPython(code: string): boolean {
  const id = crypto.randomBytes(6).toString("hex");
  const file = path.join(TEMP_DIR, `val_${id}.py`);
  fs.writeFileSync(file, code, "utf8");
  try {
    execSync(`python -c "import ast; ast.parse(open('${file.replace(/\\/g, '/')}').read())"`, { timeout: 5000 });
    // Fonksiyon tanımlı ama çağrılmıyor mu kontrol et
    const hasDefButNoCall = /^def \w+/m.test(code) && !/^\w+\(/m.test(code);
    if (hasDefButNoCall) return false;
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(file); } catch { /* yoksay */ }
  }
}

// ─────────────────────────────────────────────
// Aşama 3 — Kodu çalıştır → expectedOutput'ları doldur
// ─────────────────────────────────────────────
function generateStep3(
  solutionCode: string,
  language: SeedLanguage,
  testInputs: string[]
): { input: string; expectedOutput: string }[] {
  return testInputs.map((input) => {
    const output = runCode(solutionCode, language, input);
    return { input, expectedOutput: normalize(output) };
  });
}

// ─────────────────────────────────────────────
// Tam pipeline — 1 challenge üret
// ─────────────────────────────────────────────
async function generateChallenge(
  topic: string,
  topicLabel: string,
  language: SeedLanguage,
  difficultyTarget: number
): Promise<{
  title: string; description: string; starterCode: string;
  solutionCode: string; difficulty: number; hints: string[];
  testCases: { input: string; expectedOutput: string }[];
}> {
  const step1 = await generateStep1(topic, topicLabel, language, difficultyTarget);

  // Doğrulama + retry (max 3 deneme)
  let solutionCode = await generateStep2(step1, language);
  if (language === "PYTHON") {
    let attempts = 1;
    while (!isValidPython(solutionCode) && attempts < 3) {
      console.log(`    ⚠ Python sözdizimi hatası, tekrar üretiliyor (deneme ${attempts + 1}/3)…`);
      solutionCode = await generateStep2(step1, language);
      attempts++;
    }
  } else if (language === "JAVA") {
    let attempts = 1;
    while (!isValidJava(solutionCode) && attempts < 3) {
      console.log(`    ⚠ Java derleme hatası, tekrar üretiliyor (deneme ${attempts + 1}/3)…`);
      solutionCode = await generateStep2(step1, language);
      attempts++;
    }
    if (!isValidJava(solutionCode)) {
      console.log("    ✗ Java kodu 3 denemede de derlenemedi, expectedOutput boş kalacak.");
    }
  }

  const testCases = generateStep3(solutionCode, language, step1.testInputs);

  return {
    title: step1.title,
    description: step1.description,
    starterCode: step1.starterCode,
    solutionCode,
    difficulty: Math.min(10, Math.max(1, Math.round(step1.difficulty))),
    hints: step1.hints,
    testCases,
  };
}

// ─────────────────────────────────────────────
// Sandbox placeholder'lar
// ─────────────────────────────────────────────
async function seedSandboxPlaceholders(): Promise<number> {
  console.log("  → Sandbox placeholder'lar oluşturuluyor…");
  await db.challenge.deleteMany({ where: { isSandbox: true } });

  const placeholders = [
    { language: "PYTHON" as SeedLanguage, title: "_Sandbox Placeholder — Python", starterCode: "# Sandbox\n" },
    { language: "JAVASCRIPT" as SeedLanguage, title: "_Sandbox Placeholder — JavaScript", starterCode: "// Sandbox\n" },
    { language: "JAVA" as SeedLanguage, title: "_Sandbox Placeholder — Java", starterCode: "public class Main {\n    public static void main(String[] args) {\n    }\n}\n" },
    { language: "SQL" as SeedLanguage, title: "_Sandbox Placeholder — SQL", starterCode: "-- Sandbox\n" },
  ];

  for (const p of placeholders) {
    await db.challenge.create({
      data: {
        title: p.title,
        description: "Portfolio route için placeholder. Kullanıcıya gösterilmez.",
        starterCode: p.starterCode,
        language: p.language,
        difficulty: 1,
        xpReward: 0,
        hints: [],
        topic: "_sandbox",
        source: "STATIC",
        isSandbox: true,
      },
    });
  }

  return placeholders.length;
}

// ─────────────────────────────────────────────
// Statik challenge'lar
// ─────────────────────────────────────────────
async function seedStaticChallenges(existingSet: Set<string>): Promise<number> {
  let totalCreated = 0;
  const DIFFICULTIES = [2, 5, 8];   // Her konu/dil için 3 zorluk seviyesi

  for (const { topic, label } of TOPICS) {
    for (const language of LANGUAGES) {
      for (const diff of DIFFICULTIES) {
        const key = `${topic}|${language}|${diff}`;
        if (existingSet.has(key)) {
          console.log(`  ⏭  ${topic} / ${language} / difficulty:${diff} — zaten var, atlanıyor.`);
          continue;
        }
        console.log(`  → ${topic} / ${language} / difficulty:${diff} — üretiliyor…`);

        try {
          const challenge = await generateChallenge(topic, label, language, diff);

          await db.challenge.create({
            data: {
              title: challenge.title,
              description: challenge.description,
              starterCode: challenge.starterCode,
              solutionCode: challenge.solutionCode,
              language,
              difficulty: challenge.difficulty,
              xpReward: challenge.difficulty * 10,
              hints: challenge.hints,
              topic,
              source: "STATIC",
              isSandbox: false,
              testCases: {
                create: challenge.testCases.map((tc) => ({
                  input: tc.input,
                  expectedOutput: tc.expectedOutput,
                  description: "",
                  hints: [],
                  isHidden: false,
                })),
              },
            },
          });

          console.log(`  ✓ Oluşturuldu: "${challenge.title}" (${language} / diff:${challenge.difficulty})`);
          console.log(`    Çözüm: ${challenge.solutionCode.slice(0, 80).replace(/\n/g, " ")}…`);
          totalCreated++;

        } catch (err) {
          console.error(`  ✗ ${topic}/${language}/diff:${diff}: ${(err as Error).message}`);
        }

        // Rate limit için kısa bekleme
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  return totalCreated;
}

// ─────────────────────────────────────────────
// Rozetler (Badges) Seed Et
// ─────────────────────────────────────────────
async function seedBadges(): Promise<number> {
  console.log("  → Rozetler (Badges) seed ediliyor…");

  const badges = [
    // 1. İlk Görev Tamamlandı
    { name: "İlk Görev Tamamlandı", description: "İlk kodlama görevini başarıyla bitirdin.", iconUrl: "🌟", type: "CHALLENGE" as const, requiredValue: 1 },
    // 2. Hızlı Çözücü
    { name: "Hızlı Çözücü", description: "Bir görevi başarıyla tamamladın.", iconUrl: "🚀", type: "SPECIAL" as const, requiredValue: 1 },
    // 3. Bronz Programcı
    { name: "Bronz Programcı", description: "Seviye 2'ye ulaştın! Yolculuk yeni başlıyor.", iconUrl: "🥉", type: "LEVEL" as const, requiredValue: 2 },
    // 4. 3 Gün Üst Üste Giriş
    { name: "3 Gün Üst Üste Giriş", description: "3 günlük streak serisi yakaladın.", iconUrl: "📅", type: "STREAK" as const, requiredValue: 3 },
    // 5. Meraklı Zihin
    { name: "Meraklı Zihin", description: "Sandbox (Deneme Alanı) modunda ilk kodunu çalıştırdın.", iconUrl: "💡", type: "SPECIAL" as const, requiredValue: 1 },
    // 6. Erken Kalkan Yol Alır
    { name: "Erken Kalkan Yol Alır", description: "Sabahın erken saatlerinde (05:00 - 08:00) bir görevi başarıyla tamamladın.", iconUrl: "🌅", type: "SPECIAL" as const, requiredValue: 1 },
    // 7. 5. Görev
    { name: "5. Görev", description: "5 görev tamamladın, hızlanıyorsun!", iconUrl: "🔥", type: "CHALLENGE" as const, requiredValue: 5 },
    // 8. Seviye Üç
    { name: "Seviye Üç", description: "Seviye 3'e ulaştın! Kendini geliştiriyorsun.", iconUrl: "✨", type: "LEVEL" as const, requiredValue: 3 },
    // 9. 7 Gün Streak
    { name: "7 Gün Streak", description: "7 gündür buradasın, harika!", iconUrl: "⚡", type: "STREAK" as const, requiredValue: 7 },
    // 10. Çok Yönlü
    { name: "Çok Yönlü", description: "İki farklı programlama dilinde görev tamamladın.", iconUrl: "🗣️", type: "SPECIAL" as const, requiredValue: 2 },
    // 11. Gümüş Kodlayıcı
    { name: "Gümüş Kodlayıcı", description: "Seviye 5'e ulaştın! Harika bir ilerleme.", iconUrl: "🥈", type: "LEVEL" as const, requiredValue: 5 },
    // 12. 10. Görev
    { name: "10. Görev", description: "10 görev tamamlandı, artık bir ustasın.", iconUrl: "🏆", type: "CHALLENGE" as const, requiredValue: 10 },
    // 13. Gece Kuşu
    { name: "Gece Kuşu", description: "Gece yarısından sonra (00:00 - 05:00) kod yazıp görevi tamamladın.", iconUrl: "🦉", type: "SPECIAL" as const, requiredValue: 1 },
    // 14. 15. Görev
    { name: "15. Görev", description: "15 görev başarıyla tamamlandı.", iconUrl: "🌟", type: "CHALLENGE" as const, requiredValue: 15 },
    // 15. Kod Ustası
    { name: "Kod Ustası", description: "Seviye 7'ye ulaştın! Kod yazmak senin için çocuk oyuncağı.", iconUrl: "💫", type: "LEVEL" as const, requiredValue: 7 },
    // 16. İki Hafta Kesintisiz
    { name: "İki Hafta Kesintisiz", description: "14 günlük streak serisi yakaladın.", iconUrl: "🗓️", type: "STREAK" as const, requiredValue: 14 },
    // 17. Kusursuz Kod
    { name: "Kusursuz Kod", description: "Bir görevden kusursuz puan (90+ AI Code Review skoru) aldın.", iconUrl: "✨", type: "SPECIAL" as const, requiredValue: 1 },
    // 18. 25. Görev
    { name: "25. Görev", description: "25 görev tamamlandı, durdurulamazsın!", iconUrl: "⚔️", type: "CHALLENGE" as const, requiredValue: 25 },
    // 19. 30 Gün Streak
    { name: "30 Gün Streak", description: "Tam 1 aydır aralıksız kod yazıyorsun.", iconUrl: "👑", type: "STREAK" as const, requiredValue: 30 },
    // 20. Dil Uzmanı
    { name: "Dil Uzmanı", description: "Üç farklı programlama dilinde görev tamamladın.", iconUrl: "🎯", type: "SPECIAL" as const, requiredValue: 3 },
    // 21. Efsanevi Yazılımcı
    { name: "Efsanevi Yazılımcı", description: "Tebrikler! Seviye 10'a ulaşarak zirveye çıktın.", iconUrl: "🥇", type: "LEVEL" as const, requiredValue: 10 },
    // 22. 50. Görev
    { name: "50. Görev", description: "50 görev tamamlandı, büyük başarı!", iconUrl: "🛡️", type: "CHALLENGE" as const, requiredValue: 50 },
    // 23. Hata Avcısı
    { name: "Hata Avcısı", description: "5 farklı görevi tek seferde kusursuz (90+ AI Code Review skoru) tamamladın.", iconUrl: "🐛", type: "SPECIAL" as const, requiredValue: 5 },
    // 24. Yenilmez
    { name: "Yenilmez", description: "50 günlük streak serisi yakaladın!", iconUrl: "🛡️", type: "STREAK" as const, requiredValue: 50 }
  ];

  let createdCount = 0;
  for (const badge of badges) {
    await db.badge.upsert({
      where: { name: badge.name },
      create: badge,
      update: {
        description: badge.description,
        iconUrl: badge.iconUrl,
        type: badge.type,
        requiredValue: badge.requiredValue
      }
    });
    createdCount++;
  }

  return createdCount;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log("\n🌱 CodeQuest seed başlıyor…\n");

  const badgeCount = await seedBadges();
  console.log(`\n  ✓ ${badgeCount} rozet seed edildi.\n`);

  // Sadece eksik konuları üret — mevcut STATIC sorulara dokunma
  const existingTopics = await db.challenge.findMany({
    where: { isSandbox: false, source: "STATIC" },
    select: { topic: true, language: true, difficulty: true },
  });
  const existingSet = new Set(
    existingTopics.map(c => `${c.topic}|${c.language}|${c.difficulty}`)
  );
  console.log(`  ℹ️  Mevcut ${existingTopics.length} STATIC soru korunacak.\n`);

  const sandboxCount = await seedSandboxPlaceholders();
  console.log(`\n  ✓ ${sandboxCount} sandbox placeholder oluşturuldu.\n`);

  const staticCount = await seedStaticChallenges(existingSet);
  const expected = TOPICS.length * LANGUAGES.length * 3;

  console.log("\n────────────────────────────────────");
  console.log("🎉 Seed tamamlandı!");
  console.log(`   Rozet               : ${badgeCount}`);
  console.log(`   Sandbox placeholder : ${sandboxCount}`);
  console.log(`   Statik challenge    : ${staticCount} / ${expected}`);
  console.log(`   Toplam              : ${badgeCount + sandboxCount + staticCount}`);
  console.log("────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Seed başarısız:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });