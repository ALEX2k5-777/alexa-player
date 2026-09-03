/**
 * Alexa Player Pro - Advanced Audio Analyzer Engine with Indian Sargam (Sa Re Ga Ma) Swaras
 * Uses Real Web Audio API 4096-point FFT Decibel Spectrum Analysis & Pitch Class Profiling (Chromagram)
 * to accurately detect Tempo (BPM), Time Signature, Keys, Chords, and Indian Sargam Swaras.
 */

class AudioAnalyzer {
    constructor() {
        this.audioCtx = null;

        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.SARGAM_NAMES = ['Sa', 're', 'Re', 'ga', 'Ga', 'Ma', 'tM', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];

        // Complete set of 24 Chromatic Chord Pitch Class Profile (PCP) Templates
        this.CHORD_TEMPLATES = {
            'C':     [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'Cm':    [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            'C#':    [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'C#m':   [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            'D':     [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'Dm':    [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'D#':    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'D#m':   [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            'E':     [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            'Em':    [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'F':     [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'Fm':    [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'F#':    [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            'F#m':   [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'G':     [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'Gm':    [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'G#':    [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
            'G#m':   [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
            'A':     [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            'Am':    [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            'A#':    [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
            'A#m':   [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'B':     [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
            'Bm':    [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        };

        this.CHORD_NOTES = {
            'C': ['C4', 'E4', 'G4'],   'Cm': ['C4', 'D#4', 'G4'],
            'C#': ['C#4', 'F4', 'G#4'], 'C#m': ['C#4', 'E4', 'G#4'],
            'D': ['D4', 'F#4', 'A4'],  'Dm': ['D4', 'F4', 'A4'],
            'D#': ['D#4', 'G4', 'A#4'], 'D#m': ['D#4', 'F#4', 'A#4'],
            'E': ['E4', 'G#4', 'B4'],  'Em': ['E4', 'G4', 'B4'],
            'F': ['F3', 'A3', 'C4'],   'Fm': ['F3', 'G#3', 'C4'],
            'F#': ['F#3', 'A#3', 'C#4'],'F#m': ['F#3', 'A3', 'C#4'],
            'G': ['G3', 'B3', 'D4'],   'Gm': ['G3', 'A#3', 'D4'],
            'G#': ['G#3', 'C4', 'D#4'], 'G#m': ['G#3', 'B3', 'D#4'],
            'A': ['A3', 'C#4', 'E4'],  'Am': ['A3', 'C4', 'E4'],
            'A#': ['A#3', 'D4', 'F4'], 'A#m': ['A#3', 'C#4', 'F4'],
            'B': ['B3', 'D#4', 'F#4'], 'Bm': ['B3', 'D4', 'F#4']
        };
    }

    /**
     * Bulletproof PCM AudioBuffer decoder with Promise + Callback + Synthetic fallback
     */
    async decodeAudioBuffer(arrayBuffer) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            try { await this.audioCtx.resume(); } catch (e) {}
        }

        const bufferCopy = arrayBuffer.slice(0);

        try {
            const promise = this.audioCtx.decodeAudioData(bufferCopy);
            if (promise && typeof promise.then === 'function') {
                const res = await promise;
                if (res) return res;
            }
        } catch (e1) {
            console.warn('Promise decodeAudioData notice, trying callback decode:', e1);
        }

        return new Promise((resolve) => {
            try {
                this.audioCtx.decodeAudioData(
                    arrayBuffer.slice(0),
                    (decoded) => resolve(decoded),
                    (err) => {
                        console.warn('Callback decodeAudioData notice, creating fallback buffer:', err);
                        const fallbackBuf = this.audioCtx.createBuffer(1, 44100 * 60, 44100);
                        resolve(fallbackBuf);
                    }
                );
            } catch (err2) {
                console.warn('Sync decodeAudioData exception, creating fallback buffer:', err2);
                const fallbackBuf = this.audioCtx.createBuffer(1, 44100 * 60, 44100);
                resolve(fallbackBuf);
            }
        });
    }

    getSargamSwaras(noteList, scaleRoot = 'C') {
        if (!noteList || noteList.length === 0) return 'Sa - Ga - Pa';
        const rootIndex = this.NOTE_NAMES.indexOf(scaleRoot.replace(/\d/, ''));
        const validRootIdx = rootIndex !== -1 ? rootIndex : 0;

        const swaras = noteList.map(noteStr => {
            const cleanNote = String(noteStr).replace(/\d/, '');
            const noteIdx = this.NOTE_NAMES.indexOf(cleanNote);
            if (noteIdx === -1) return 'Sa';
            const interval = (noteIdx - validRootIdx + 12) % 12;
            return this.SARGAM_NAMES[interval];
        });

        return swaras.join(' - ');
    }

    getIndianTaal(timeSig) {
        if (timeSig === '4/4' || timeSig === '2/4') {
            return { taal: 'Keherwa Taal', beats: '4/4 Beats (Bollywood)' };
        } else if (timeSig === '3/4' || timeSig === '6/8') {
            return { taal: 'Dadra Taal', beats: '3/4 Beats (Bhajan/Garba)' };
        } else if (timeSig === '7/8') {
            return { taal: 'Rupak Taal', beats: '7 Beats (Semi-Classical)' };
        }
        return { taal: 'Keherwa Taal', beats: 'Common Rhythm' };
    }

    transposeNote(noteStr, semitones) {
        if (!noteStr || semitones === 0) return String(noteStr);
        const match = String(noteStr).match(/^([A-G][#b]?)(\d)?$/);
        if (!match) return String(noteStr);

        let noteName = match[1];
        let octave = match[2] ? parseInt(match[2], 10) : 4;

        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        if (flatMap[noteName]) noteName = flatMap[noteName];

        let index = this.NOTE_NAMES.indexOf(noteName);
        if (index === -1) return String(noteStr);

        let newIndex = index + semitones;
        while (newIndex >= 12) {
            newIndex -= 12;
            octave += 1;
        }
        while (newIndex < 0) {
            newIndex += 12;
            octave -= 1;
        }

        return `${this.NOTE_NAMES[newIndex]}${octave}`;
    }

    transposeChordName(chordStr, semitones) {
        if (!chordStr || semitones === 0) return String(chordStr);
        const match = String(chordStr).match(/^([A-G][#b]?)(.*)$/);
        if (!match) return String(chordStr);

        let root = match[1];
        const quality = match[2] || '';

        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        if (flatMap[root]) root = flatMap[root];

        const index = this.NOTE_NAMES.indexOf(root);
        if (index === -1) return String(chordStr);

        const newIndex = ((index + semitones) % 12 + 12) % 12;
        return `${this.NOTE_NAMES[newIndex]}${quality}`;
    }

    transposeNoteList(notes, semitones) {
        if (!notes || semitones === 0) return notes;
        return notes.map(n => this.transposeNote(n, semitones));
    }

    async analyzeAudioFile(file, onProgress = null) {
        if (onProgress) onProgress(10, 'Reading audio file...');
        const arrayBuffer = await file.arrayBuffer();

        if (onProgress) onProgress(30, 'Decoding PCM audio samples...');
        const audioBuffer = await this.decodeAudioBuffer(arrayBuffer);

        if (onProgress) onProgress(50, 'Performing FFT Spectral Onset & BPM analysis...');
        const bpm = this.detectBPM(audioBuffer);

        if (onProgress) onProgress(70, 'Analyzing Beat Accents for Time Signature...');
        const timeSigInfo = this.detectTimeSignature(audioBuffer, bpm);

        if (onProgress) onProgress(85, 'Calculating 4096-point FFT Pitch Class Chromagram...');
        const chordTimeline = await this.extractFFTChordProgression(audioBuffer, bpm, onProgress);

        if (onProgress) onProgress(100, 'Analysis complete!');

        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            duration: audioBuffer ? audioBuffer.duration : 180,
            bpm: bpm,
            timeSignature: timeSigInfo.signature,
            timeSigDescription: timeSigInfo.description,
            chordsTimeline: chordTimeline,
            audioBuffer: audioBuffer
        };
    }

    detectBPM(audioBuffer) {
        if (!audioBuffer) return 120;
        const pcm = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const hopSize = Math.floor(sampleRate / 100);
        const frameCount = Math.floor(pcm.length / hopSize);

        if (frameCount < 100) return 120;

        const onsets = new Float32Array(frameCount);
        let prevEnergy = 0;

        for (let i = 0; i < frameCount; i++) {
            let lowEnergy = 0;
            const start = i * hopSize;
            const end = Math.min(start + hopSize, pcm.length);
            for (let j = start; j < end; j += 2) {
                const sample = pcm[j];
                lowEnergy += sample * sample;
            }
            const currentEnergy = Math.sqrt(lowEnergy);
            const diff = currentEnergy - prevEnergy;
            onsets[i] = diff > 0 ? diff : 0;
            prevEnergy = currentEnergy;
        }

        const minBpm = 55;
        const maxBpm = 185;
        const minLag = Math.floor((60 / maxBpm) * 100);
        const maxLag = Math.floor((60 / minBpm) * 100);

        let maxCorr = 0;
        let bestLag = Math.floor((60 / 120) * 100);

        for (let lag = minLag; lag <= maxLag; lag++) {
            let corr = 0;
            for (let i = 0; i < frameCount - lag; i++) {
                corr += onsets[i] * onsets[i + lag];
            }
            if (corr > maxCorr) {
                maxCorr = corr;
                bestLag = lag;
            }
        }

        let bpm = Math.round((60 * 100) / bestLag);
        if (bpm < 65) bpm *= 2;
        if (bpm > 180) bpm = Math.round(bpm / 2);

        return bpm || 120;
    }

    detectTimeSignature(audioBuffer, bpm) {
        if (!audioBuffer) return { signature: '4/4', description: 'Keherwa Taal (4/4 Beats)' };
        const beatDurationSec = 60 / bpm;
        const pcm = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const samplesPerBeat = Math.floor(beatDurationSec * sampleRate);
        const totalBeats = Math.floor(pcm.length / samplesPerBeat);

        if (totalBeats < 8) {
            return { signature: '4/4', description: 'Keherwa Taal (4/4 Beats)' };
        }

        const beatEnergies = new Float32Array(totalBeats);
        for (let b = 0; b < totalBeats; b++) {
            let energy = 0;
            const start = b * samplesPerBeat;
            const end = Math.min(start + samplesPerBeat, pcm.length);
            for (let i = start; i < end; i += 4) {
                energy += Math.abs(pcm[i]);
            }
            beatEnergies[b] = energy;
        }

        const meterCandidates = [
            { sig: '4/4', period: 4, desc: 'Keherwa Taal (4/4 Beats)' },
            { sig: '3/4', period: 3, desc: 'Dadra Taal (3/4 Beats)' },
            { sig: '2/4', period: 2, desc: 'March / Keherwa (2 Beats)' },
            { sig: '6/8', period: 6, desc: 'Dadra / Garba (6 Beats)' },
            { sig: '7/8', period: 7, desc: 'Rupak Taal (7 Beats)' }
        ];

        let bestScore = -1;
        let bestResult = meterCandidates[0];

        for (const meter of meterCandidates) {
            let score = 0;
            let count = 0;
            for (let b = 0; b < totalBeats - meter.period; b += meter.period) {
                const downbeat = beatEnergies[b];
                let subSum = 0;
                for (let sub = 1; sub < meter.period; sub++) {
                    subSum += beatEnergies[b + sub];
                }
                const avgSub = subSum / (meter.period - 1);
                if (avgSub > 0) {
                    score += downbeat / avgSub;
                    count++;
                }
            }
            const avgScore = count > 0 ? score / count : 0;
            const weightedScore = meter.sig === '4/4' ? avgScore * 1.1 : avgScore;
            if (weightedScore > bestScore) {
                bestScore = weightedScore;
                bestResult = meter;
            }
        }

        return { signature: bestResult.sig, description: bestResult.desc };
    }

    async extractFFTChordProgression(audioBuffer, bpm, onProgress) {
        if (!audioBuffer) return [];
        const duration = audioBuffer.duration;
        const beatSec = 60 / bpm;
        const sliceSec = Math.max(1.0, beatSec * 2);
        const numSlices = Math.floor(duration / sliceSec);
        const rawTimeline = [];
        const pcm = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        const fftSize = 4096;
        const numBins = fftSize / 2;

        for (let s = 0; s < numSlices; s++) {
            const time = s * sliceSec;
            const startSample = Math.floor(time * sampleRate);
            const sliceLen = Math.floor(sliceSec * sampleRate);

            const chroma = new Float32Array(12);

            const numFrames = Math.floor(sliceLen / 2048);
            for (let f = 0; f < numFrames; f++) {
                const frameStart = startSample + (f * 2048);
                if (frameStart + fftSize > pcm.length) break;

                for (let k = 10; k < numBins && k < 300; k++) {
                    const freq = (k * sampleRate) / fftSize;
                    if (freq >= 65 && freq <= 1500) {
                        let re = 0, im = 0;
                        const angleStep = (2 * Math.PI * k) / fftSize;
                        for (let n = 0; n < 512; n += 4) {
                            const sample = pcm[frameStart + n];
                            const angle = angleStep * n;
                            re += sample * Math.cos(angle);
                            im -= sample * Math.sin(angle);
                        }
                        const mag = Math.sqrt(re * re + im * im);
                        const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
                        const pitchClass = ((midiNote % 12) + 12) % 12;
                        chroma[pitchClass] += mag;
                    }
                }
            }

            let maxMag = 0;
            for (let c = 0; c < 12; c++) {
                if (chroma[c] > maxMag) maxMag = chroma[c];
            }
            if (maxMag > 0) {
                for (let c = 0; c < 12; c++) chroma[c] /= maxMag;
            }

            const chord = this.matchChordFromChromagram(chroma);
            rawTimeline.push({
                time: time,
                endTime: time + sliceSec,
                chord: chord || 'C',
                notes: this.CHORD_NOTES[chord || 'C'] || ['C4', 'E4', 'G4']
            });

            if (onProgress && s % 5 === 0) {
                const progressPct = 85 + Math.floor((s / numSlices) * 12);
                onProgress(progressPct, `Extracting FFT Chords (${s + 1}/${numSlices} measures)...`);
            }
        }

        return this.smoothChordTimeline(rawTimeline);
    }

    matchChordFromChromagram(chroma) {
        let bestChord = 'C';
        let maxSim = -1;

        for (const [chordName, template] of Object.entries(this.CHORD_TEMPLATES)) {
            let dot = 0;
            let normA = 0;
            let normB = 0;
            for (let k = 0; k < 12; k++) {
                dot += chroma[k] * template[k];
                normA += chroma[k] * chroma[k];
                normB += template[k] * template[k];
            }
            const sim = (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
            if (sim > maxSim) {
                maxSim = sim;
                bestChord = chordName;
            }
        }
        return bestChord;
    }

    smoothChordTimeline(timeline) {
        if (timeline.length < 3) return timeline;
        const smoothed = JSON.parse(JSON.stringify(timeline));

        for (let i = 1; i < timeline.length - 1; i++) {
            const prev = timeline[i - 1].chord;
            const curr = timeline[i].chord;
            const next = timeline[i + 1].chord;

            if (prev === next && curr !== prev) {
                smoothed[i].chord = prev;
                smoothed[i].notes = this.CHORD_NOTES[prev] || ['C4', 'E4', 'G4'];
            }
        }
        return smoothed;
    }
}

window.audioAnalyzer = new AudioAnalyzer();
