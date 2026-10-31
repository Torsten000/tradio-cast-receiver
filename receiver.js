const CUSTOM_NAMESPACE = 'urn:x-cast:com.example.tradio';

const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

const dom = {
    body: document.body,
    stage: document.getElementById('tvStage'),
    ambientArtwork: document.getElementById('ambientArtwork'),
    artworkGlow: document.getElementById('artworkGlow'),
    stationLogo: document.getElementById('stationLogo'),
    logoFallback: document.getElementById('logoFallback'),
    stationName: document.getElementById('stationName'),
    songTitle: document.getElementById('songTitle'),
    songArtist: document.getElementById('songArtist'),
    songMetaContainer: document.getElementById('songMetaContainer'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    standbyClock: document.getElementById('standbyClock'),
    historyList: document.getElementById('historyList'),
    visualizerCanvas: document.getElementById('visualizerCanvas'),
    streamBadge: document.getElementById('streamBadge'),
    liveDot: document.getElementById('liveDot')
};

let currentTitle = '';
let currentArtist = '';
let currentLogoUrl = '';
let recentSongs = [];
let isPlaying = false;

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

    if (dom.clockTime) dom.clockTime.textContent = timeStr;
    if (dom.standbyClock) dom.standbyClock.textContent = timeStr;
    if (dom.clockDate) dom.clockDate.textContent = dateStr;
}
setInterval(updateClock, 1000);
updateClock();

function setupPixelDrift() {
    setInterval(() => {
        if (!dom.stage) return;
        const maxShift = 10;
        const dx = Math.round((Math.random() - 0.5) * 2 * maxShift);
        const dy = Math.round((Math.random() - 0.5) * 2 * maxShift);
        dom.stage.style.transform = `translate(${dx}px, ${dy}px)`;
    }, 180000);
}
setupPixelDrift();

function extractDominantColor(img) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32).data;

        let bestR = 59, bestG = 130, bestB = 246;
        let maxSaturation = -1;

        for (let i = 0; i < imgData.length; i += 16) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 128) continue;
            const brightness = (r + g + b) / 3;
            if (brightness < 35 || brightness > 235) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const saturation = max === 0 ? 0 : delta / max;

            if (saturation > maxSaturation) {
                maxSaturation = saturation;
                bestR = r;
                bestG = g;
                bestB = b;
            }
        }

        applyAccentColor(bestR, bestG, bestB);
    } catch (_) {
        applyAccentColor(59, 130, 246);
    }
}

function applyAccentColor(r, g, b) {
    document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--accent-color', `rgb(${r}, ${g}, ${b})`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
    document.documentElement.style.setProperty('--card-border-glow', `rgba(${r}, ${g}, ${b}, 0.25)`);
}

function updateStationLogo(url) {
    if (!url || url === currentLogoUrl) return;
    currentLogoUrl = url;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        if (dom.stationLogo) {
            dom.stationLogo.src = url;
            dom.stationLogo.classList.add('visible');
        }
        if (dom.logoFallback) {
            dom.logoFallback.classList.add('hidden');
        }
        if (dom.ambientArtwork) {
            dom.ambientArtwork.style.backgroundImage = `url("${url}")`;
            dom.ambientArtwork.classList.add('active');
        }
        extractDominantColor(img);
    };
    img.onerror = () => {
        if (dom.stationLogo) {
            dom.stationLogo.classList.remove('visible');
        }
        if (dom.logoFallback) {
            dom.logoFallback.classList.remove('hidden');
        }
        if (dom.ambientArtwork) {
            dom.ambientArtwork.classList.remove('active');
        }
        applyAccentColor(59, 130, 246);
    };
    img.src = url;
}

function updateMetadata(title, artist, stationName, logoUrl, bitrate) {
    const cleanTitle = (title && title.trim()) ? title.trim() : 'Live Stream';
    const cleanArtist = (artist && artist.trim()) ? artist.trim() : (stationName || 'T-Radio');
    const cleanStation = (stationName && stationName.trim()) ? stationName.trim() : 'T-Radio';

    if (cleanTitle !== currentTitle || cleanArtist !== currentArtist) {
        if (currentTitle && dom.songMetaContainer) {
            addSongToHistory(currentTitle, currentArtist);
            dom.songMetaContainer.classList.add('fading');
            setTimeout(() => {
                applyTextUpdates(cleanTitle, cleanArtist, cleanStation);
                dom.songMetaContainer.classList.remove('fading');
            }, 350);
        } else {
            applyTextUpdates(cleanTitle, cleanArtist, cleanStation);
        }
        currentTitle = cleanTitle;
        currentArtist = cleanArtist;
    } else {
        if (dom.stationName) dom.stationName.textContent = cleanStation;
    }

    if (bitrate && dom.streamBadge) {
        dom.streamBadge.textContent = `LIVE • ${bitrate}`;
    }

    if (logoUrl) {
        updateStationLogo(logoUrl);
    }
}

