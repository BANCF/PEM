const fs = require('fs');
const path = require('path');

// Generate a high-quality 2-tone alert chime WAV file (44.1kHz, 16-bit Mono)
const sampleRate = 44100;
const duration = 0.8; // seconds
const numSamples = Math.floor(sampleRate * duration);
const dataBuffer = Buffer.alloc(numSamples * 2);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  let sample = 0;
  
  // Tone 1: 880 Hz (0s to 0.35s)
  if (t < 0.35) {
    const env = Math.exp(-t * 8);
    sample += Math.sin(2 * Math.PI * 880 * t) * env * 0.7;
  }
  
  // Tone 2: 1320 Hz (0.15s to 0.8s)
  if (t >= 0.15) {
    const t2 = t - 0.15;
    const env2 = Math.exp(-t2 * 6);
    sample += Math.sin(2 * Math.PI * 1320 * t) * env2 * 0.8;
  }

  // Clamp sample between -1 and 1
  sample = Math.max(-1, Math.min(1, sample));
  const intSample = Math.floor(sample * 32767);
  dataBuffer.writeInt16LE(intSample, i * 2);
}

// WAV Header
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataBuffer.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // Subchunk1Size
header.writeUInt16LE(1, 20);  // AudioFormat (PCM)
header.writeUInt16LE(1, 22);  // NumChannels (Mono)
header.writeUInt32LE(sampleRate, 24); // SampleRate
header.writeUInt32LE(sampleRate * 2, 28); // ByteRate
header.writeUInt16LE(2, 32);  // BlockAlign
header.writeUInt16LE(16, 34); // BitsPerSample
header.write('data', 36);
header.writeUInt32LE(dataBuffer.length, 40);

const wavBuffer = Buffer.concat([header, dataBuffer]);

const outDir = path.join(__dirname, '../edumanager/public/sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'notification.wav'), wavBuffer);
fs.writeFileSync(path.join(outDir, 'notification.mp3'), wavBuffer); // Dual format fallback

console.log('Successfully created notification sound file at public/sounds/notification.wav!');
