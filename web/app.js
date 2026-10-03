// AirMesh Client Application Logic

const state = {
  deviceId: 'dev_' + Math.random().toString(36).substring(2, 9),
  deviceName: localStorage.getItem('airmesh_dev_name') || getRandomDeviceName(),
  ws: null,
  files: [],
  activeUploads: {},
  isPlayingSync: false
};

function getRandomDeviceName() {
  const ua = navigator.userAgent;
  let name = 'Misafir Cihaz';
  if (/iPhone/i.test(ua)) name = 'iPhone';
  else if (/iPad/i.test(ua)) name = 'iPad';
  else if (/Android/i.test(ua)) name = 'Android Cihaz';
  else if (/Windows/i.test(ua)) name = 'Windows PC';
  else if (/Mac/i.test(ua)) name = 'MacBook';
  name += ' #' + Math.floor(100 + Math.random() * 900);
  localStorage.setItem('airmesh_dev_name', name);
  return name;
}

// DOM Elements
const connStatus = document.getElementById('connStatus');
const deviceCountChip = document.getElementById('deviceCountChip');
const filesList = document.getElementById('filesList');
const fileSearch = document.getElementById('fileSearch');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('uploadList');
const uploadItems = document.getElementById('uploadItems');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const mediaModal = document.getElementById('mediaModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalMediaBody = document.getElementById('modalMediaBody');
const modalMediaTitle = document.getElementById('modalMediaTitle');
const themeToggle = document.getElementById('themeToggle');
const showQrBtn = document.getElementById('showQrBtn');
const qrModal = document.getElementById('qrModal');
const qrModalCloseBtn = document.getElementById('qrModalCloseBtn');
const qrModalBackdrop = document.getElementById('qrModalBackdrop');
const qrImage = document.getElementById('qrImage');
const qrUrlText = document.getElementById('qrUrlText');
const downloadAllZipBtn = document.getElementById('downloadAllZipBtn');
const toastContainer = document.getElementById('toastContainer');

// Toast Notification System
function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initTheme();
  initQrModal();
  initWebSocket();
  loadFiles();
  initUploadHandlers();
  initChat();
  initSyncPlay();
});

// Tab Navigation
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab-' + btn.getAttribute('data-tab');
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  document.getElementById('refreshFilesBtn')?.addEventListener('click', loadFiles);
  downloadAllZipBtn?.addEventListener('click', () => {
    window.location.href = '/api/zip';
  });
  fileSearch?.addEventListener('input', filterFiles);
}

// QR Code Modal
function initQrModal() {
  showQrBtn?.addEventListener('click', () => {
    const currentUrl = window.location.origin;
    qrImage.src = `/api/qr?text=${encodeURIComponent(currentUrl)}`;
    qrUrlText.textContent = currentUrl;
    qrModal.classList.add('active');
  });

  qrModalCloseBtn?.addEventListener('click', () => qrModal.classList.remove('active'));
  qrModalBackdrop?.addEventListener('click', () => qrModal.classList.remove('active'));
}

// Theme Toggle
function initTheme() {
  const saved = localStorage.getItem('airmesh_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('airmesh_theme', next);
  });
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?id=${state.deviceId}&name=${encodeURIComponent(state.deviceName)}`;
  
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    connStatus.textContent = 'Bağlı (5 GHz)';
    connStatus.style.color = '#10b981';
  };

  state.ws.onclose = () => {
    connStatus.textContent = 'Bağlantı Kesildi';
    connStatus.style.color = '#ef4444';
    setTimeout(initWebSocket, 2500);
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (e) {
      console.error('WS Parse Error:', e);
    }
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'device_count':
      deviceCountChip.textContent = `👥 ${msg.count} Cihaz`;
      break;
    case 'chat':
      appendChatMessage(msg.sender, msg.text, msg.senderId === state.deviceId);
      break;
    case 'file_uploaded':
      showToast(`📥 <b>${escapeHtml(msg.uploader)}</b> yeni bir dosya yükledi: <i>${escapeHtml(msg.fileName)}</i>`, 'success');
      break;
    case 'file_list_updated':
      loadFiles();
      break;
    case 'sync_play_track':
      setupSyncTrack(msg.url, msg.title);
      showToast(`🎵 Odada yeni bir şarkı seçildi: <b>${escapeHtml(msg.title)}</b>`, 'info');
      break;
    case 'sync_play':
      handleSyncPlayAction(msg);
      break;
  }
}

// Files Handling
async function loadFiles() {
  try {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error('Dosyalar alınamadı');
    state.files = await res.json();
    renderFiles(state.files);
  } catch (err) {
    filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Dosyalar listelenirken hata oluştu: ${err.message}</p>
      </div>`;
  }
}

