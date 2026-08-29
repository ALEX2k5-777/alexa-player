# 🎹 Alexa Player - Smart Audio Analyzer & Beginner Keyboard Guide

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![Web Audio: 4096-FFT](https://img.shields.io/badge/Web_Audio-4096--FFT-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

**Alexa Player** is an intelligent web application built for **beginner keyboard players**. Upload any song (MP3, WAV, M4A) and the app automatically extracts its **Tempo (BPM)**, **Time Signature** (4/4, 3/4, 2/4, 6/8, 7/8), and **Chord Progression**, presenting them in a sleek, music-player UI with a **3D Interactive Virtual Piano Keyboard** that lights up exact key fingerings in real time.

---

## 🌟 Key Features

* **⚡ Automatic Audio Detection**:
  * **Tempo (BPM)**: Calculates accurate song tempo with beat pulse animation.
  * **Time Signature**: Detects 4/4 (Common Time), 3/4 (Waltz Time), 2/4 (March), 6/8, and 7/8 meters.
  * **Chord Extraction**: Constant-Q Transform (CQT) & Pitch Class Profiling across 24 major & minor chords.
* **🎹 Interactive Beginner Piano Visualizer**:
  * 3-octave virtual piano keyboard.
  * **Root Note**: Highlighted in **Emerald Green** (e.g. `C` in `C Major`).
  * **Chord Fingerings**: Highlighted in **Glowing Blue** (e.g. `E` and `G` in `C Major`).
  * **Clickable Piano Keys**: Plays audio synth feedback for each key pressed.
* **🎛️ Real-Time Key Transposer**:
  * Transpose detected song chords and piano key fingerings up or down by semitones ($-6$ to $+6$).
* **🎚️ Practice Controls**:
  * **Interactive Waveform Visualizer**: Seek anywhere in the audio track.
  * **Slow-Motion Practice Speed**: Adjust playback rate (**0.50x, 0.75x, 1.00x, 1.25x**) with pitch preservation.
  * **A-B Measure Loop**: Loop specific measures to practice difficult keyboard passages.

---

## 🔬 Tech Stack & Architecture

* **Frontend**: HTML5, Tailwind CSS, Lucide Icons, Tonal.js, Web Audio API (4096-point FFT).
* **Backend Audio MIR**: Python 3.12, Librosa (Harmonic-Percussive Source Separation, CQT Chromagram), SciPy, NumPy.
* **Server**: Python HTTP Server with Audio Range Request support (`server.py`).

---

## 🚀 Quick Start Guide

### Prerequisites
* Python 3.10+ installed on your system.

### 1. Install Dependencies
```bash
pip install librosa scipy numpy
```

### 2. Run Local Development Server
```bash
python server.py
```

### 3. Open Web Application
Navigate to `http://localhost:8000` in your web browser and drag & drop your audio track!

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
