/**
 * Генератор громких звуковых сигналов для покерного турнира.
 *
 * Пишет 16-битные mono WAV (44.1 кГц) в папку sounds/ — файлы загружаются
 * через админку («Звуковые сигналы» → загрузить для нужного события).
 * Все сигналы нормализуются к пику −0.2 dBFS — это максимум громкости
 * без клиппинга; дальнейшее усиление делает экран зала (кнопка 🔊 ×N).
 *
 * Запуск: node tools/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "sounds");
mkdirSync(outDir, { recursive: true });

/** Рендерит функцию времени в массив сэмплов. */
function render(durSec, fn) {
  const n = Math.floor(SR * durSec);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR);
  return out;
}

/** Нормализация к указанному пику (по умолчанию −0.2 dBFS). */
function normalize(buf, peak = 0.977) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/** Короткие фейды по краям против щелчков. */
function fade(buf, ms = 4) {
  const n = Math.floor((SR * ms) / 1000);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
  return buf;
}

/** Удар колокола: ингармоничные партиалы, верхние гаснут быстрее. */
function bell(t, freq, t0, decay, partials = [[1, 1], [2.0, 0.55], [2.76, 0.3], [4.07, 0.14]]) {
  const dt = t - t0;
  if (dt < 0) return 0;
  const attack = Math.min(1, dt / 0.0015);
  let s = 0;
  for (const [r, a] of partials) {
    s += a * Math.sin(2 * Math.PI * freq * r * dt) * Math.exp(-dt / (decay / (0.7 + 0.5 * r)));
  }
  return s * attack;
}

/** Пила с лёгким сглаживанием — основа «электронного» сигнала. */
function saw(t, freq, t0, dur) {
  const dt = t - t0;
  if (dt < 0 || dt > dur) return 0;
  const f = freq * (1 - 0.05 * (dt / dur)); // лёгкое падение тона — срочность
  const phase = (f * dt) % 1;
  return 2 * phase - 1;
}

/** 16-битный PCM mono WAV. */
function toWav(f64) {
  const n = f64.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, f64[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

const E6 = 1318.51;
const C6 = 1046.5;
const G6 = 1568.0;
const C7 = 2093.0;

const sounds = {
  // 1. Классика казино: три удара сервисного звонка «динь-динь-динь».
  "level-casino-bell.wav": render(1.5, (t) =>
    bell(t, E6, 0.0, 0.4) + bell(t, E6, 0.3, 0.4) + bell(t, E6, 0.6, 0.6),
  ),
  // 2. Торжественный восходящий перезвон C6 → E6 → G6 → C7 (в стиле WSOP).
  "level-chime-fanfare.wav": render(2.2, (t) =>
    bell(t, C6, 0.0, 0.9) +
    bell(t, E6, 0.16, 0.9) +
    bell(t, G6, 0.32, 0.9) +
    bell(t, C7, 0.48, 1.2, [[1, 1], [2.0, 0.4], [2.76, 0.2]]),
  ),
  // 3. Низкий гонг — «грудной» звук, слышно даже в шумном зале.
  "level-deep-gong.wav": render(3.2, (t) =>
    bell(t, 130.81, 0.0, 2.4, [
      [1, 1],
      [1.48, 0.6],
      [2.0, 0.5],
      [2.94, 0.3],
      [4.2, 0.15],
    ]),
  ),
  // 4. Резкий современный двойной «бззт» — для энергичной смены уровня.
  "level-double-buzz.wav": render(0.7, (t) => {
    const env = (t0) => {
      const dt = t - t0;
      if (dt < 0 || dt > 0.14) return 0;
      return Math.exp(-dt / 0.05) * Math.min(1, dt / 0.002);
    };
    const harm = (t0) =>
      0.5 * saw(t, 523.25, t0, 0.14) + 0.3 * saw(t, 1046.5, t0, 0.14) + 0.2 * saw(t, 1568, t0, 0.14);
    return env(0) * harm(0) + env(0.22) * harm(0.22);
  }),
};

for (const [name, samples] of Object.entries(sounds)) {
  const buf = toWav(fade(normalize(samples)));
  writeFileSync(join(outDir, name), buf);
  console.log(`${name}: ${(buf.length / 1024).toFixed(0)} КБ`);
}
console.log(`Готово: ${outDir}`);
