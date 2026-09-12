// Run after the frontend build, with Playwright available through NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const build = path.resolve(__dirname, '../frontend/build');
const seconds = 12;
function tone(frequency) {
  const rate = 22050;
  const count = rate * seconds;
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i += 1) bytes.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * frequency * i / rate)), 44 + i * 2);
  return bytes;
}
const tracks = ['Copper Signal', 'Orbit Motion', 'Glass Rhythm', 'Electric Horizon', 'Silver Circuit'].map((title, i) => ({
  id: `T${i + 1}`, display_title: title, filename: `${title}.wav`, duration_seconds: seconds,
  rating: 'A', full_generation_prompt: 'upbeat dance quick tempo 120 BPM',
  analysis: { bpm: 120, beat_interval: 0.5, first_beat: 0, key: 'C', status: 'manual' },
}));
const tones = tracks.map((_, i) => tone(220 + i * 110));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/music/')) {
    const match = url.pathname.match(/\/tracks\/T(\d)\/audio$/);
    if (match) { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(tones[Number(match[1]) - 1]); return; }
    const data = url.pathname.endsWith('/config') ? { inbox_path: 'test' }
      : url.pathname.endsWith('/playlists') ? { playlists: [] } : { tracks, stats: {} };
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); return;
  }
  const filename = url.pathname.startsWith('/static/') ? path.resolve(build, `.${url.pathname}`) : path.join(build, 'index.html');
  if (!filename.startsWith(build + path.sep)) { res.writeHead(403); res.end(); return; }
  const type = filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html';
  res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(filename).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.probe = { media: [], levels: [], timeline: [] };
      setInterval(() => {
        const audio = window.probe.media.findLast(({ audio }) => !audio.paused)?.audio;
        if (audio) window.probe.timeline.push({ at: performance.now(), time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate });
      }, 1000);
      const originalSource = AudioContext.prototype.createMediaElementSource;
      AudioContext.prototype.createMediaElementSource = function (audio) {
        const before = performance.now();
        const source = originalSource.call(this, audio);
        const record = { audio, events: [{ event: 'connected', position: audio.currentTime, ready: audio.readyState, before, at: performance.now() }] };
        window.probe.media.push(record);
        for (const event of ['playing', 'pause', 'ended', 'seeking', 'canplay', 'waiting']) audio.addEventListener(event, () => {
          record.events.push({ event, position: audio.currentTime, at: performance.now() });
        });
        return source;
      };
      const originalCompressor = AudioContext.prototype.createDynamicsCompressor;
      AudioContext.prototype.createDynamicsCompressor = function () {
        const compressor = originalCompressor.call(this);
        const analyser = this.createAnalyser();
        analyser.fftSize = 512;
        compressor.connect(analyser);
        const samples = new Float32Array(512);
        setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
          window.probe.levels.push({ at: performance.now(), rms });
        }, 20);
        return compressor;
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/music`);
    await page.getByRole('button', { name: 'Auto radio', exact: true }).click();
    await page.waitForFunction(() => window.probe.media.filter((record) => record.events.some((e) => e.event === 'pause')).length >= 4, null, { timeout: 60000 });
    const result = await page.evaluate(() => ({
      media: window.probe.media.map(({ audio, events }) => ({ id: audio.dataset.trackId || 'initial', events })),
      levels: window.probe.levels,
      timeline: window.probe.timeline,
    }));
    const played = result.media.filter((record) => record.events.some((e) => e.event === 'playing'));
    assert.ok(played.length >= 5, 'At least five songs should play through consecutive handoffs');
    for (let i = 0; i < played.length - 1; i += 1) {
      const paused = played[i].events.find((e) => e.event === 'pause');
      const nextStart = played[i + 1].events.find((e) => e.event === 'playing');
      assert.ok(paused && paused.at - nextStart.at >= 3500, `Both decks must overlap for the full fade: ${JSON.stringify({media:result.media,timeline:result.timeline})}`);
      assert.equal(played[i].events.filter((e) => e.event === 'playing').length, 1, 'No replay during handoff');
      assert.ok(!played[i].events.some((e) => e.event === 'ended'), 'Fade must finish before a hard file ending');
    }
    const firstStart = played[0].events.find((e) => e.event === 'playing').at;
    const levels = result.levels.filter((sample) => sample.at > firstStart + 200);
    assert.ok(levels.length > 100);
    assert.ok(Math.min(...levels.map((sample) => sample.rms)) > 0.005, 'Master output must stay audible across every transition');
    assert.deepEqual(errors, []);
    // Repeated skip presses must not abandon an in-progress fade.
    const before = played.length;
    await page.getByTitle('Next', { exact: true }).click({ clickCount: 3, delay: 60 });
    await page.getByTitle('Play/Pause', { exact: true }).click();
    await page.waitForTimeout(1000);
    const stillPlaying = await page.evaluate(() => window.probe.media.filter(({ audio }) => !audio.paused).length);
    assert.equal(stillPlaying, 0, 'Pause during transition must stop both decks');
    console.log(JSON.stringify({ songsPlayed: before, completedHandoffs: before - 1, minOutputRms: Math.min(...levels.map((s) => s.rms)), browserErrors: errors, pauseDuringFade: 'passed' }, null, 2));
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
