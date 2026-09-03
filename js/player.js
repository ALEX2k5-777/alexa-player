/**
 * Alexa Player Pro - Smart Indian Audio Player, Transposer & Sargam Engine
 * Manages audio playback, practice speed, transpose shifting, Indian Sargam (Sa Re Ga Ma) Swaras,
 * Indian Scale Root (Safed 1 to 7, Kali 1 to 5), Indian Taals (Keherwa, Dadra, Rupak), and 4-channel Web Audio DSP.
 */

class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentTrack = null;
        this.isPlaying = false;
        this.activeChordIndex = -1;
        this.loopEnabled = false;
        this.transposeOffset = 0;
        this.scaleRoot = 'C'; // Default Safed 1 (C)

        this.audioCtx = null;
        this.sourceNode = null;
        
        this.stemGains = { vocals: null, keyboard: null, bass: null, drums: null };
        this.stemMuted = { vocals: false, keyboard: false, bass: false, drums: false };
        this.stemSolo = { vocals: false, keyboard: false, bass: false, drums: false };

        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.speedSelector = document.getElementById('speedSelector');
        this.loopToggleBtn = document.getElementById('loopToggleBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeIcon = document.getElementById('volumeIcon');
        this.muteBtn = document.getElementById('muteBtn');
        this.rewindBtn = document.getElementById('rewindBtn');
        this.forwardBtn = document.getElementById('forwardBtn');
        
        this.transposeUpBtn = document.getElementById('transposeUpBtn');
        this.transposeDownBtn = document.getElementById('transposeDownBtn');
        this.transposeResetBtn = document.getElementById('transposeResetBtn');
        this.transposeDisplayBadge = document.getElementById('transposeDisplayBadge');
        this.scaleSaSelector = document.getElementById('scaleSaSelector');

        this.currentTimeDisplay = document.getElementById('currentTimeDisplay');
        this.totalDurationDisplay = document.getElementById('totalDurationDisplay');
        this.waveformCanvas = document.getElementById('waveformCanvas');
        this.canvasCtx = this.waveformCanvas ? this.waveformCanvas.getContext('2d') : null;
        this.timelineContainer = document.getElementById('chordTimelineContainer');

        this.initListeners();
        this.initStemMixerUI();
    }

    initListeners() {
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        if (this.speedSelector) {
            this.speedSelector.addEventListener('change', (e) => {
                this.audio.playbackRate = parseFloat(e.target.value);
            });
        }
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                this.audio.volume = parseFloat(e.target.value);
                this.updateVolumeIcon();
            });
        }
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => {
                this.audio.muted = !this.audio.muted;
                this.updateVolumeIcon();
            });
        }
        if (this.rewindBtn) {
            this.rewindBtn.addEventListener('click', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 5);
            });
        }
        if (this.forwardBtn) {
            this.forwardBtn.addEventListener('click', () => {
                this.audio.currentTime = Math.min(this.audio.duration || 0, this.audio.currentTime + 5);
            });
        }
        if (this.loopToggleBtn) {
            this.loopToggleBtn.addEventListener('click', () => {
                this.loopEnabled = !this.loopEnabled;
                this.loopToggleBtn.classList.toggle('bg-blue-600', this.loopEnabled);
                this.loopToggleBtn.classList.toggle('text-white', this.loopEnabled);
            });
        }

        if (this.scaleSaSelector) {
            this.scaleSaSelector.addEventListener('change', (e) => {
                this.scaleRoot = e.target.value;
                this.updateTransposeState();
            });
        }

        if (this.transposeUpBtn) {
            this.transposeUpBtn.addEventListener('click', () => {
                if (this.transposeOffset < 6) {
                    this.transposeOffset++;
                    this.updateTransposeState();
                }
            });
        }
        if (this.transposeDownBtn) {
            this.transposeDownBtn.addEventListener('click', () => {
                if (this.transposeOffset > -6) {
                    this.transposeOffset--;
                    this.updateTransposeState();
                }
            });
        }
        if (this.transposeResetBtn) {
            this.transposeResetBtn.addEventListener('click', () => {
                this.transposeOffset = 0;
                this.updateTransposeState();
            });
        }

        if (this.waveformCanvas) {
            this.waveformCanvas.addEventListener('click', (e) => {
                const rect = this.waveformCanvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = clickX / rect.width;
                if (this.audio.duration) {
                    this.audio.currentTime = pct * this.audio.duration;
                }
            });
        }

        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseIcon();
        });
    }

    setupAudioNodes() {
        if (this.sourceNode) return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

            const masterLimiter = this.audioCtx.createDynamicsCompressor();
            masterLimiter.threshold.value = -1.0;
            masterLimiter.knee.value = 0.0;
            masterLimiter.ratio.value = 20.0;
            masterLimiter.attack.value = 0.003;
            masterLimiter.release.value = 0.1;
            masterLimiter.connect(this.audioCtx.destination);

            const bassFilter = this.audioCtx.createBiquadFilter();
            bassFilter.type = 'lowpass';
            bassFilter.frequency.value = 200;
            this.stemGains.bass = this.audioCtx.createGain();
            this.sourceNode.connect(bassFilter);
            bassFilter.connect(this.stemGains.bass);
            this.stemGains.bass.connect(masterLimiter);

            const kbFilter = this.audioCtx.createBiquadFilter();
            kbFilter.type = 'bandpass';
            kbFilter.frequency.value = 950;
            kbFilter.Q.value = 0.9;
            this.stemGains.keyboard = this.audioCtx.createGain();
            this.sourceNode.connect(kbFilter);
            kbFilter.connect(this.stemGains.keyboard);
            this.stemGains.keyboard.connect(masterLimiter);

            const vocalFilter = this.audioCtx.createBiquadFilter();
            vocalFilter.type = 'highpass';
            vocalFilter.frequency.value = 1100;
            this.stemGains.vocals = this.audioCtx.createGain();
            this.sourceNode.connect(vocalFilter);
            vocalFilter.connect(this.stemGains.vocals);
            this.stemGains.vocals.connect(masterLimiter);

            const drumFilter = this.audioCtx.createBiquadFilter();
            drumFilter.type = 'highpass';
            drumFilter.frequency.value = 4000;
            this.stemGains.drums = this.audioCtx.createGain();
            this.sourceNode.connect(drumFilter);
            drumFilter.connect(this.stemGains.drums);
            this.stemGains.drums.connect(masterLimiter);

        } catch (e) {
            console.warn('Web Audio DSP Routing notice:', e);
        }
    }

    initStemMixerUI() {
        const stems = ['Vocals', 'Keyboard', 'Bass', 'Drums'];
        
        stems.forEach(stem => {
            const lower = stem.toLowerCase();
            const slider = document.getElementById(`vol${stem}`);
            const valLabel = document.getElementById(`val${stem}`);
            const muteBtn = document.getElementById(`mute${stem}Btn`);
            const soloBtn = document.getElementById(`solo${stem}Btn`);

            if (slider) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    if (valLabel) valLabel.textContent = `${Math.round(val * 100)}%`;
                    this.updateStemGain(lower, val);
                });
            }

            if (muteBtn) {
                muteBtn.addEventListener('click', () => {
                    this.stemMuted[lower] = !this.stemMuted[lower];
                    muteBtn.classList.toggle('bg-red-600', this.stemMuted[lower]);
                    muteBtn.classList.toggle('text-white', this.stemMuted[lower]);
                    this.applyMixerState();
                });
            }

            if (soloBtn) {
                soloBtn.addEventListener('click', () => {
                    this.stemSolo[lower] = !this.stemSolo[lower];
                    soloBtn.classList.toggle('bg-purple-600', this.stemSolo[lower]);
                    soloBtn.classList.toggle('text-white', this.stemSolo[lower]);
                    this.applyMixerState();
                });
            }
        });

        const btnFull = document.getElementById('presetFullMix');
        const btnMuteKb = document.getElementById('presetMuteKeyboard');
        const btnKaraoke = document.getElementById('presetKaraoke');
        const btnSoloKb = document.getElementById('presetSoloKeyboard');

        if (btnFull) {
            btnFull.addEventListener('click', () => {
                this.resetStemMixer();
            });
        }

        if (btnMuteKb) {
            btnMuteKb.addEventListener('click', () => {
                this.setStemVolume('keyboard', 0);
                this.setStemVolume('vocals', 1);
                this.setStemVolume('bass', 1);
                this.setStemVolume('drums', 1);
            });
        }

        if (btnKaraoke) {
            btnKaraoke.addEventListener('click', () => {
                this.setStemVolume('vocals', 0);
                this.setStemVolume('keyboard', 1);
                this.setStemVolume('bass', 1);
                this.setStemVolume('drums', 1);
            });
        }

        if (btnSoloKb) {
            btnSoloKb.addEventListener('click', () => {
                this.setStemVolume('keyboard', 1);
                this.setStemVolume('vocals', 0);
                this.setStemVolume('bass', 0);
                this.setStemVolume('drums', 0);
            });
        }
    }

    setStemVolume(stemName, val) {
        const titleCase = stemName.charAt(0).toUpperCase() + stemName.slice(1);
        const slider = document.getElementById(`vol${titleCase}`);
        const valLabel = document.getElementById(`val${titleCase}`);
        if (slider) slider.value = val;
        if (valLabel) valLabel.textContent = `${Math.round(val * 100)}%`;
        this.updateStemGain(stemName, val);
    }

    updateStemGain(stemName, val) {
        if (this.stemGains[stemName] && this.audioCtx) {
            this.stemGains[stemName].gain.setValueAtTime(val, this.audioCtx.currentTime);
        }
    }

    applyMixerState() {
        const anySolo = Object.values(this.stemSolo).some(v => v);
        const stems = ['vocals', 'keyboard', 'bass', 'drums'];

        stems.forEach(s => {
            let targetVol = 1.0;
            const slider = document.getElementById(`vol${s.charAt(0).toUpperCase() + s.slice(1)}`);
            if (slider) targetVol = parseFloat(slider.value);

            if (this.stemMuted[s]) {
                this.updateStemGain(s, 0);
            } else if (anySolo) {
                if (this.stemSolo[s]) {
                    this.updateStemGain(s, targetVol);
                } else {
                    this.updateStemGain(s, 0);
                }
            } else {
                this.updateStemGain(s, targetVol);
            }
        });
    }

    resetStemMixer() {
        const stems = ['vocals', 'keyboard', 'bass', 'drums'];
        stems.forEach(s => {
            this.stemMuted[s] = false;
            this.stemSolo[s] = false;
            this.setStemVolume(s, 1.0);

            const titleCase = s.charAt(0).toUpperCase() + s.slice(1);
            const muteBtn = document.getElementById(`mute${titleCase}Btn`);
            const soloBtn = document.getElementById(`solo${titleCase}Btn`);
            if (muteBtn) {
                muteBtn.classList.remove('bg-red-600', 'text-white');
            }
            if (soloBtn) {
                soloBtn.classList.remove('bg-purple-600', 'text-white');
            }
        });
    }

    loadTrack(trackData, audioFile) {
        this.currentTrack = trackData;
        this.transposeOffset = 0;
        
        // Auto-detect initial scale root (Sa) from first detected chord
        if (trackData.chordsTimeline && trackData.chordsTimeline.length > 0) {
            const firstChord = trackData.chordsTimeline[0].chord;
            const rootNote = firstChord.replace(/m|maj|min|dim|aug|sus|7|9/g, '').trim();
            if (rootNote) {
                this.scaleRoot = rootNote;
                if (this.scaleSaSelector) this.scaleSaSelector.value = rootNote;
            }
        }
        
        const objectUrl = URL.createObjectURL(audioFile);
        this.audio.src = objectUrl;
        this.audio.playbackRate = parseFloat(this.speedSelector ? this.speedSelector.value : 1.0);

        this.setupAudioNodes();

        document.getElementById('trackTitle').textContent = trackData.title;
        document.getElementById('displayBpm').textContent = trackData.bpm;
        document.getElementById('displayTimeSig').textContent = trackData.timeSignature;
        
        const taalInfo = window.audioAnalyzer.getIndianTaal(trackData.timeSignature);
        document.getElementById('timeSigDescription').textContent = `${taalInfo.taal} (${taalInfo.beats})`;

        const categoryEl = document.getElementById('tempoSpeedCategory');
        if (categoryEl) {
            if (trackData.bpm < 80) categoryEl.textContent = 'Vilambit (Slow)';
            else if (trackData.bpm > 140) categoryEl.textContent = 'Drut (Fast)';
            else categoryEl.textContent = 'Madhyam (Medium)';
        }

        this.totalDurationDisplay.textContent = this.formatTime(trackData.duration);
        this.currentTimeDisplay.textContent = '0:00';

        this.drawWaveform(trackData.audioBuffer);
        this.updateTransposeState();
    }

    updateTransposeState() {
        if (this.transposeDisplayBadge) {
            if (this.transposeOffset === 0) {
                this.transposeDisplayBadge.textContent = '0 st';
                this.transposeDisplayBadge.className = 'text-xs font-black text-slate-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700';
            } else if (this.transposeOffset > 0) {
                this.transposeDisplayBadge.textContent = `+${this.transposeOffset} st`;
                this.transposeDisplayBadge.className = 'text-xs font-black text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30';
            } else {
                this.transposeDisplayBadge.textContent = `${this.transposeOffset} st`;
                this.transposeDisplayBadge.className = 'text-xs font-black text-blue-300 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30';
            }
        }

        if (!this.currentTrack || !this.currentTrack.chordsTimeline) return;

        this.renderChordTimeline(this.currentTrack.chordsTimeline);

        if (this.activeChordIndex >= 0 && this.activeChordIndex < this.currentTrack.chordsTimeline.length) {
            this.setCurrentChord(this.currentTrack.chordsTimeline[this.activeChordIndex]);
        } else if (this.currentTrack.chordsTimeline.length > 0) {
            this.setCurrentChord(this.currentTrack.chordsTimeline[0]);
        }
    }

    togglePlayPause() {
        if (!this.audio.src) return;
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.audio.play();
            this.isPlaying = true;
        }
        this.updatePlayPauseIcon();
    }

    updatePlayPauseIcon() {
        if (this.isPlaying) {
            this.playIcon.classList.add('hidden');
            this.pauseIcon.classList.remove('hidden');
        } else {
            this.playIcon.classList.remove('hidden');
            this.pauseIcon.classList.add('hidden');
        }
    }

    updateVolumeIcon() {
        if (this.audio.muted || this.audio.volume === 0) {
            this.volumeIcon.setAttribute('data-lucide', 'volume-x');
        } else if (this.audio.volume < 0.5) {
            this.volumeIcon.setAttribute('data-lucide', 'volume-1');
        } else {
            this.volumeIcon.setAttribute('data-lucide', 'volume-2');
        }
        lucide.createIcons();
    }

    onTimeUpdate() {
        const curTime = this.audio.currentTime;
        this.currentTimeDisplay.textContent = this.formatTime(curTime);

        if (this.currentTrack) {
            this.drawWaveform(this.currentTrack.audioBuffer, curTime);
        }

        if (this.loopEnabled && this.activeChordIndex !== -1) {
            const curChord = this.currentTrack.chordsTimeline[this.activeChordIndex];
            if (curChord && curTime >= curChord.endTime) {
                this.audio.currentTime = curChord.time;
                return;
            }
        }

        if (this.currentTrack && this.currentTrack.chordsTimeline) {
            const idx = this.currentTrack.chordsTimeline.findIndex(
                item => curTime >= item.time && curTime < item.endTime
            );

            if (idx !== -1 && idx !== this.activeChordIndex) {
                this.activeChordIndex = idx;
                const chordData = this.currentTrack.chordsTimeline[idx];
                this.setCurrentChord(chordData);
                this.highlightTimelineBlock(idx);
            }
        }
    }

    setCurrentChord(rawChordData) {
        if (!rawChordData) return;
        
        const transposedChord = window.audioAnalyzer.transposeChordName(rawChordData.chord, this.transposeOffset);
        const transposedNotes = window.audioAnalyzer.transposeNoteList(rawChordData.notes, this.transposeOffset);

        const sargamText = window.audioAnalyzer.getSargamSwaras(transposedNotes, this.scaleRoot);

        document.getElementById('displayCurrentChord').textContent = transposedChord;
        document.getElementById('bannerChordName').textContent = transposedChord;

        const quality = transposedChord.includes('m') ? 'Minor (Komal)' : (transposedChord.includes('7') ? '7th (Saptak)' : 'Major (Shuddha)');
        document.getElementById('chordQualityBadge').textContent = quality;

        const notesText = transposedNotes.join(' - ');
        document.getElementById('displayChordNotes').textContent = `${notesText} (${sargamText})`;
        document.getElementById('bannerChordNotes').textContent = `[${notesText}] • ${sargamText}`;

        if (window.pianoVisualizer) {
            window.pianoVisualizer.highlightChord(transposedChord, transposedNotes);
        }
    }

    renderChordTimeline(timeline) {
        if (!this.timelineContainer) return;
        this.timelineContainer.innerHTML = '';

        document.getElementById('chordCountBadge').textContent = `${timeline.length} Chords & Sargam Swaras`;

        timeline.forEach((item, index) => {
            const transposedChord = window.audioAnalyzer.transposeChordName(item.chord, this.transposeOffset);
            const transposedNotes = window.audioAnalyzer.transposeNoteList(item.notes, this.transposeOffset);
            const sargamText = window.audioAnalyzer.getSargamSwaras(transposedNotes, this.scaleRoot);

            const block = document.createElement('button');
            block.className = `chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[105px] rounded-2xl border transition-all cursor-pointer ${
                index === this.activeChordIndex ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-lg shadow-blue-500/20 scale-105' : 'bg-[#111827]/90 border-slate-800 text-slate-300 hover:border-slate-700'
            }`;
            block.dataset.index = index;

            block.innerHTML = `
                <span class="text-[11px] font-mono text-slate-400">${this.formatTime(item.time)}</span>
                <span class="text-xl font-black text-amber-400 mt-1">${transposedChord}</span>
                <span class="text-[11px] font-bold text-emerald-300 mt-0.5">${sargamText}</span>
                <span class="text-[9px] text-slate-400 font-mono mt-0.5">${transposedNotes.join(' ')}</span>
            `;

            block.addEventListener('click', () => {
                this.audio.currentTime = item.time;
                if (!this.isPlaying) this.togglePlayPause();
            });

            this.timelineContainer.appendChild(block);
        });
    }

    highlightTimelineBlock(index) {
        if (!this.timelineContainer) return;
        const blocks = this.timelineContainer.querySelectorAll('.chord-block');
        blocks.forEach((blk, i) => {
            if (i === index) {
                blk.className = 'chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[105px] rounded-2xl border transition-all cursor-pointer bg-blue-600/30 border-blue-500 text-blue-200 shadow-lg shadow-blue-500/20 scale-105 ring-1 ring-blue-400/50';
                
                const targetLeft = blk.offsetLeft - (this.timelineContainer.clientWidth / 2) + (blk.clientWidth / 2);
                this.timelineContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
            } else {
                blk.className = 'chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[105px] rounded-2xl border transition-all cursor-pointer bg-[#111827]/90 border-slate-800 text-slate-300 hover:border-slate-700';
            }
        });
    }

    drawWaveform(audioBuffer, playheadTime = 0) {
        if (!this.waveformCanvas || !this.canvasCtx) return;

        const canvas = this.waveformCanvas;
        const ctx = this.canvasCtx;
        
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = 96;

        const width = canvas.width;
        const height = canvas.height;
        const pcm = audioBuffer.getChannelData(0);
        const step = Math.ceil(pcm.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);

        const playheadX = (playheadTime / audioBuffer.duration) * width;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = pcm[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            const y1 = (1 + min) * amp;
            const y2 = (1 + max) * amp;
            const barHeight = Math.max(2, y2 - y1);

            if (i <= playheadX) {
                ctx.fillStyle = '#3b82f6';
            } else {
                ctx.fillStyle = '#334155';
            }

            ctx.fillRect(i, height / 2 - barHeight / 2, 2, barHeight);
        }

        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(playheadX - 1, 0, 3, height);
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
}

window.musicPlayer = new MusicPlayer();
