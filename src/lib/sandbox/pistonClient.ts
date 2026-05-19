// /src/lib/sandbox/pistonClient.ts
// CodeQuest — Local Code Execution

import type { Language } from "@prisma/client";
import cp from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface RunCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  stderr: string;
}

export interface RunTestsResult {
  results: TestCaseResult[];
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
}

/**
 * Türkçe karakterleri ASCII karşılıklarına dönüştürür.
 */
function turkishToAscii(s: string): string {
  return s
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ı/g, "i").replace(/İ/g, "i");
}

/**
 * Çıktıyı normalize eder:
 * - Satır sonlarını \n'e çevirir
 * - Baştaki/sondaki boşlukları siler
 * - Her satırın sağ boşluklarını siler
 * - Büyük/küçük harf farkını görmezden gelir
 * - Türkçe karakterleri ASCII'ye dönüştürür (ş→s, ç→c, vb.)
 */
function normalize(s: string): string {
  return turkishToAscii(
    s
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(line => line.trimEnd())
      .join("\n")
      .trim()
      .toLocaleLowerCase("tr-TR")
  );
}

/**
 * İki çıktının mantıksal olarak eşit olup olmadığını kontrol eder.
 * Normalize karşılaştırmasının yanı sıra sayısal tolerans da uygular.
 */
function outputsMatch(expected: string, actual: string): boolean {
  const normExp = normalize(expected);
  const normAct = normalize(actual);

  // Tam eşleşme (normalize sonrası)
  if (normExp === normAct) return true;

  // Sayısal karşılaştırma: tek sayı içeren çıktılar için ondalık tolerans
  const expNum = parseFloat(normExp);
  const actNum = parseFloat(normAct);
  if (
    !isNaN(expNum) &&
    !isNaN(actNum) &&
    normExp.split("\n").length === 1 &&
    normAct.split("\n").length === 1
  ) {
    // %0.001 veya 1e-9 tolerans — float hesaplamalar için
    if (Math.abs(expNum - actNum) < 1e-9) return true;
    if (expNum !== 0 && Math.abs((expNum - actNum) / expNum) < 0.001) return true;
  }

  return false;
}

const TEMP_DIR = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), '.temp_exec_api');
// Vercel serverless ortamında top-level fs işlemleri crash'e sebep olabilir.
// Klasör oluşturmayı execute fonksiyonunun içine taşıyoruz.

