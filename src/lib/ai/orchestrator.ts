// /src/lib/ai/orchestrator.ts
// CodeQuest — AI Orchestrator
// Groq · JSON mode · 3-aşamalı soru üretimi

import Groq from "groq-sdk";
import type {
  Language,
  UserGoal,
  ExperienceLevel,
  LearningPath,
} from "@prisma/client";
import { runCode } from "@/lib/sandbox/pistonClient";

// ─────────────────────────────────────────────
// TİPLER
// ─────────────────────────────────────────────

export interface OnboardingAnswers {
  language: Language;
  goal: UserGoal;
  experience: ExperienceLevel;
}

export interface LearningPathPayload {
  userId: string;
  language: Language;
  goal: UserGoal;
  experience: ExperienceLevel;
  topicsOrder: string[];
  currentDifficulty: number;
}

export interface ChallengeSchema {
  title: string;
  description: string;
  starterCode: string;
  language: Language;
  difficulty: number;
  testCases: { input: string; expectedOutput: string }[];
  hints: string[];
  xpReward: number;
  topic: string;
}

// ─────────────────────────────────────────────
// GROQ CLIENT
// ─────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key_for_build" });
const MODEL = "llama-3.3-70b-versatile";

// ─────────────────────────────────────────────
// YARDIMCI — Seviyeye göre izin verilen yapılar
// ─────────────────────────────────────────────

function getDifficultyConstraints(difficulty: number, language: Language): string {
  const lang = language.toLowerCase();

  if (difficulty <= 2) return `
ZORLUK SEVİYESİ KISITLARI (Seviye ${difficulty}/10 — Mutlak Başlangıç):
- Kullanılabilecek yapılar: değişken atama, print/console.log, string birleştirme, basit aritmetik.
- KESINLIKLE YASAK: döngüler, koşullar (if/else), fonksiyon tanımlama, listeler/diziler.
- Görev tek satır veya iki satır kod gerektirmeli.
- Örnek görev: "Adını ve soyadını birleştirip ekrana yazdır."
`.trim();

  if (difficulty <= 4) return `
ZORLUK SEVİYESİ KISITLARI (Seviye ${difficulty}/10 — Başlangıç):
- Kullanılabilecek yapılar: değişkenler, if/else, basit for/while döngüsü, print.
- KESINLIKLE YASAK: iç içe döngüler, fonksiyon tanımlama, ${lang === "python" ? "list comprehension, lambda" : "arrow function, array methods"}.
- Görev 3-8 satır kod gerektirmeli.
- Örnek görev: "1'den N'e kadar sayıları yazdır."
`.trim();

  if (difficulty <= 6) return `
ZORLUK SEVİYESİ KISITLARI (Seviye ${difficulty}/10 — Orta):
- Kullanılabilecek yapılar: fonksiyon tanımlama, listeler/diziler, döngüler, koşullar.
- KESINLIKLE YASAK: recursion (özyineleme), class/OOP, ${lang === "python" ? "lambda, generator" : "prototype, class"}.
- Görev 8-20 satır kod gerektirmeli.
- Örnek görev: "Bir listedeki çift sayıları filtrele ve toplamını döndür."
`.trim();

  if (difficulty <= 8) return `
ZORLUK SEVİYESİ KISITLARI (Seviye ${difficulty}/10 — İleri):
- Kullanılabilecek yapılar: recursion, class/OOP, exception handling, tüm veri yapıları.
- KESINLIKLE YASAK: harici kütüphaneler (import sadece standart kütüphane).
- Görev 15-35 satır kod gerektirmeli.
- Örnek görev: "Binary search algoritmasını recursive olarak yaz."
`.trim();

  return `
ZORLUK SEVİYESİ KISITLARI (Seviye ${difficulty}/10 — Uzman):
- Her yapı serbesttir. Algoritma verimliliği ve Big-O optimizasyonu beklenir.
- Görev karmaşık veri yapısı veya optimizasyon problemi olmalı.
- Örnek görev: "Verilen bir graph'ta en kısa yolu bul (Dijkstra)."
`.trim();
}

// ─────────────────────────────────────────────
// FONKSİYON 1 — runOnboarding
// ─────────────────────────────────────────────

