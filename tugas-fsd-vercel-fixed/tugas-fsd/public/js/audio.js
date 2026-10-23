// ==========================================================================
// SIANTRI - Web Audio Chime Synthesizer & Indonesian Voice Announcement
// ==========================================================================

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isAudioAllowed = false;
    this.voiceRate = 0.95;
    this.voicePitch = 1.0;
    this.isAnnouncing = false;
    this.queue = [];

    // Pre-load voices if speech synthesis is available
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.getIndonesianVoice();
      };
    }
  }

  // Initialize or resume AudioContext on first user interaction
  enableAudio() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.isAudioAllowed = true;
      return true;
    } catch (e) {
      console.warn("AudioContext init error:", e);
      return false;
    }
  }

  // Play realistic airport / bank chime bell using multi-tone sine wave synthesis
  playAirportChime() {
    return new Promise((resolve) => {
      try {
        this.enableAudio();
        if (!this.audioCtx) return resolve();

        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Frequencies for classic 4-note chime: C5, E5, G5, C6
        const notes = [
          { freq: 523.25, time: 0.0, dur: 0.6 },
          { freq: 659.25, time: 0.2, dur: 0.6 },
          { freq: 783.99, time: 0.4, dur: 0.7 },
          { freq: 1046.50, time: 0.65, dur: 1.1 }
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, now + note.time);

          // Envelope: fast attack, exponential decay
          gain.gain.setValueAtTime(0.001, now + note.time);
          gain.gain.linearRampToValueAtTime(0.28, now + note.time + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur);
        });

        // Resolve after total chime duration
        setTimeout(resolve, 1800);
      } catch (err) {
        console.warn("Chime play error:", err);
        resolve();
      }
    });
  }

  // Get Indonesian voice or closest fallback
  getIndonesianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize id-ID voices (e.g. Google Bahasa Indonesia, Microsoft Gadis, etc.)
    const idVoice = voices.find(v => v.lang === 'id-ID' || v.lang.startsWith('id'));
    if (idVoice) return idVoice;

    // Fallback: any voice or null
    return voices.find(v => v.lang.includes('ID')) || voices[0] || null;
  }

  // Convert ticket code & counter name to natural Indonesian spoken sentence
  // E.g. "A-007" at "Loket 1" -> "Nomor antrean... A... nol, nol, tujuh... silakan menuju... Loket satu."
  formatSpokenText(ticketCode, counterName) {
    if (!ticketCode) return "";

    const parts = ticketCode.split('-');
    const letter = parts[0] ? parts[0].toUpperCase() : '';
    const digits = parts[1] || '';

    // Convert digits: 0 -> nol, 1 -> satu, etc.
    const digitWords = {
      '0': 'nol',
      '1': 'satu',
      '2': 'dua',
      '3': 'tiga',
      '4': 'empat',
      '5': 'lima',
      '6': 'enam',
      '7': 'tujuh',
      '8': 'delapan',
      '9': 'sembilan'
    };

    const spokenDigits = digits.split('').map(d => digitWords[d] || d).join(', ');

    return `Nomor antrean... ${letter}, ${spokenDigits}... silakan menuju... ${counterName}.`;
  }

  // Play full announcement sequence: Chime -> Speech
  async announceCall(ticketCode, counterName) {
    if (!('speechSynthesis' in window)) return;

    // Push to queue to prevent overlapping speech
    this.queue.push({ ticketCode, counterName });
    if (this.isAnnouncing) return;

    this.processQueue();
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isAnnouncing = false;
      return;
    }

    this.isAnnouncing = true;
    const item = this.queue.shift();

    try {
      // 1. Play Chime
      await this.playAirportChime();

      // 2. Text to Speech
      const spokenText = this.formatSpokenText(item.ticketCode, item.counterName);
      
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'id-ID';
      utterance.rate = this.voiceRate || 0.95;
      utterance.pitch = this.voicePitch || 1.0;

      const indVoice = this.getIndonesianVoice();
      if (indVoice) {
        utterance.voice = indVoice;
      }

      utterance.onend = () => {
        setTimeout(() => this.processQueue(), 500);
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        setTimeout(() => this.processQueue(), 500);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Announce error:", err);
      this.processQueue();
    }
  }

  // Play short soft notification pip for customer tracking alert (giliran sudah dekat)
  playAlertBeep() {
    try {
      this.enableAudio();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      [600, 800, 1000].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.18);
      });
    } catch (e) {
      console.warn("Beep error:", e);
    }
  }
}

// Global audio engine singleton
window.audioEngine = new AudioEngine();

// Auto unlock audio on any user tap/click
window.addEventListener('click', () => {
  window.audioEngine.enableAudio();
}, { once: true });
