/**
 * Alexa Player - Main Application Coordinator
 * Hybrid Audio Processing Engine with Session Caching for 100% Consistent Analysis.
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const audioFileInput = document.getElementById('audioFileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const analysisLoader = document.getElementById('analysisLoader');
    const playerWorkspace = document.getElementById('playerWorkspace');
    
    const analysisStatusText = document.getElementById('analysisStatusText');
    const analysisProgressBar = document.getElementById('analysisProgressBar');

    // In-Memory Track Cache for 100% Consistency on Re-uploads
    const trackCache = new Map();

    if (dropzone) {
        dropzone.addEventListener('click', () => audioFileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-blue-500', 'bg-blue-950/20');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-blue-500', 'bg-blue-950/20');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-blue-500', 'bg-blue-950/20');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                processAudioFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (audioFileInput) {
        audioFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processAudioFile(e.target.files[0]);
            }
        });
    }

    /**
     * Process uploaded song file deterministically
     */
    async function processAudioFile(file) {
        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)) {
            alert('Please select a valid audio file (MP3, WAV, M4A, FLAC, OGG).');
            return;
        }

        const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;

        if (dropzone) dropzone.classList.add('hidden');
        if (analysisLoader) {
            analysisLoader.classList.remove('hidden');
            analysisLoader.classList.add('flex');
        }

        try {
            let trackData = null;

            // Check if track was previously analyzed in this session
            if (trackCache.has(cacheKey)) {
                if (analysisStatusText) analysisStatusText.textContent = 'Loading cached track analysis...';
                if (analysisProgressBar) analysisProgressBar.style.width = '100%';

                const cachedResult = trackCache.get(cacheKey);
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await window.audioAnalyzer.audioCtx.decodeAudioData(arrayBuffer);

                trackData = {
                    ...cachedResult,
                    audioBuffer: audioBuffer
                };

            } else {
                // Try Python Studio-Grade Backend API first
                if (analysisStatusText) analysisStatusText.textContent = 'Contacting Audio MIR Engine...';
                if (analysisProgressBar) analysisProgressBar.style.width = '25%';

                try {
                    const response = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/octet-stream' },
                        body: file
                    });

                    if (response.ok) {
                        const serverResult = await response.json();
                        if (serverResult && serverResult.bpm && !serverResult.error) {

                            if (analysisStatusText) analysisStatusText.textContent = 'Decoding PCM Audio for Waveform Player...';
                            if (analysisProgressBar) analysisProgressBar.style.width = '80%';

                            const arrayBuffer = await file.arrayBuffer();
                            const audioBuffer = await window.audioAnalyzer.audioCtx.decodeAudioData(arrayBuffer);

                            trackData = {
                                title: file.name.replace(/\.[^/.]+$/, ""),
                                duration: audioBuffer.duration,
                                bpm: serverResult.bpm,
                                timeSignature: serverResult.timeSignature || '4/4',
                                timeSigDescription: serverResult.timeSigDescription || 'Common Time (4 Beats)',
                                chordsTimeline: serverResult.chordsTimeline || [],
                                audioBuffer: audioBuffer
                            };

                            // Save to session cache
                            trackCache.set(cacheKey, {
                                title: trackData.title,
                                duration: trackData.duration,
                                bpm: trackData.bpm,
                                timeSignature: trackData.timeSignature,
                                timeSigDescription: trackData.timeSigDescription,
                                chordsTimeline: trackData.chordsTimeline
                            });
                        }
                    }
                } catch (netErr) {
                    console.log('Server API analysis offline, falling back to Browser FFT Engine.');
                }

                // Fallback to browser-side 4096-point FFT engine if server API not returned
                if (!trackData || !trackData.chordsTimeline || trackData.chordsTimeline.length === 0) {
                    trackData = await window.audioAnalyzer.analyzeAudioFile(file, (percent, statusMsg) => {
                        if (analysisStatusText) analysisStatusText.textContent = statusMsg;
                        if (analysisProgressBar) analysisProgressBar.style.width = `${percent}%`;
                    });

                    trackCache.set(cacheKey, {
                        title: trackData.title,
                        duration: trackData.duration,
                        bpm: trackData.bpm,
                        timeSignature: trackData.timeSignature,
                        timeSigDescription: trackData.timeSigDescription,
                        chordsTimeline: trackData.chordsTimeline
                    });
                }
            }

            // Hide loader, show player workspace
            if (analysisLoader) {
                analysisLoader.classList.add('hidden');
                analysisLoader.classList.remove('flex');
            }
            if (playerWorkspace) {
                playerWorkspace.classList.remove('hidden');
            }

            window.musicPlayer.loadTrack(trackData, file);

        } catch (err) {
            console.error('Audio processing error:', err);
            alert('Error analyzing audio file. Please try another MP3 or WAV track.');
            if (analysisLoader) {
                analysisLoader.classList.add('hidden');
                analysisLoader.classList.remove('flex');
            }
            if (dropzone) dropzone.classList.remove('hidden');
        }
    }
});
