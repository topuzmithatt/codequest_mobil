const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const TEMP_DIR = path.join(__dirname, '.temp_exec');
if (fs.existsSync(TEMP_DIR)) {
  fs.readdirSync(TEMP_DIR).forEach(file => {
    try { fs.unlinkSync(path.join(TEMP_DIR, file)); } catch (e) { }
  });
} else {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Statik / Test çalıştırma istekleri için helper fonksiyon
function executeCode(code, language, stdin) {
  return new Promise((resolve) => {
    const sessionId = crypto.randomBytes(8).toString('hex');
    let ext = 'txt';
    let cmd = '';
    let args = [];
    let javaDir = null;
    let filepath = null;

    const lang = language.toLowerCase();

    if (lang === 'python' || lang === 'py') {
      ext = 'py';
      cmd = 'python';
      args = ['-u'];
      filepath = path.join(TEMP_DIR, `script_${sessionId}.${ext}`);
      fs.writeFileSync(filepath, code);
      args.push(filepath);

    } else if (lang === 'javascript' || lang === 'js') {
      ext = 'js';
      cmd = 'node';
      args = [];
      filepath = path.join(TEMP_DIR, `script_${sessionId}.${ext}`);
      fs.writeFileSync(filepath, code);
      args.push(filepath);

    } else if (lang === 'java') {
      javaDir = path.join(TEMP_DIR, `java_${sessionId}`);
      fs.mkdirSync(javaDir, { recursive: true });
      filepath = path.join(javaDir, 'Main.java');
      fs.writeFileSync(filepath, code);

      try {
        execSync(`javac "${filepath}"`, { timeout: 15000, encoding: 'utf8' });
      } catch (compileErr) {
        const errMsg = compileErr.stderr || compileErr.stdout || compileErr.message || 'Derleme hatası';
        try { fs.rmSync(javaDir, { recursive: true, force: true }); } catch (e) { }
        return resolve({
          stdout: "",
          stderr: `Derleme Hatası:\n${errMsg}`,
          exitCode: 1,
          timedOut: false
        });
      }

      cmd = 'java';
      args = ['-cp', javaDir, 'Main'];

    } else if (lang === 'sql') {
      ext = 'py';
      cmd = 'python';
      args = ['-u'];
      const b64Code = Buffer.from(code).toString('base64');
      const b64Input = Buffer.from(stdin || '').toString('base64');
      const runner = `# -*- coding: utf-8 -*-
import sys, sqlite3, base64
sys.stdout.reconfigure(encoding='utf-8')
sql_code = base64.b64decode('${b64Code}').decode('utf-8')
test_input = base64.b64decode('${b64Input}').decode('utf-8')
try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    for stmt in test_input.split(';'):
        stmt = stmt.strip()
        if stmt:
            cursor.execute(stmt)
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
      filepath = path.join(TEMP_DIR, `script_${sessionId}.py`);
      fs.writeFileSync(filepath, runner);
      args.push(filepath);

    } else {
      return resolve({ stdout: "", stderr: `Desteklenmeyen dil: ${language}`, exitCode: 1, timedOut: false });
    }

    let stdout = "";
    let stderr = "";
    let isTimedOut = false;
    let currentProcess = null;

    try {
      currentProcess = spawn(cmd, args, {
        cwd: TEMP_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      const processTimeout = setTimeout(() => {
        if (currentProcess) {
          currentProcess.kill('SIGKILL');
          isTimedOut = true;
          currentProcess = null;
        }
      }, 10000);

      if (stdin && lang !== 'sql') {
        currentProcess.stdin.write(stdin);
        currentProcess.stdin.end();
      }

      currentProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      currentProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      currentProcess.on('close', (exitCode) => {
        clearTimeout(processTimeout);
        try {
          if (javaDir) fs.rmSync(javaDir, { recursive: true, force: true });
          else if (filepath) fs.unlinkSync(filepath);
        } catch (e) { }

        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 0,
          timedOut: isTimedOut
        });
      });

      currentProcess.on('error', (err) => {
        clearTimeout(processTimeout);
        try {
          if (javaDir) fs.rmSync(javaDir, { recursive: true, force: true });
          else if (filepath) fs.unlinkSync(filepath);
        } catch (e) { }
        resolve({ stdout: "", stderr: err.message, exitCode: 1, timedOut: false });
      });

    } catch (e) {
      try {
        if (javaDir) fs.rmSync(javaDir, { recursive: true, force: true });
        else if (filepath) fs.unlinkSync(filepath);
      } catch (err) { }
      resolve({ stdout: "", stderr: e.message, exitCode: 1, timedOut: false });
    }
  });
}

// HTTP POST /execute — Testleri veya normal çalıştırma isteklerini sunucusuz (serverless) ortamlardan alıp çalıştırır
app.post('/execute', async (req, res) => {
  const { code, language, stdin } = req.body;
  if (!code || !language) {
    return res.status(400).json({ error: 'code ve language alanları zorunlu.' });
  }

  try {
    const result = await executeCode(code, language, stdin);
    res.json(result);
  } catch (err) {
    console.error('HTTP /execute Error:', err);
    res.status(500).json({ error: err.message || 'Kod çalıştırılırken sunucu hatası oluştu.' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  let currentProcess = null;
  let processTimeout = null;

  socket.on('runCode', ({ code, language }) => {
    if (currentProcess) {
      currentProcess.kill();
      clearTimeout(processTimeout);
      currentProcess = null;
    }

    const sessionId = crypto.randomBytes(8).toString('hex');
    let ext = 'txt';
    let cmd = '';
    let args = [];
    let javaDir = null;
    let filepath = null;

    const lang = language.toLowerCase();

    if (lang === 'python' || lang === 'py') {
      ext = 'py';
      cmd = 'python';
      args = ['-u'];
      filepath = path.join(TEMP_DIR, `script_${sessionId}.${ext}`);
      fs.writeFileSync(filepath, code);
      args.push(filepath);

    } else if (lang === 'javascript' || lang === 'js') {
      ext = 'js';
      cmd = 'node';
      args = [];
      filepath = path.join(TEMP_DIR, `script_${sessionId}.${ext}`);
      fs.writeFileSync(filepath, code);
      args.push(filepath);

    } else if (lang === 'java') {
      // Java: önce javac ile derle, başarılıysa java ile çalıştır
      javaDir = path.join(TEMP_DIR, `java_${sessionId}`);
      fs.mkdirSync(javaDir, { recursive: true });
      filepath = path.join(javaDir, 'Main.java');
      fs.writeFileSync(filepath, code);

      // Derleme
      try {
        execSync(`javac "${filepath}"`, { timeout: 15000, encoding: 'utf8' });
      } catch (compileErr) {
        const errMsg = compileErr.stderr || compileErr.stdout || compileErr.message || 'Derleme hatası';
        socket.emit('output', `\r\nDerleme Hatası:\r\n${errMsg.replace(/\n/g, '\r\n')}\r\n`);
        socket.emit('finished', 1);
        try { fs.rmSync(javaDir, { recursive: true, force: true }); } catch (e) { }
        return;
      }

      cmd = 'java';
      args = ['-cp', javaDir, 'Main'];

    } else if (lang === 'sql') {
      // SQL: Python sqlite3 runner üzerinden
      ext = 'py';
      cmd = 'python';
      args = ['-u'];
      const b64Code = Buffer.from(code).toString('base64');
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
      filepath = path.join(TEMP_DIR, `script_${sessionId}.py`);
      fs.writeFileSync(filepath, runner);
      args.push(filepath);

    } else {
      socket.emit('output', `Hata: ${language} dili desteklenmiyor.\r\n`);
      socket.emit('finished', 1);
      return;
    }

    try {
      currentProcess = spawn(cmd, args, {
        cwd: TEMP_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      socket.emit('runStart');

      processTimeout = setTimeout(() => {
        if (currentProcess) {
          currentProcess.kill('SIGKILL');
          socket.emit('output', `\r\n\x1b[38;5;196m[HATA] Zaman Aşımı: Kodunuz çok uzun süre çalıştı.\x1b[0m\r\n`);
          currentProcess = null;
        }
      }, 10000);

      currentProcess.stdout.on('data', (data) => {
        const str = data.toString();
        socket.emit('output', str.replace(/\r?\n/g, '\r\n'));
      });

      currentProcess.stderr.on('data', (data) => {
        const str = data.toString();
        socket.emit('output', str.replace(/\r?\n/g, '\r\n'));
      });

      currentProcess.on('close', (code) => {
        clearTimeout(processTimeout);
        socket.emit('finished', code);
        currentProcess = null;
        // Dosyaları temizle
        try {
          if (javaDir) fs.rmSync(javaDir, { recursive: true, force: true });
          else if (filepath) fs.unlinkSync(filepath);
        } catch (e) { }
      });

      currentProcess.on('error', (err) => {
        socket.emit('output', `\r\nSüreç başlatılamadı: ${err.message}\r\n`);
        socket.emit('finished', 1);
      });

    } catch (e) {
      socket.emit('output', `\r\nHata: ${e.message}\r\n`);
      socket.emit('finished', 1);
    }
  });

  socket.on('input', (data) => {
    if (currentProcess && currentProcess.stdin) {
      currentProcess.stdin.write(data);
    }
  });

  socket.on('kill', () => {
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
      socket.emit('output', '\r\n[Kullanıcı tarafından sonlandırıldı]\r\n');
      socket.emit('finished', 137);
    }
  });

  socket.on('disconnect', () => {
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CodeQuest Execution Server running on port ${PORT}`);
});