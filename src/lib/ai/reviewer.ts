// /src/lib/ai/reviewer.ts
// CodeQuest — AI Code Reviewer
// Groq · JSON mode

import Groq from "groq-sdk";
import type { Language } from "@prisma/client";

// ─────────────────────────────────────────────
// TİPLER
// ─────────────────────────────────────────────

export interface ReviewInput {
  code:                 string;
  language:             Language;
  challengeDescription: string;
  difficulty:           number;
}

export interface ReviewResultPayload {
  correctness:         number;
  readability:         number;
  timeComplexity:      number;
  spaceComplexity:     number;
  idiomaticStyle:      number;
  overallScore:        number;
  feedbackPositive:    string;
  feedbackImprovement: string;
  complexityNote:      string;
}

// ─────────────────────────────────────────────
// GROQ CLIENT
// ─────────────────────────────────────────────

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key_for_build" });
const MODEL = "llama-3.3-70b-versatile";

// ─────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────

const LANGUAGE_LABEL: Record<Language, string> = {
  PYTHON:     "Python",
  JAVASCRIPT: "JavaScript",
  JAVA:       "Java",
  CSHARP:     "C#",
  HTML_CSS:   "HTML/CSS",
  GO:         "Go",
  RUST:       "Rust",
  R:          "R",
  SWIFT:      "Swift",
  KOTLIN:     "Kotlin",
  SQL:        "SQL",
};

// ─────────────────────────────────────────────
// FONKSİYON — reviewCode
// ─────────────────────────────────────────────

export async function reviewCode(input: ReviewInput): Promise<ReviewResultPayload> {
  const langLabel = LANGUAGE_LABEL[input.language];

  const difficultyContext =
    input.difficulty <= 3
      ? "Bu kullanıcı yeni başlayan. idiomaticStyle değerlendirmesinde temel doğruluğa odaklan."
      : input.difficulty <= 6
      ? "Bu kullanıcı orta seviye. Dile özgü temel pratikleri uygulayıp uygulamadığını değerlendir."
      : "Bu kullanıcı ileri seviye. Dile özgü en iyi pratiklerin tam uygulanmasını bekle.";

  const prompt = `
Sen CodeQuest platformunun kod değerlendirme motorusun.
Aşağıdaki kodu verilen göreve göre 5 eksende değerlendir.

Görev Açıklaması:
${input.challengeDescription}

Kullanıcının Kodu (${langLabel}):
\`\`\`${langLabel.toLowerCase()}
${input.code}
\`\`\`

Zorluk Seviyesi: ${input.difficulty}/10
${difficultyContext}

Değerlendirme Kuralları:
1. Her eksen 0-100 arası tam sayı.
2. overallScore = 5 eksenin ortalaması.
3. feedbackPositive: Türkçe, 1 cümle, somut iyi şey.
4. feedbackImprovement: Türkçe, 1-2 cümle, en kritik öneri.
5. complexityNote: Türkçe, Big-O ile açıkla.

SADECE JSON döndür:
{"correctness":0,"readability":0,"timeComplexity":0,"spaceComplexity":0,"idiomaticStyle":0,"overallScore":0,"feedbackPositive":"...","feedbackImprovement":"...","complexityNote":"..."}
`.trim();

  const response = await groq.chat.completions.create({
    model:           MODEL,
    messages:        [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature:     0.3,
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: ReviewResultPayload;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[reviewCode] Groq geçersiz JSON döndürdü: ${raw}`);
  }

  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

  const scores = {
    correctness:     clamp(parsed.correctness),
    readability:     clamp(parsed.readability),
    timeComplexity:  clamp(parsed.timeComplexity),
    spaceComplexity: clamp(parsed.spaceComplexity),
    idiomaticStyle:  clamp(parsed.idiomaticStyle),
  };

  const overallScore = clamp(
    Math.round(
      (scores.correctness +
        scores.readability +
        scores.timeComplexity +
        scores.spaceComplexity +
        scores.idiomaticStyle) / 5
    )
  );

  return {
    ...scores,
    overallScore,
    feedbackPositive:    parsed.feedbackPositive,
    feedbackImprovement: parsed.feedbackImprovement,
    complexityNote:      parsed.complexityNote,
  };
}