function renderFiles(files) {
  if (!files || files.length === 0) {
    filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Henüz paylaşılan bir dosya yok.<br>İlk dosyayı sen yükleyebilirsin!</p>
      </div>`;
    return;
  }

  filesList.innerHTML = files.map(file => {
    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const isAudio = /\.(mp3|wav|ogg|flac|m4a)$/i.test(file.name);
    const isMedia = isVideo || isAudio;
    const fileIcon = getFileIcon(file.name, file.isDir);

    return `
      <div class="file-item">
        <div class="file-info">
          <div class="file-icon">${fileIcon}</div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="file-meta">${formatBytes(file.size)} • ${file.modTime || ''}</div>
          </div>
        </div>
        <div class="file-actions">
          ${isAudio ? `<button class="btn-icon-action" onclick="syncPlayAudio('${encodeURIComponent(file.name)}')">📻 Odada Çal</button>` : ''}
          ${isMedia ? `<button class="btn-icon-action" onclick="streamMedia('${encodeURIComponent(file.name)}', '${isVideo ? 'video' : 'audio'}')">▶️ İzle</button>` : ''}
          <a class="btn-icon-action" href="/api/download?file=${encodeURIComponent(file.name)}" download="${escapeHtml(file.name)}">⬇️ İndir</a>
        </div>
      </div>
    `;
  }).join('');
}

window.syncPlayAudio = function(encodedName) {
  const fileName = decodeURIComponent(encodedName);
  const streamUrl = `/api/stream?file=${encodedName}`;
  setupSyncTrack(streamUrl, fileName);
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: 'sync_play_track',
      url: streamUrl,
      title: fileName
    }));
  }
  document.querySelector('.tab-btn[data-tab="syncplay"]')?.click();
  showToast(`🎵 "${fileName}" şarkısı odadaki tüm cihazlar için yüklendi!`, 'success');
};

function setupSyncTrack(url, title) {
  const player = document.getElementById('syncAudioPlayer');
  const titleEl = document.getElementById('syncTrackTitle');
  if (player && url) {
    player.src = url;
  }
  if (titleEl && title) {
    titleEl.textContent = title;
  }
}

function filterFiles() {
  const query = fileSearch.value.toLowerCase().trim();
  if (!query) {
    renderFiles(state.files);
    return;
  }
  const filtered = state.files.filter(f => f.name.toLowerCase().includes(query));
  renderFiles(filtered);
}

function getFileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'mp4': case 'mkv': case 'mov': case 'webm': return '🎬';
    case 'mp3': case 'wav': case 'flac': case 'ogg': return '🎵';
    case 'jpg': case 'jpeg': case 'png': case 'webp': case 'gif': return '🖼️';
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '📦';
    case 'pdf': return '📕';
    case 'apk': return '📱';
    case 'exe': case 'msi': return '💾';
    default: return '📄';
  }
}

// Media Streaming Preview
window.streamMedia = function(fileName, type) {
  modalMediaTitle.textContent = decodeURIComponent(fileName);
  const streamUrl = `/api/stream?file=${fileName}`;
  
  if (type === 'video') {
    modalMediaBody.innerHTML = `<video src="${streamUrl}" controls autoplay playsinline style="max-height: 70vh;"></video>`;
  } else {
    modalMediaBody.innerHTML = `<audio src="${streamUrl}" controls autoplay style="width: 100%; margin: 20px 0;"></audio>`;
  }
  
  mediaModal.classList.add('active');
};

modalCloseBtn?.addEventListener('click', closeModal);
document.getElementById('modalBackdrop')?.addEventListener('click', closeModal);

function closeModal() {
  mediaModal.classList.remove('active');
  modalMediaBody.innerHTML = '';
}

// Upload Handling (Streaming directly to Host Disk)
function initUploadHandlers() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleUploadFiles(files);
  });

  fileInput.addEventListener('change', () => {
    handleUploadFiles(fileInput.files);
  });
}

function handleUploadFiles(files) {
  if (!files || files.length === 0) return;
  uploadList.style.display = 'block';

  Array.from(files).forEach(file => {
    uploadSingleFile(file);
  });
}

function uploadSingleFile(file) {
  const uploadId = 'up_' + Math.random().toString(36).substring(2, 9);
  
  const card = document.createElement('div');
  card.className = 'upload-progress-card';
  card.id = uploadId;
  card.innerHTML = `
    <div class="progress-header">
      <span class="file-name" style="max-width: 280px;">${escapeHtml(file.name)}</span>
      <span class="upload-percent">0%</span>
    </div>
    <div class="progress-bar-bg">
      <div class="progress-bar-fill"></div>
    </div>
    <div class="progress-footer">
      <span class="upload-speed">Başlatılıyor...</span>
      <span class="upload-transferred">0 / ${formatBytes(file.size)}</span>
    </div>
  `;
  uploadItems.prepend(card);

  const fill = card.querySelector('.progress-bar-fill');
  const percentText = card.querySelector('.upload-percent');
  const speedText = card.querySelector('.upload-speed');
  const transText = card.querySelector('.upload-transferred');

  const xhr = new XMLHttpRequest();
  let startTime = Date.now();
  let lastLoaded = 0;
  let lastTime = startTime;

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      fill.style.width = percent + '%';
      percentText.textContent = percent + '%';
      transText.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;

      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      if (timeDiff >= 0.5) {
        const bytesDiff = e.loaded - lastLoaded;
        const speed = bytesDiff / timeDiff; // Bytes/sec
        speedText.textContent = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
        lastLoaded = e.loaded;
        lastTime = now;
      }
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      percentText.textContent = 'Tamamlandı ✅';
      percentText.style.color = '#10b981';
      fill.style.width = '100%';
      fill.style.background = '#10b981';
      speedText.textContent = 'Bitti';
      loadFiles();
    } else {
      percentText.textContent = 'Hata ❌';
      percentText.style.color = '#ef4444';
      speedText.textContent = `Hata Kodu: ${xhr.status}`;
    }
  });

  xhr.addEventListener('error', () => {
    percentText.textContent = 'Bağlantı Hatası ❌';
    percentText.style.color = '#ef4444';
  });

  xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}&uploader=${encodeURIComponent(state.deviceName)}`, true);
  xhr.send(file);
}