async function execute(
  code: string,
  language: Language,
  stdin?: string
): Promise<RunCodeResult> {
  // Eğer NEXT_PUBLIC_SOCKET_URL ayarlanmışsa (canlı ortamda Render motorunun adresi)
  // veya Vercel serverless ortamındaysak, uzak Docker sunucumuza istek atarak çalıştırırız.
  // Bu sayede Vercel üzerinde python/javac/node vb. binary bağımlılığı olmadan testler başarıyla çalışır.
  let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socketUrl) {
    // Sondaki eğik çizgileri (/) temizle ki URL formatı bozulmasın
    socketUrl = socketUrl.replace(/\/+$/, "");
    try {
      console.log(`[pistonClient] Remote execution: fetching from ${socketUrl}/execute`);
      const res = await fetch(`${socketUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, stdin }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          stdout: data.stdout || "",
          stderr: data.stderr || "",
          exitCode: data.exitCode ?? 0,
          timedOut: !!data.timedOut
        };
      }
      console.warn(`Render engine returned status ${res.status}, falling back to local execution`);
    } catch (err) {
      console.error("Render engine fetch failed, falling back to local:", err);
    }
  }

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(TEMP_DIR)) {
      try {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      } catch (e) {
        // Ignore if read-only filesystem on Vercel, it might be /tmp and already exists
      }
    }

    const sessionId = crypto.randomBytes(8).toString('hex');
    let ext = 'txt';
    let cmd = '';
    let args: string[] = [];

    const lang = language.toLowerCase();

    if (lang === 'python' || lang === 'py') {
      ext = 'py';
      cmd = 'python';
      args = ['-u'];
    } else if (lang === 'javascript' || lang === 'js') {
      ext = 'js';
      cmd = 'node';
      args = [];
      code = code.replace(/['\"`]\/dev\/stdin['\"`]/g, '0');
    } else if (lang === 'sql') {
      ext = 'py';
      cmd = 'python';
      args = ['-u'];

      const base64Code = Buffer.from(code).toString('base64');
      const base64Input = Buffer.from(stdin || '').toString('base64');

      code = `
import sqlite3
import base64

sql_code = base64.b64decode('${base64Code}').decode('utf-8')
test_input = base64.b64decode('${base64Input}').decode('utf-8')

try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Test case input: şema ve seed verisini çalıştır
    for stmt in test_input.split(';'):
        stmt = stmt.strip()
        if stmt:
            cursor.execute(stmt)

    # Kullanıcının SQL kodunu çalıştır ve sonuçları bas
    for stmt in sql_code.split(';'):
        stmt = stmt.strip()
        if stmt:
            cursor.execute(stmt)
            if cursor.description:
                rows = cursor.fetchall()
                for row in rows:
                    print("\\t".join(str(val) for val in row))
            elif stmt.upper().startswith("INSERT") or stmt.upper().startswith("UPDATE") or stmt.upper().startswith("DELETE"):
                print(f"{cursor.rowcount} row(s) affected")
                
    conn.commit()
except Exception as e:
    print(f"Hata: {e}")
finally:
    if 'conn' in locals():
        conn.close()
`;
    } else if (lang === 'java') {
      ext = 'java';
      cmd = 'java';
      args = [];
    } else {
      return resolve({ stdout: "", stderr: `Desteklenmeyen dil: ${language}`, exitCode: 1, timedOut: false });
    }

    let filepath = path.join(TEMP_DIR, `script_${sessionId}.${ext}`);

    if (ext === 'java') {
      const javaDir = path.join(TEMP_DIR, sessionId);
      if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });
      filepath = path.join(javaDir, 'Main.java');
    }

    fs.writeFileSync(filepath, code);
    args.push(filepath);

    let stdout = "";
    let stderr = "";
    let isTimedOut = false;

    const spawnFn = cp.spawn;
    const childArgs = Array.from(args);
    const child = spawnFn(cmd, childArgs, { cwd: TEMP_DIR });

    if (stdin && lang !== 'sql') {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    const timeout = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL');
    }, 5000);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      try {
        if (ext === 'java') {
          fs.rmSync(path.dirname(filepath), { recursive: true, force: true });
        } else {
          fs.unlinkSync(filepath);
        }
      } catch (e) { }

      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
        timedOut: isTimedOut
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      try {
        if (ext === 'java') {
          fs.rmSync(path.dirname(filepath), { recursive: true, force: true });
        } else {
          fs.unlinkSync(filepath);
        }
      } catch (e) { }
      resolve({ stdout: "", stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}

export async function runCode(
  code: string,
  language: Language,
  stdin?: string
): Promise<RunCodeResult> {
  return execute(code, language, stdin);
}

export async function runTests(
  code: string,
  language: Language,
  testCases: { input: string; expectedOutput: string }[]
): Promise<RunTestsResult> {
  if (testCases.length === 0) {
    throw new Error("En az 1 test case gerekli.");
  }

  // Vercel'in 10 saniyelik sunucusuz fonksiyon zaman aşımına uğramamak için tüm testleri paralel çalıştırıyoruz.
  const promises = testCases.map(async (tc) => {
    let actualOutput = "";
    let stderr = "";

    try {
      const result = await execute(code, language, tc.input);
      actualOutput = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      stderr = (err as Error).message;
    }

    const passed = outputsMatch(tc.expectedOutput, actualOutput);

    return {
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: actualOutput.trim(),
      passed,
      stderr,
    };
  });

  const results = await Promise.all(promises);
  const passedCount = results.filter((r) => r.passed).length;

  return {
    results,
    passedCount,
    totalCount: results.length,
    allPassed: passedCount === results.length,
  };
}