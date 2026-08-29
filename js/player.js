/**
 * Alexa Player - Music Player, Transposer & Waveform Controller
 * Manages audio playback, time stretching practice speed, transpose semitone shifting, and live chord syncing.
 */

class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentTrack = null;
        this.isPlaying = false;
        this.activeChordIndex = -1;
        this.loopEnabled = false;
        this.transposeOffset = 0; // -6 to +6 semitones

        // DOM elements
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
        
        // Transpose DOM elements
        this.transposeUpBtn = document.getElementById('transposeUpBtn');
        this.transposeDownBtn = document.getElementById('transposeDownBtn');
        this.transposeResetBtn = document.getElementById('transposeResetBtn');
        this.transposeDisplayBadge = document.getElementById('transposeDisplayBadge');

        this.currentTimeDisplay = document.getElementById('currentTimeDisplay');
        this.totalDurationDisplay = document.getElementById('totalDurationDisplay');
        
        this.waveformCanvas = document.getElementById('waveformCanvas');
        this.canvasCtx = this.waveformCanvas ? this.waveformCanvas.getContext('2d') : null;
        this.timelineContainer = document.getElementById('chordTimelineContainer');

        this.initListeners();
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

        // Transpose Controls Event Listeners
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

    /**
     * Load track data
     */
    loadTrack(trackData, audioFile) {
        this.currentTrack = trackData;
        this.transposeOffset = 0; // Reset transpose on new song
        
        const objectUrl = URL.createObjectURL(audioFile);
        this.audio.src = objectUrl;
        this.audio.playbackRate = parseFloat(this.speedSelector ? this.speedSelector.value : 1.0);

        document.getElementById('trackTitle').textContent = trackData.title;
        document.getElementById('displayBpm').textContent = trackData.bpm;
        document.getElementById('displayTimeSig').textContent = trackData.timeSignature;
        document.getElementById('timeSigDescription').textContent = trackData.timeSigDescription || 'Standard';

        const categoryEl = document.getElementById('tempoSpeedCategory');
        if (categoryEl) {
            if (trackData.bpm < 80) categoryEl.textContent = 'Slow Practice';
            else if (trackData.bpm > 140) categoryEl.textContent = 'Fast Tempo';
            else categoryEl.textContent = 'Medium Tempo';
        }

        this.totalDurationDisplay.textContent = this.formatTime(trackData.duration);
        this.currentTimeDisplay.textContent = '0:00';

        this.drawWaveform(trackData.audioBuffer);
        this.updateTransposeState();
    }

    /**
     * Update Transpose State and re-calculate chords across UI
     */
    updateTransposeState() {
        if (this.transposeDisplayBadge) {
            if (this.transposeOffset === 0) {
                this.transposeDisplayBadge.textContent = '0 semitones (Original)';
                this.transposeDisplayBadge.className = 'text-sm font-black text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700';
            } else if (this.transposeOffset > 0) {
                this.transposeDisplayBadge.textContent = `+${this.transposeOffset} semitones`;
                this.transposeDisplayBadge.className = 'text-sm font-black text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30';
            } else {
                this.transposeDisplayBadge.textContent = `${this.transposeOffset} semitones`;
                this.transposeDisplayBadge.className = 'text-sm font-black text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/30';
            }
        }

        if (!this.currentTrack || !this.currentTrack.chordsTimeline) return;

        // Render transposed chord progression timeline
        this.renderChordTimeline(this.currentTrack.chordsTimeline);

        // Update active playing chord
        if (this.activeChordIndex >= 0 && this.activeChordIndex < this.currentTrack.chordsTimeline.length) {
            this.setCurrentChord(this.currentTrack.chordsTimeline[this.activeChordIndex]);
        } else if (this.currentTrack.chordsTimeline.length > 0) {
            this.setCurrentChord(this.currentTrack.chordsTimeline[0]);
        }
    }

    togglePlayPause() {
        if (!this.audio.src) return;
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
        
        // Apply Transposition Offset
        const transposedChord = window.audioAnalyzer.transposeChordName(rawChordData.chord, this.transposeOffset);
        const transposedNotes = window.audioAnalyzer.transposeNoteList(rawChordData.notes, this.transposeOffset);

        document.getElementById('displayCurrentChord').textContent = transposedChord;
        document.getElementById('bannerChordName').textContent = transposedChord;

        const quality = transposedChord.includes('m') ? 'Minor' : (transposedChord.includes('7') ? 'Dominant 7th' : 'Major');
        document.getElementById('chordQualityBadge').textContent = quality;

        const notesText = transposedNotes.join(' - ');
        document.getElementById('bannerChordNotes').textContent = `[${notesText}]`;

        // Update Beginner Keyboard Guide visualizer highlights with transposed notes
        if (window.pianoVisualizer) {
            window.pianoVisualizer.highlightChord(transposedChord, transposedNotes);
        }
    }

    /**
     * Render scrolling interactive chord timeline with transposed chord names
     */
    renderChordTimeline(timeline) {
        if (!this.timelineContainer) return;
        this.timelineContainer.innerHTML = '';

        document.getElementById('chordCountBadge').textContent = `${timeline.length} Chords Detected`;

        timeline.forEach((item, index) => {
            const transposedChord = window.audioAnalyzer.transposeChordName(item.chord, this.transposeOffset);
            const transposedNotes = window.audioAnalyzer.transposeNoteList(item.notes, this.transposeOffset);

            const block = document.createElement('button');
            block.className = `chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[95px] rounded-2xl border transition-all cursor-pointer ${
                index === this.activeChordIndex ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-lg shadow-blue-500/20 scale-105' : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
            }`;
            block.dataset.index = index;

            block.innerHTML = `
                <span class="text-[11px] font-mono text-slate-400">${this.formatTime(item.time)}</span>
                <span class="text-xl font-black text-emerald-400 mt-1">${transposedChord}</span>
                <span class="text-[10px] text-slate-400 font-mono mt-0.5">${transposedNotes.join(' ')}</span>
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
                blk.className = 'chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[95px] rounded-2xl border transition-all cursor-pointer bg-blue-600/30 border-blue-500 text-blue-200 shadow-lg shadow-blue-500/20 scale-105 ring-1 ring-blue-400/50';
                blk.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            } else {
                blk.className = 'chord-block flex-shrink-0 flex flex-col items-center justify-center p-3.5 min-w-[95px] rounded-2xl border transition-all cursor-pointer bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700';
            }
        });
    }

    /**
     * Draw audio waveform on canvas
     */
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