export async function runOnboarding(
  answers: OnboardingAnswers,
  userId: string
): Promise<LearningPathPayload> {
  const experienceLabel: Record<ExperienceLevel, string> = {
    NONE: "hiç kod yazmamış",
    SOME: "biraz kod yazmış",
    YES: "daha önce kod yazmış",
  };

  const goalLabel: Record<UserGoal, string> = {
    EXAM_PREP: "sınav hazırlığı",
    JOB_HUNTING: "iş bulmak",
    CURIOSITY: "merak/kişisel gelişim",
  };

  const prompt = `
Sen CodeQuest adlı bir kodlama öğrenme platformunun pedagoji motorusun.
Aşağıdaki kullanıcı profiline göre kişiselleştirilmiş bir öğrenme yolu oluştur.

Kullanıcı Profili:
- Öğrenmek istediği dil: ${answers.language}
- Amacı: ${goalLabel[answers.goal]}
- Deneyim seviyesi: ${experienceLabel[answers.experience]}

Görevin:
1. Bu kullanıcı için ${answers.language} dilinde pedagojik açıdan doğru sıralanmış
   8-15 konu içeren bir liste (topicsOrder) oluştur.
   Konular genel etiketler olmalı (örn: "variables", "loops", "functions", "arrays").
   ${answers.goal === "JOB_HUNTING" ? "İş odaklı: algoritmik düşünme ve pratik projelere ağırlık ver." : ""}
   ${answers.goal === "EXAM_PREP" ? "Sınav odaklı: temel kavramlar ve sık sorulan konulara ağırlık ver." : ""}

2. Kullanıcının deneyim seviyesine göre başlangıç zorluk puanı (currentDifficulty) belirle (1-10):
   - NONE → 1 veya 2
   - SOME → 3 veya 4
   - YES  → 5 veya 6

SADECE JSON döndür:
{"topicsOrder": ["...", "..."], "currentDifficulty": 2}
`.trim();

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: { topicsOrder: string[]; currentDifficulty: number };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[runOnboarding] Groq geçersiz JSON döndürdü: ${raw}`);
  }

  const clampedDifficulty = Math.min(10, Math.max(1, Math.round(parsed.currentDifficulty)));

  return {
    userId,
    language: answers.language,
    goal: answers.goal,
    experience: answers.experience,
    topicsOrder: parsed.topicsOrder,
    currentDifficulty: clampedDifficulty,
  };
}

// ─────────────────────────────────────────────
// FONKSİYON 2 — generateChallenge (3 aşamalı)
// ─────────────────────────────────────────────

export async function generateChallenge(
  learningPath: Pick<
    LearningPath,
    | "language"
    | "currentDifficulty"
    | "topicsOrder"
    | "currentTopicIndex"
    | "goal"
    | "experience"
  >
): Promise<ChallengeSchema> {
  const currentTopic =
    learningPath.topicsOrder[learningPath.currentTopicIndex] ??
    learningPath.topicsOrder[learningPath.topicsOrder.length - 1];

  const constraints = getDifficultyConstraints(
    learningPath.currentDifficulty,
    learningPath.language
  );

  // ── AŞAMA 1: Soru metni + test case input'ları üret (yaratıcı) ──────────

  const step1Prompt = `
Sen CodeQuest platformunun görev üreticisisin.
Aşağıdaki parametrelere göre tek bir kodlama görevi üret.

Parametreler:
- Programlama dili: ${learningPath.language}
- Konu: ${currentTopic}
- Kullanıcı hedefi: ${learningPath.goal}
- Deneyim: ${learningPath.experience}

${constraints}

Kurallar:
1. description ve hints Türkçe olmalı.
2. starterCode: Kullanıcının yazmaya başlayacağı iskelet kod. Fonksiyon imzası veya
   yorum satırları olabilir ama çözümü içermemeli.
3. testCases: En az 3 test case. Her birinde sadece "input" alanı olsun —
   expectedOutput şu an boş string olsun, sonraki adımda doldurulacak.
   input: programa stdin'den verilecek değer (yoksa boş string "").
4. hints: Cevabı vermesin, yönlendirsin. 2-3 ipucu.
5. topic kısa İngilizce etiket olmalı (örn: "loops").

SADECE JSON döndür (expectedOutput alanları şimdilik "" olacak):
{
  "title": "...",
  "description": "...",
  "starterCode": "...",
  "testCases": [{"input": "...", "expectedOutput": ""}, ...],
  "hints": ["...", "..."],
  "topic": "..."
}
`.trim();

  const step1Response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: step1Prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  let step1: Omit<ChallengeSchema, "language" | "xpReward" | "difficulty">;
  try {
    step1 = JSON.parse(step1Response.choices[0]?.message?.content ?? "");
  } catch {
    throw new Error("[generateChallenge] Adım 1 JSON parse hatası");
  }

  // ── AŞAMA 2: Referans çözüm üret (deterministik) ────────────────────────

  const step2Prompt = `
Sen bir ${learningPath.language} uzmanısın.
Aşağıdaki kodlama görevini çözen REFERANS ÇÖZÜMÜ yaz.

Görev Başlığı: ${step1.title}
Görev Açıklaması: ${step1.description}
İskelet Kod:
${step1.starterCode}

Test Girdileri (stdin):
${step1.testCases.map((tc, i) => `  ${i + 1}. input: "${tc.input}"`).join("\n")}

Kurallar:
1. Çözüm tam ve çalışır olmalı.
2. stdin'den input okuyorsa (${learningPath.language === "PYTHON" ? "input()" : learningPath.language === "JAVASCRIPT" ? "readline/process.stdin" : "Scanner/BufferedReader"}) kullan.
3. Sadece "solutionCode" alanıyla JSON döndür.

SADECE JSON döndür:
{"solutionCode": "..."}
`.trim();

  const step2Response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: step2Prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  let solutionCode: string;
  try {
    const parsed = JSON.parse(step2Response.choices[0]?.message?.content ?? "");
    solutionCode = parsed.solutionCode;
  } catch {
    throw new Error("[generateChallenge] Adım 2 JSON parse hatası");
  }

  // ── AŞAMA 3: Referans çözümü çalıştır → expectedOutput'ları doldur ──────

  const filledTestCases: { input: string; expectedOutput: string }[] = [];

  for (const tc of step1.testCases) {
    try {
      const result = await runCode(solutionCode, learningPath.language, tc.input);

      // Çalışma hatası varsa fallback: Groq'a expectedOutput'u sor
      if (result.exitCode !== 0 || result.timedOut) {
        const fallback = await getExpectedOutputFallback(
          solutionCode,
          learningPath.language,
          tc.input,
          step1.description
        );
        filledTestCases.push({ input: tc.input, expectedOutput: fallback });
      } else {
        filledTestCases.push({
          input: tc.input,
          expectedOutput: result.stdout.trim(),
        });
      }
    } catch {
      // runCode tamamen başarısız olursa fallback
      const fallback = await getExpectedOutputFallback(
        solutionCode,
        learningPath.language,
        tc.input,
        step1.description
      );
      filledTestCases.push({ input: tc.input, expectedOutput: fallback });
    }
  }

  const difficulty = learningPath.currentDifficulty;

  return {
    ...step1,
    testCases: filledTestCases,
    language: learningPath.language,
    difficulty,
    xpReward: difficulty * 10,
  };
}

// ─────────────────────────────────────────────
// YARDIMCI — Fallback expectedOutput (Groq)
// Çalıştırma başarısız olursa Groq'a sorar
// ─────────────────────────────────────────────

async function getExpectedOutputFallback(
  solutionCode: string,
  language: Language,
  input: string,
  description: string
): Promise<string> {
  const prompt = `
Aşağıdaki ${language} kodunu ve verilen input'u göz önünde bulundur.
Bu kod çalıştırıldığında stdout'a ne yazar?

Kod:
${solutionCode}

Input (stdin): "${input}"

Sadece programın stdout çıktısını yaz. Açıklama, tırnak işareti, başlık OLMAYACAK.
Sadece çıktı.

SADECE JSON döndür:
{"output": "..."}
`.trim();

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "");
    return (parsed.output as string ?? "").trim();
  } catch {
    return "";
  }
}