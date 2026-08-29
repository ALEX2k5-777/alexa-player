#!/usr/bin/env python3
"""
Python Studio-Grade Audio Analysis Module (Alexa Player - 100% Deterministic Engine)
Uses Librosa CQT Chromagram with fixed deterministic sampling grid and zero random state.
Guarantees 100% IDENTICAL output every time the same song is uploaded.
"""

import sys
import json
import numpy as np

def analyze_song(audio_path):
    try:
        import librosa
    except ImportError:
        return {"error": "librosa not installed"}

    # 1. Load Audio with Fixed Target Sample Rate (22050 Hz)
    y, sr = librosa.load(audio_path, sr=22050, duration=240)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # 2. Harmonic-Percussive Source Separation
    y_harmonic, y_percussive = librosa.effects.hpss(y)

    # 3. Deterministic Tempo (BPM) Calculation via Onset Autocorrelation
    onset_env = librosa.onset.onset_strength(y=y_percussive, sr=sr, hop_length=512)
    ac = librosa.autocorrelate(onset_env, max_size=int(sr * 4 / 512))
    
    # Lag limits for 60 BPM to 180 BPM
    min_lag = int(sr * 60 / (180 * 512))
    max_lag = int(sr * 60 / (60 * 512))
    if max_lag > len(ac): max_lag = len(ac) - 1

    best_lag = min_lag + np.argmax(ac[min_lag:max_lag])
    bpm = int(np.round((sr * 60.0) / (best_lag * 512)))
    if bpm < 65: bpm *= 2
    if bpm > 180: bpm = int(np.round(bpm / 2))

    # 4. Constant-Q Transform (CQT) Chromagram (Fixed tuning=0.0 for 100% deterministic results)
    hop_length = 1024
    chroma = librosa.feature.chroma_cqt(
        y=y_harmonic,
        sr=sr,
        tuning=0.0,
        hop_length=hop_length,
        n_chroma=12
    )

    # 5. Deterministic Fixed-Time Measure Grid
    # Measure slice step = 2 beats (seconds per measure slice)
    slice_sec = max(1.0, (60.0 / bpm) * 2.0)
    num_slices = int(np.floor(duration / slice_sec))
    frames_per_sec = sr / hop_length
    total_frames = chroma.shape[1]

    # Chord Templates
    templates = {
        'C': [1,0,0,0,1,0,0,1,0,0,0,0], 'Cm': [1,0,0,1,0,0,0,1,0,0,0,0], 'C7': [1,0,0,0,1,0,0,1,0,0,1,0],
        'C#': [0,1,0,0,0,1,0,0,1,0,0,0], 'C#m': [0,1,0,0,1,0,0,0,1,0,0,0],
        'D': [0,0,1,0,0,0,1,0,0,1,0,0], 'Dm': [0,0,1,0,0,1,0,0,0,1,0,0], 'D7': [1,0,1,0,0,0,1,0,0,0,1,0],
        'D#': [0,0,0,1,0,0,0,1,0,0,1,0], 'D#m': [0,0,0,1,0,0,1,0,0,0,1,0],
        'E': [0,0,0,0,1,0,0,0,1,0,0,1], 'Em': [0,0,0,0,1,0,0,1,0,0,0,1], 'E7': [0,0,1,0,1,0,0,1,0,0,0,1],
        'F': [1,0,0,0,0,1,0,0,0,1,0,0], 'Fm': [1,0,0,0,0,1,0,0,1,0,0,0],
        'F#': [0,1,0,0,0,0,1,0,0,0,1,0], 'F#m': [0,1,0,0,0,0,1,0,0,1,0,0],
        'G': [0,0,1,0,0,0,0,1,0,0,0,1], 'Gm': [0,0,1,0,0,0,0,1,0,0,1,0], 'G7': [1,0,0,0,0,0,0,1,0,0,0,1],
        'G#': [1,0,0,1,0,0,0,0,1,0,0,0], 'G#m': [0,0,0,1,0,0,0,0,1,0,0,1],
        'A': [0,0,1,0,0,0,0,0,0,1,0,0], 'Am': [1,0,0,0,1,0,0,0,0,1,0,0], 'Am7': [1,0,0,0,1,0,0,1,0,1,0,0],
        'A#': [0,1,0,0,1,0,0,0,0,0,1,0], 'A#m': [0,1,0,0,1,0,0,1,0,0,0,0],
        'B': [0,0,0,1,0,0,1,0,0,0,0,1], 'Bm': [0,0,1,0,0,0,1,0,0,0,0,1]
    }

    chord_notes_map = {
        'C': ['C4', 'E4', 'G4'],   'Cm': ['C4', 'D#4', 'G4'],   'C7': ['C4', 'E4', 'G4', 'A#4'],
        'C#': ['C#4', 'F4', 'G#4'], 'C#m': ['C#4', 'E4', 'G#4'],
        'D': ['D4', 'F#4', 'A4'],  'Dm': ['D4', 'F4', 'A4'],    'D7': ['D4', 'F#4', 'A4', 'C5'],
        'D#': ['D#4', 'G4', 'A#4'], 'D#m': ['D#4', 'F#4', 'A#4'],
        'E': ['E4', 'G#4', 'B4'],  'Em': ['E4', 'G4', 'B4'],    'E7': ['E4', 'G#4', 'B4', 'D5'],
        'F': ['F3', 'A3', 'C4'],   'Fm': ['F3', 'G#3', 'C4'],
        'F#': ['F#3', 'A#3', 'C#4'],'F#m': ['F#3', 'A3', 'C#4'],
        'G': ['G3', 'B3', 'D4'],   'Gm': ['G3', 'A#3', 'D4'],    'G7': ['G3', 'B3', 'D4', 'F4'],
        'G#': ['G#3', 'C4', 'D#4'], 'G#m': ['G#3', 'B3', 'D#4'],
        'A': ['A3', 'C#4', 'E4'],  'Am': ['A3', 'C4', 'E4'],    'Am7': ['A3', 'C4', 'E4', 'G4'],
        'A#': ['A#3', 'D4', 'F4'], 'A#m': ['A#3', 'C#4', 'F4'],
        'B': ['B3', 'D#4', 'F#4'], 'Bm': ['B3', 'D4', 'F#4']
    }

    chord_names = list(templates.keys())
    template_matrix = np.array([templates[k] for k in chord_names], dtype=float)
    template_norms = np.linalg.norm(template_matrix, axis=1, keepdims=True)
    template_matrix /= np.maximum(template_norms, 1e-6)

    timeline = []

    # 6. Extract Chords Sliced on Deterministic Time Boundaries
    for s in range(num_slices):
        t_start = float(s * slice_sec)
        t_end = float((s + 1) * slice_sec)

        f_start = int(t_start * frames_per_sec)
        f_end = int(t_end * frames_per_sec)

        if f_start < total_frames:
            slice_chroma = np.mean(chroma[:, f_start:min(f_end, total_frames)], axis=1)
            norm = np.linalg.norm(slice_chroma)
            if norm > 0:
                slice_chroma /= norm

            sims = np.dot(template_matrix, slice_chroma)
            best_idx = int(np.argmax(sims))
            best_chord = chord_names[best_idx]
        else:
            best_chord = 'C'

        timeline.append({
            "time": t_start,
            "endTime": t_end,
            "chord": best_chord,
            "notes": chord_notes_map.get(best_chord, ['C4', 'E4', 'G4'])
        })

    # 7. Deterministic Hysteresis Smoothing (Removes Isolated 1-slice Jitter)
    if len(timeline) >= 3:
        for k in range(1, len(timeline) - 1):
            prev_c = timeline[k-1]["chord"]
            curr_c = timeline[k]["chord"]
            next_c = timeline[k+1]["chord"]
            if prev_c == next_c and curr_c != prev_c:
                timeline[k]["chord"] = prev_c
                timeline[k]["notes"] = chord_notes_map.get(prev_c, ['C4', 'E4', 'G4'])

    # 8. Deterministic Time Signature Detection (4/4 vs 3/4)
    time_sig = "4/4"
    time_sig_desc = "Common Time (4 Beats)"

    pulse = np.sum(chroma, axis=0)
    if len(pulse) >= 12:
        period_3 = float(np.mean(pulse[::3])) if len(pulse) >= 3 else 0.0
        period_4 = float(np.mean(pulse[::4])) if len(pulse) >= 4 else 0.0
        if period_3 > period_4 * 1.2:
            time_sig = "3/4"
            time_sig_desc = "Waltz Time (3 Beats)"

    return {
        "bpm": bpm,
        "timeSignature": time_sig,
        "timeSigDescription": time_sig_desc,
        "chordsTimeline": timeline
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        res = analyze_song(sys.argv[1])
        print(json.dumps(res))
