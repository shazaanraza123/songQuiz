// Spotify API credentials
const clientId = 'cfbc79fa66bf4216b22e6eec86497434'; // Replace this with your actual Client ID from Spotify Dashboard
const redirectUri = 'http://127.0.0.1:8000';

// Game state
let player;
let currentPlaylist = [];
let currentSong;
let score = 0;
let round = 1;
let gameInProgress = false;
let token = null;
let timerInterval = null;
let roundStartTime = null;
let totalElapsedTime = 0;
let leaderboard = [];

// DOM Elements
const loginButton = document.getElementById('login-button');
const loginSection = document.getElementById('login-section');
const gameSection = document.getElementById('game-section');
const playlistInput = document.getElementById('playlist-url');
const startGameButton = document.getElementById('start-game');
const gameContent = document.getElementById('game-content');
const scoreElement = document.getElementById('score');
const roundElement = document.getElementById('round');
const optionsContainer = document.getElementById('options');
const skipButton = document.getElementById('skip-button');
const timerElement = document.getElementById('timer');
const leaderboardElement = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');

// Initialize Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
    player = new Spotify.Player({
        name: 'Playlist Song Guesser',
        getOAuthToken: cb => { cb(token); }
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => { console.error(message); });
    player.addListener('authentication_error', ({ message }) => { console.error(message); });
    player.addListener('account_error', ({ message }) => { console.error(message); });
    player.addListener('playback_error', ({ message }) => { console.error(message); });

    // Playback status updates
    player.addListener('player_state_changed', state => { console.log(state); });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        // Transfer playback to the Web Playback SDK device
        fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [device_id], play: false }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
    });

    // Connect to the player!
    player.connect();
};

// Login with Spotify
loginButton.addEventListener('click', () => {
    window.location.href = 'http://127.0.0.1:8888/login';
});

// Handle authentication callback
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    token = params.get('access_token');
    if (token) {
        loginSection.style.display = 'none';
        gameSection.style.display = 'block';
    }
});

// Start game with playlist
startGameButton.addEventListener('click', async () => {
    const playlistUrl = playlistInput.value.trim();
    if (!playlistUrl) {
        alert('Please enter a valid Spotify playlist URL');
        return;
    }

    try {
        const playlistId = extractPlaylistId(playlistUrl);
        await fetchPlaylist(playlistId);
        startGame();
    } catch (error) {
        alert('Error loading playlist. Please check the URL and try again.');
        console.error(error);
    }
});

// Extract playlist ID from URL
function extractPlaylistId(url) {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// Fetch playlist tracks
async function fetchPlaylist(playlistId) {
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
    let allTracks = [];
    while (url) {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        allTracks = allTracks.concat(data.items.map(item => item.track));
        url = data.next; // Spotify API provides the next page URL or null
    }
    currentPlaylist = allTracks;
    if (currentPlaylist.length < 10) {
        throw new Error('Playlist must have at least 10 songs');
    }
}

// Start the game
function startGame() {
    gameInProgress = true;
    score = 0;
    round = 1;
    totalElapsedTime = 0;
    updateUI();
    gameContent.style.display = 'block';
    leaderboardElement.style.display = 'none';
    startTimer();
    playNextSong();
}

function startTimer() {
    timerElement.style.display = 'block';
    roundStartTime = Date.now();
    timerElement.textContent = 'Time: 0.00s';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - roundStartTime) / 1000).toFixed(2);
        timerElement.textContent = `Time: ${elapsed}s`;
    }, 50);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    const elapsed = (Date.now() - roundStartTime) / 1000;
    totalElapsedTime += elapsed;
    return elapsed;
}

// Play next song
async function playNextSong() {
    if (round > 10) {
        endGame();
        return;
    }
    startTimer();
    const randomIndex = Math.floor(Math.random() * currentPlaylist.length);
    currentSong = currentPlaylist[randomIndex];
    currentPlaylist.splice(randomIndex, 1);
    await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        body: JSON.stringify({ uris: [currentSong.uri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });
    generateOptions();
}

// Generate answer options
function generateOptions() {
    const options = [currentSong];
    const otherSongs = currentPlaylist.filter(song => song.id !== currentSong.id);

    // Get 3 random wrong answers
    while (options.length < 4 && otherSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherSongs.length);
        const randomSong = otherSongs.splice(randomIndex, 1)[0];
        if (!options.find(option => option.id === randomSong.id)) {
            options.push(randomSong);
        }
    }

    // Shuffle options
    options.sort(() => Math.random() - 0.5);

    // Display options
    optionsContainer.innerHTML = '';
    options.forEach(song => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = `${song.name} - ${song.artists[0].name}`;
        button.addEventListener('click', () => handleAnswer(button, song));
        optionsContainer.appendChild(button);
    });
}

function handleAnswer(button, selectedSong) {
    const elapsed = stopTimer();
    const buttons = document.querySelectorAll('.option-button');
    buttons.forEach(btn => btn.disabled = true);
    // Find the correct answer button
    let correctBtn = null;
    buttons.forEach(btn => {
        if (btn.textContent === `${currentSong.name} - ${currentSong.artists[0].name}`) {
            correctBtn = btn;
        }
    });
    if (selectedSong.id === currentSong.id) {
        score++;
        correctBtn.classList.add('correct');
        buttons.forEach(btn => {
            if (btn !== correctBtn) btn.classList.remove('correct', 'wrong');
        });
    } else {
        correctBtn.classList.add('correct');
        buttons.forEach(btn => {
            if (btn !== correctBtn) btn.classList.add('wrong');
        });
    }
    setTimeout(() => {
        round++;
        updateUI();
        playNextSong();
    }, 500);
}

// Skip current song
skipButton.addEventListener('click', () => {
    stopTimer();
    round++;
    updateUI();
    playNextSong();
});

// Update UI elements
function updateUI() {
    scoreElement.textContent = score;
    roundElement.textContent = round;
    // Show total time at the top
    timerElement.textContent = `Total Time: ${totalElapsedTime.toFixed(2)}s`;
}

// End game
function endGame() {
    gameInProgress = false;
    if (timerInterval) clearInterval(timerInterval);
    player.pause();
    timerElement.style.display = 'block';
    timerElement.textContent = `Total Time: ${totalElapsedTime.toFixed(2)}s`;
    gameContent.style.display = 'none';
    console.log('Saving to leaderboard: score =', score, 'time =', totalElapsedTime.toFixed(2));
    saveToLeaderboard(score, totalElapsedTime.toFixed(2));
    showLeaderboard();
    alert(`Game Over! Your final score: ${score}/10\nTotal Time: ${totalElapsedTime.toFixed(2)}s`);
}

function saveToLeaderboard(score, time) {
    const entry = { score, time, date: new Date().toLocaleString() };
    leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score || a.time - b.time);
    leaderboard = leaderboard.slice(0, 10); // Top 10
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
}

function showLeaderboard() {
    leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    leaderboardElement.style.display = 'block';
    leaderboardList.innerHTML = '';
    leaderboard.forEach((entry, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${idx + 1}</span> <span>Score: ${entry.score}/10</span> <span>Time: ${entry.time}s</span> <span>${entry.date}</span>`;
        leaderboardList.appendChild(li);
    });
} 