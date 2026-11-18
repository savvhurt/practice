const now_playing    = document.querySelector('.now-playing');
const track_art      = document.querySelector('.track-art');
const track_name     = document.querySelector('.track-name');
const track_artist   = document.querySelector('.track-artist');
const playpause_btn  = document.querySelector('.playpause-track');
const next_btn       = document.querySelector('.next-track');
const prev_btn       = document.querySelector('.prev-track');
const seek_slider    = document.querySelector('.seek_slider');
const volume_slider  = document.querySelector('.volume_slider');
const curr_time      = document.querySelector('.current-time');
const total_duration = document.querySelector('.total-duration');

let track_list   = [];
let track_index  = 0;
let isPlaying    = false;
let updateTimer  = null;

const curr_track = document.createElement('audio');

// выгрузка треков с сервера
async function fetchTracks() {
  const res = await fetch('/tracks');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.map(t => ({
    id:     t.id,
    name:   t.name,
    artist: t.artist,
    image:  t.image_url,
    path:   t.audio_url,
  }));
}

// фон
function random_bg_color() {
  const r = Math.floor(Math.random() * 256) + 64;
  const g = Math.floor(Math.random() * 256) + 64;
  const b = Math.floor(Math.random() * 256) + 64;
  document.body.style.background = `rgb(${r},${g},${b})`;
}

// загрузка трека
function loadTrack(index) {
  clearInterval(updateTimer);
  resetValues();

  const t = track_list[index];
  curr_track.src = t.path;
  curr_track.load();

  track_art.style.backgroundImage = `url(${t.image})`;
  track_name.textContent   = t.name;
  track_artist.textContent = t.artist;
  now_playing.textContent  = `PLAYING ${index + 1} OF ${track_list.length}`;

  updateTimer = setInterval(seekUpdate, 500);
  random_bg_color();

  // загружаем отзывы для текущего трека
  loadReviews(t.id);
}

function resetValues() {
  curr_time.textContent      = '00:00';
  total_duration.textContent = '00:00';
  seek_slider.value          = 0;
}

// функция проигрыша трека и паузы
function playpauseTrack() {
  isPlaying ? pauseTrack() : playTrack();
}

async function playTrack() {
  try {
    await curr_track.play();
    isPlaying = true;
    playpause_btn.innerHTML = '<i class="fa fa-pause-circle fa-5x"></i>';
  } catch (err) {
    console.warn('Playback blocked:', err);
  }
}

function pauseTrack() {
  curr_track.pause();
  isPlaying = false;
  playpause_btn.innerHTML = '<i class="fa fa-play-circle fa-5x"></i>';
}

// следующий трек / предыдущий трек
function nextTrack() {
  track_index = (track_index + 1) % track_list.length;
  loadTrack(track_index);
  playTrack();
}

function prevTrack() {
  track_index = (track_index - 1 + track_list.length) % track_list.length;
  loadTrack(track_index);
  playTrack();
}

// слайдеры
function seekTo() {
  if (!curr_track.duration) return;
  curr_track.currentTime = curr_track.duration * (seek_slider.value / 100);
}

function setVolume() {
  curr_track.volume = volume_slider.value / 100;
}

function seekUpdate() {
  if (isNaN(curr_track.duration) || !curr_track.duration) return;

  seek_slider.value = curr_track.currentTime * (100 / curr_track.duration);

  const fmt = s => String(Math.floor(s)).padStart(2, '0');
  const curMin = fmt(curr_track.currentTime / 60);
  const curSec = fmt(curr_track.currentTime % 60);
  const durMin = fmt(curr_track.duration / 60);
  const durSec = fmt(curr_track.duration % 60);

  curr_time.textContent      = `${curMin}:${curSec}`;
  total_duration.textContent = `${durMin}:${durSec}`;
}

// регистрация
async function doRegister() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const r = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!r.ok) {
    const data = await r.json();
    alert(data.error);
    return;
  }
  alert('Зарегистрирован! Теперь войди.');
}

// вход
async function doLogin() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const r = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!r.ok) {
    const data = await r.json();
    alert(data.error);
    return;
  }
  const user = await r.json();
  document.getElementById('auth-status').textContent = '👤 ' + user.username;
  document.getElementById('logout-btn').style.display = 'inline-block';
}

// выход
async function doLogout() {
  document.getElementById('auth-status').textContent = 'Гость';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  try {
    await fetch('/logout', { method: 'POST' });
  } catch (err) {
    console.error('Ошибка при выходе:', err);
  }
}

// функция для отрисовки отзывов
async function loadReviews(trackId) {
  const container = document.getElementById('reviews-list');
  const r = await fetch('/reviews/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId })
  });
  if (!r.ok) {
    container.innerHTML = '<p class="reviews-empty">Ошибка загрузки отзывов</p>';
    return;
  }
  const list = await r.json();
  if (list.length === 0) {
    container.innerHTML = '<p class="reviews-empty">Пока отзывов нет.</p>';
    return;
  }
  // контейнер для вырисовки отзывов
  container.innerHTML = list.map(item => `
    <div class="review-item">
      <div class="review-meta">
        <b>${item.username}</b> · ${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}
      </div>
      <div class="review-text">${item.text}</div>
    </div>
  `).join('');
}

// функция отправки отзыва
async function submitReview() {
  const trackId = track_list[track_index].id;
  const text    = document.getElementById('review-text').value;
  const rating  = Number(document.getElementById('review-rating').value);
  if (!text.trim()) {
    alert('Введите текст отзыва');
    return;
  }
  const r = await fetch('/reviews/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId, text: text, rating: rating })
  });
  if (!r.ok) {
    const data = await r.json();
    alert(data.error);
    return;
  }
  document.getElementById('review-text').value = '';
  loadReviews(trackId);
}

// проверка сессии для работы функции отзывов
(async () => {
  const r = await fetch('/me');
  if (r.ok) {
    const me = await r.json();
    document.getElementById('auth-status').textContent = '👤 ' + me.username;
  }
})();

// инициализация плеера
(async function init() {
  try {
    track_list = await fetchTracks();

    if (track_list.length === 0) {
      now_playing.textContent  = 'NO TRACKS';
      track_name.textContent   = '-';
      track_artist.textContent = 'Добавьте треки в БД';
      return;
    }

    curr_track.volume = volume_slider.value / 100;
    curr_track.addEventListener('ended', nextTrack);

    loadTrack(track_index);
  } catch (err) {
    console.error(err);
    now_playing.textContent  = 'ОШИБКА ЗАГРУЗКИ';
    track_name.textContent   = 'Backend недоступен';
    track_artist.textContent = 'Запустите nodemon server.js';
  }
})();