// Chat & Clipboard
function initChat() {
  sendChatBtn?.addEventListener('click', sendChatMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  const msg = {
    type: 'chat',
    sender: state.deviceName,
    senderId: state.deviceId,
    text: text
  };

  state.ws.send(JSON.stringify(msg));
  chatInput.value = '';
}

function appendChatMessage(sender, text, isSelf) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${isSelf ? 'self' : ''}`;
  msgDiv.innerHTML = `
    <div class="chat-msg-header">
      <span>${escapeHtml(sender)}</span>
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="chat-msg-body">${escapeHtml(text)}</div>
    <button class="chat-copy-btn" onclick="copyToClipboard('${escapeJs(text)}')">📋 Kopyala</button>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Metin panoya kopyalandı!');
  }).catch(() => {
    prompt('Metni kopyalayın:', text);
  });
};

// Sync Play
function initSyncPlay() {
  const syncBtn = document.getElementById('syncPlayBtn');
  const disc = document.getElementById('musicDisc');
  const player = document.getElementById('syncAudioPlayer');
  const progressWrap = document.getElementById('audioProgressWrap');
  const progressFill = document.getElementById('audioProgressFill');
  const curTimeEl = document.getElementById('currentTime');
  const totTimeEl = document.getElementById('totalTime');

  player.addEventListener('timeupdate', () => {
    if (player.duration) {
      const pct = (player.currentTime / player.duration) * 100;
      progressFill.style.width = pct + '%';
      curTimeEl.textContent = formatTime(player.currentTime);
      totTimeEl.textContent = formatTime(player.duration);
    }
  });

  player.addEventListener('play', () => {
    state.isPlayingSync = true;
    disc.classList.add('playing');
    syncBtn.textContent = '⏸️';
  });

  player.addEventListener('pause', () => {
    state.isPlayingSync = false;
    disc.classList.remove('playing');
    syncBtn.textContent = '▶️';
  });

  progressWrap?.addEventListener('click', (e) => {
    const rect = progressWrap.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (player.duration) {
      const seekTime = pos * player.duration;
      player.currentTime = seekTime;
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          type: 'sync_play',
          action: state.isPlayingSync ? 'play' : 'pause',
          time: seekTime
        }));
      }
    }
  });

  syncBtn?.addEventListener('click', () => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const action = state.isPlayingSync ? 'pause' : 'play';
    state.ws.send(JSON.stringify({
      type: 'sync_play',
      action: action,
      time: player.currentTime
    }));
  });
}

function formatTime(sec) {
  if (isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function handleSyncPlayAction(msg) {
  const disc = document.getElementById('musicDisc');
  const player = document.getElementById('syncAudioPlayer');
  const syncBtn = document.getElementById('syncPlayBtn');

  if (msg.action === 'play') {
    state.isPlayingSync = true;
    disc.classList.add('playing');
    syncBtn.textContent = '⏸️';
    if (msg.url && player.src !== msg.url) player.src = msg.url;
    if (typeof msg.time === 'number') player.currentTime = msg.time;
    player.play().catch(e => console.log('Autoplay policy waiting user interaction', e));
  } else if (msg.action === 'pause') {
    state.isPlayingSync = false;
    disc.classList.remove('playing');
    syncBtn.textContent = '▶️';
    player.pause();
  }
}

// Helpers
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
