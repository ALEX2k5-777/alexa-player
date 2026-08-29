/**
 * Alexa Player - Beginner Piano Keyboard Visualizer
 * Renders interactive piano keys and highlights fingerings for active chords in real time.
 */

class PianoVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.synthCtx = null;
        
        // Octaves to render (F3 to E6 gives 3 full octaves, perfect for desktop display)
        this.OCTAVES = [3, 4, 5];
        this.WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        this.BLACK_NOTES = [
            { note: 'C#', after: 'C' },
            { note: 'D#', after: 'D' },
            { note: 'F#', after: 'F' },
            { note: 'G#', after: 'G' },
            { note: 'A#', after: 'A' }
        ];

        this.renderedKeys = new Map(); // keyId -> element
        this.initKeyboard();
    }

    /**
     * Build the keyboard DOM elements
     */
    initKeyboard() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const keyboardWrapper = document.createElement('div');
        keyboardWrapper.className = 'relative flex items-start select-none';

        let whiteKeyOffset = 0;
        const whiteKeyWidth = 42;

        this.OCTAVES.forEach(octave => {
            this.WHITE_NOTES.forEach(noteName => {
                const fullNote = `${noteName}${octave}`;
                
                // Create White Key
                const whiteKey = document.createElement('div');
                whiteKey.className = 'key-white';
                whiteKey.dataset.note = fullNote;

                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = noteName === 'C' ? `C${octave}` : noteName;
                whiteKey.appendChild(label);

                // Add interactive click listener to play piano synth sound
                whiteKey.addEventListener('mousedown', () => this.playSynthNote(fullNote));

                keyboardWrapper.appendChild(whiteKey);
                this.renderedKeys.set(fullNote, whiteKey);

                // Check if a black key comes after this white key
                const blackDef = this.BLACK_NOTES.find(b => b.after === noteName);
                if (blackDef) {
                    const blackNoteName = `${blackDef.note}${octave}`;
                    const blackKey = document.createElement('div');
                    blackKey.className = 'key-black';
                    blackKey.dataset.note = blackNoteName;
                    
                    // Position black key between white keys
                    const leftPos = whiteKeyOffset * whiteKeyWidth + (whiteKeyWidth * 0.65);
                    blackKey.style.left = `${leftPos}px`;

                    const blackLabel = document.createElement('span');
                    blackLabel.className = 'key-label';
                    blackLabel.textContent = blackDef.note;
                    blackKey.appendChild(blackLabel);

                    blackKey.addEventListener('mousedown', () => this.playSynthNote(blackNoteName));

                    keyboardWrapper.appendChild(blackKey);
                    this.renderedKeys.set(blackNoteName, blackKey);
                }

                whiteKeyOffset++;
            });
        });

        this.container.appendChild(keyboardWrapper);
    }

    /**
     * Highlight piano keys for the given chord name and note list
     * @param {string} chordName e.g., "C", "Am", "G7"
     * @param {Array<string>} chordNotes e.g., ["C4", "E4", "G4"]
     */
    highlightChord(chordName, chordNotes = []) {
        // Clear all previous highlight classes
        this.renderedKeys.forEach(keyEl => {
            keyEl.classList.remove('active-chord-key', 'root-chord-key');
        });

        if (!chordNotes || chordNotes.length === 0) return;

        // Determine root note (e.g., 'C' from 'C' or 'Cmaj7', 'A' from 'Am')
        const rootNoteName = chordName.replace(/m|maj|min|dim|aug|sus|7|9|11|13/g, '').trim();

        chordNotes.forEach((fullNote, index) => {
            // Find key match or octave match
            let targetKey = this.renderedKeys.get(fullNote);
            if (!targetKey) {
                // Try octave 4 or 3 fallback if exact octave not found
                const baseNote = fullNote.replace(/\d/, '');
                targetKey = this.renderedKeys.get(`${baseNote}4`) || this.renderedKeys.get(`${baseNote}3`) || this.renderedKeys.get(`${baseNote}5`);
            }

            if (targetKey) {
                const noteBase = fullNote.replace(/\d/, '');
                if (noteBase === rootNoteName || index === 0) {
                    targetKey.classList.add('root-chord-key');
                } else {
                    targetKey.classList.add('active-chord-key');
                }
            }
        });
    }

    /**
     * Simple Web Audio API Synth to play audio note when user clicks virtual piano key
     */
    playSynthNote(noteName) {
        try {
            if (!this.synthCtx) {
                this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.synthCtx.state === 'suspended') {
                this.synthCtx.resume();
            }

            const freq = this.getNoteFrequency(noteName);
            if (!freq) return;

            const osc = this.synthCtx.createOscillator();
            const gain = this.synthCtx.createGain();

            osc.type = 'triangle'; // Warm piano-like tone
            osc.frequency.setValueAtTime(freq, this.synthCtx.currentTime);

            gain.gain.setValueAtTime(0.3, this.synthCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.synthCtx.currentTime + 0.8);

            osc.connect(gain);
            gain.connect(this.synthCtx.destination);

            osc.start();
            osc.stop(this.synthCtx.currentTime + 0.8);
        } catch (e) {
            console.warn('Synth playback audio note error:', e);
        }
    }

    /**
     * Map note name (e.g. C4, F#4) to frequency in Hz
     */
    getNoteFrequency(note) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = note.replace(/\d/, '');
        const octave = parseInt(note.match(/\d/)?.[0] || '4', 10);
        const semitone = notes.indexOf(noteName);
        if (semitone === -1) return 440;
        
        // A4 = 440Hz is semitone 57 from C0
        const midiNum = (octave + 1) * 12 + semitone;
        return 440 * Math.pow(2, (midiNum - 69) / 12);
    }
}

// Global Singleton Instance
window.pianoVisualizer = new PianoVisualizer('pianoContainer');