function applyTextUpdates(title, artist, station) {
    if (dom.songTitle) dom.songTitle.textContent = title;
    if (dom.songArtist) dom.songArtist.textContent = artist;
    if (dom.stationName) dom.stationName.textContent = station;
}

function addSongToHistory(title, artist) {
    if (!title || title === 'Bereit zur Wiedergabe' || title === 'Live Stream') return;
    if (recentSongs.some(item => item.title === title)) return;

    recentSongs.unshift({ title, artist });
    if (recentSongs.length > 4) recentSongs.pop();

    renderHistory();
}

function renderHistory() {
    if (!dom.historyList) return;
    if (recentSongs.length === 0) {
        dom.historyList.innerHTML = '<li class="history-empty">Keine vorherigen Titel</li>';
        return;
    }

    dom.historyList.innerHTML = recentSongs.map(item => `
        <li class="history-item">
            <span class="history-item-title">${escapeHtml(item.title)}</span>
            <span class="history-item-artist">${escapeHtml(item.artist || '')}</span>
        </li>
    `).join('');
}

function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

let visualizerAnimationId = null;
let visualizerPhase = 0;

function startVisualizer() {
    if (visualizerAnimationId) return;
    const canvas = dom.visualizerCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        if (!isPlaying) {
            return;
        }

        visualizerPhase += 0.04;
        const barCount = 42;
        const barSpacing = width / barCount;
        const barWidth = barSpacing * 0.58;

        const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '59, 130, 246';

        for (let i = 0; i < barCount; i++) {
            const normalizedX = i / barCount;
            const wave1 = Math.sin(normalizedX * 6 + visualizerPhase) * 0.5 + 0.5;
            const wave2 = Math.sin(normalizedX * 12 - visualizerPhase * 1.5) * 0.3;
            const wave3 = Math.cos(normalizedX * 3 + visualizerPhase * 0.7) * 0.2;
            const waveHeight = Math.max(0.12, (wave1 + wave2 + wave3)) * (height * 0.85);

            const x = i * barSpacing + (barSpacing - barWidth) / 2;
            const y = height - waveHeight;

            const gradient = ctx.createLinearGradient(0, y, 0, height);
            gradient.addColorStop(0, `rgba(${accentRgb}, 0.95)`);
            gradient.addColorStop(1, `rgba(${accentRgb}, 0.2)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, waveHeight, [4, 4, 0, 0]);
            ctx.fill();
        }
    }
    draw();
}

function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    const canvas = dom.visualizerCanvas;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    loadRequestData => {
        const media = loadRequestData.media;
        if (media) {
            media.streamType = cast.framework.messages.StreamType.LIVE;
            if (!media.contentType || media.contentType === 'application/octet-stream') {
                media.contentType = 'audio/mpeg';
            }
            const metadata = media.metadata;
            const title = metadata ? (metadata.title || metadata.songName) : '';
            const artist = metadata ? metadata.artist : '';
            const station = metadata ? (metadata.albumTitle || metadata.subtitle || metadata.title) : 'T-Radio';
            const images = metadata ? metadata.images : null;
            const logoUrl = (images && images.length > 0) ? images[0].url : '';
            const customData = media.customData || loadRequestData.customData || {};

            updateMetadata(
                title,
                artist,
                station,
                logoUrl || customData.logoUrl,
                customData.bitrate || 'HD AUDIO'
            );
        }
        return loadRequestData;
    }
);

playerManager.addEventListener(
    cast.framework.events.EventType.PLAYER_STATE_CHANGED,
    event => {
        const state = event.playerState;
        if (state === cast.framework.messages.PlayerState.PLAYING) {
            isPlaying = true;
            dom.body.className = 'state-playing';
            startVisualizer();
        } else if (state === cast.framework.messages.PlayerState.PAUSED) {
            isPlaying = false;
            dom.body.className = 'state-paused';
            stopVisualizer();
        } else if (state === cast.framework.messages.PlayerState.IDLE) {
            isPlaying = false;
            dom.body.className = 'state-idle';
            stopVisualizer();
        }
    }
);

context.addCustomMessageListener(CUSTOM_NAMESPACE, event => {
    try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        if (data.type === 'METADATA_UPDATE') {
            updateMetadata(
                data.title,
                data.artist,
                data.stationName,
                data.logoUrl,
                data.bitrate
            );
        } else if (data.type === 'HISTORY_UPDATE' && Array.isArray(data.history)) {
            recentSongs = data.history.slice(0, 4);
            renderHistory();
        }
    } catch (_) {}
});

const playbackConfig = new cast.framework.PlaybackConfig();
playbackConfig.autoResumeDuration = 5;

context.start({
    playbackConfig: playbackConfig,
    disableIdleTimeout: true
});
