import { App } from './App.js';

window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');
    const app = new App(container);
    app.init();

    // Audio handling
    const audioBtn = document.getElementById('audio-btn');
    const audio = new Audio('wind_ambience.mp3');
    audio.loop = true;
    audio.volume = 0.4;

    let isAudioPlaying = false;

    audioBtn.addEventListener('click', () => {
        if (!isAudioPlaying) {
            audio.play().then(() => {
                isAudioPlaying = true;
                audioBtn.textContent = 'Mute Audio';
                audioBtn.style.background = 'rgba(255, 255, 255, 0.6)';
            }).catch(e => console.error("Audio play failed:", e));
        } else {
            audio.pause();
            isAudioPlaying = false;
            audioBtn.textContent = 'Enable Audio';
            audioBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        }
    });
});