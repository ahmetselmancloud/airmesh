// AirMesh Client Application Logic

const state = {
  deviceId: 'dev_' + Math.random().toString(36).substring(2, 9),
  deviceName: localStorage.getItem('airmesh_dev_name') || getRandomDeviceName(),
  ws: null,
  files: [],
  activeUploads: {},
  isPlayingSync: false,
  viewMode: localStorage.getItem('airmesh_view_mode') || 'list',
  batchMode: false,
  selectedFiles: new Set()
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

// Gallery, Batch & Lightbox DOM Elements
const listViewBtn = document.getElementById('listViewBtn');
const galleryViewBtn = document.getElementById('galleryViewBtn');
const batchSelectModeBtn = document.getElementById('batchSelectModeBtn');
const batchBar = document.getElementById('batchBar');
const selectedCountText = document.getElementById('selectedCountText');
const downloadSelectedZipBtn = document.getElementById('downloadSelectedZipBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const cancelBatchBtn = document.getElementById('cancelBatchBtn');
const lightboxModal = document.getElementById('lightboxModal');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');

// Radar & Hotspot DOM Elements
const hotspotStatusBadge = document.getElementById('hotspotStatusBadge');
const hotspotSsidVal = document.getElementById('hotspotSsidVal');
const hotspotPassVal = document.getElementById('hotspotPassVal');
const toggleHotspotBtn = document.getElementById('toggleHotspotBtn');
const showWifiQrBtn = document.getElementById('showWifiQrBtn');
const wifiQrModal = document.getElementById('wifiQrModal');
const wifiQrModalCloseBtn = document.getElementById('wifiQrModalCloseBtn');
const wifiQrModalBackdrop = document.getElementById('wifiQrModalBackdrop');
const wifiQrImage = document.getElementById('wifiQrImage');
const wifiQrSsidText = document.getElementById('wifiQrSsidText');
const radarDeviceCountBadge = document.getElementById('radarDeviceCountBadge');
const connectedDevicesList = document.getElementById('connectedDevicesList');
const refreshRadarBtn = document.getElementById('refreshRadarBtn');

// Speedtest DOM Elements
const startSpeedTestBtn = document.getElementById('startSpeedTestBtn');
const speedTestStatusBadge = document.getElementById('speedTestStatusBadge');
const speedValText = document.getElementById('speedValText');
const speedMbpsText = document.getElementById('speedMbpsText');
const pingResultVal = document.getElementById('pingResultVal');
const downResultVal = document.getElementById('downResultVal');
const upResultVal = document.getElementById('upResultVal');
const speedGauge = document.querySelector('.speed-gauge');

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
  initWifiQrModal();
  initRadar();
  initSpeedTest();
  initPWA();
  initWebSocket();
  initGalleryAndBatch();
  initLightbox();
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
      if (btn.getAttribute('data-tab') === 'radar') {
        loadHotspotInfo();
        loadRadarDevices();
      }
    });
  });

  document.getElementById('refreshFilesBtn')?.addEventListener('click', loadFiles);
  downloadAllZipBtn?.addEventListener('click', () => {
    window.location.href = '/api/zip';
  });
  fileSearch?.addEventListener('input', filterFiles);

  document.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });
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
    case 'device_list_updated':
      state.devices = msg.devices || [];
      renderConnectedDevices(state.devices);
      deviceCountChip.textContent = `👥 ${msg.count} Cihaz`;
      if (radarDeviceCountBadge) radarDeviceCountBadge.textContent = `${msg.count} Cihaz Aktif`;
      break;
    case 'chat':
      appendChatMessage(msg.sender, msg.text, msg.senderId === state.deviceId);
      break;
    case 'file_uploaded':
      showToast(`📥 <b>${escapeHtml(msg.uploader)}</b> yeni bir dosya yükledi: <i>${escapeHtml(msg.fileName)}</i>`, 'success');
      playNotificationSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('AirMesh - Yeni Dosya', {
            body: `${msg.uploader}: ${msg.fileName}`,
            icon: '/icon-192.png'
          });
        } catch (e) {}
      }
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

function isImageFile(name) {
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif)$/i.test(name);
}

function isVideoFile(name) {
  return /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name);
}

function isAudioFile(name) {
  return /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name);
}

function getFilteredFiles() {
  const query = fileSearch?.value?.toLowerCase().trim() || '';
  if (!query) return state.files;
  return state.files.filter(f => f.name.toLowerCase().includes(query));
}

function filterFiles() {
  renderFiles(getFilteredFiles());
}

function renderFiles(files) {
  if (!files || files.length === 0) {
    filesList.classList.remove('gallery-view');
    filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Henüz paylaşılan bir dosya yok.<br>İlk dosyayı sen yükleyebilirsin!</p>
      </div>`;
    return;
  }

  if (state.viewMode === 'gallery') {
    filesList.classList.add('gallery-view');
    filesList.innerHTML = files.map(file => {
      const isImg = isImageFile(file.name);
      const isVideo = isVideoFile(file.name);
      const isAudio = isAudioFile(file.name);
      const isMedia = isVideo || isAudio;
      const isSelected = state.selectedFiles.has(file.name);
      const encodedName = encodeURIComponent(file.name);

      let thumbHtml = '';
      if (isImg) {
        thumbHtml = `
          <div class="card-thumb-wrapper" onclick="openLightbox('${encodedName}')">
            <img class="card-thumb-img" src="/api/stream?file=${encodedName}" alt="${escapeHtml(file.name)}" loading="lazy">
            <span class="card-badge">Resim</span>
          </div>`;
      } else if (isVideo) {
        thumbHtml = `
          <div class="card-thumb-wrapper" onclick="streamMedia('${encodedName}', 'video')">
            <div class="card-placeholder-icon">🎬</div>
            <span class="card-badge">Video</span>
          </div>`;
      } else if (isAudio) {
        thumbHtml = `
          <div class="card-thumb-wrapper" onclick="streamMedia('${encodedName}', 'audio')">
            <div class="card-placeholder-icon">🎵</div>
            <span class="card-badge">Ses</span>
          </div>`;
      } else {
        thumbHtml = `
          <div class="card-thumb-wrapper">
            <div class="card-placeholder-icon">${getFileIcon(file.name, file.isDir)}</div>
          </div>`;
      }

      return `
        <div class="file-card ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}">
          <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectFile('${encodedName}', this.checked)">
          ${thumbHtml}
          <div class="card-body">
            <div class="card-title" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="card-meta">${formatBytes(file.size)}</div>
            <div class="card-actions">
              ${isAudio ? `<button class="btn-icon-action" title="Odada Çal" onclick="syncPlayAudio('${encodedName}')">📻</button>` : ''}
              ${isMedia ? `<button class="btn-icon-action" title="İzle/Dinle" onclick="streamMedia('${encodedName}', '${isVideo ? 'video' : 'audio'}')">▶️</button>` : ''}
              <a class="btn-icon-action" title="İndir" href="/api/download?file=${encodedName}" download="${escapeHtml(file.name)}">⬇️</a>
              <button class="btn-icon-action" title="Sil" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}')">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    filesList.classList.remove('gallery-view');
    filesList.innerHTML = files.map(file => {
      const isVideo = isVideoFile(file.name);
      const isAudio = isAudioFile(file.name);
      const isMedia = isVideo || isAudio;
      const isImg = isImageFile(file.name);
      const fileIcon = getFileIcon(file.name, file.isDir);
      const isSelected = state.selectedFiles.has(file.name);
      const encodedName = encodeURIComponent(file.name);

      return `
        <div class="file-item ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}">
          <div class="file-info">
            <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectFile('${encodedName}', this.checked)">
            <div class="file-icon" ${isImg ? `style="cursor:pointer;" onclick="openLightbox('${encodedName}')"` : ''}>${fileIcon}</div>
            <div class="file-details">
              <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="file-meta">${formatBytes(file.size)} • ${file.modTime || ''}</div>
            </div>
          </div>
          <div class="file-actions">
            ${isAudio ? `<button class="btn-icon-action" onclick="syncPlayAudio('${encodedName}')">📻 Odada Çal</button>` : ''}
            ${isMedia ? `<button class="btn-icon-action" onclick="streamMedia('${encodedName}', '${isVideo ? 'video' : 'audio'}')">▶️ İzle</button>` : ''}
            ${isImg ? `<button class="btn-icon-action" onclick="openLightbox('${encodedName}')">👁️ Önizle</button>` : ''}
            <a class="btn-icon-action" href="/api/download?file=${encodedName}" download="${escapeHtml(file.name)}">⬇️ İndir</a>
            <button class="btn-icon-action" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Multi-Selection and Batch Operations
window.toggleSelectFile = function(encodedName, isChecked) {
  const fileName = decodeURIComponent(encodedName);
  if (isChecked) {
    state.selectedFiles.add(fileName);
  } else {
    state.selectedFiles.delete(fileName);
  }
  updateBatchUI();
};

function updateBatchUI() {
  const count = state.selectedFiles.size;
  if (selectedCountText) {
    selectedCountText.textContent = `${count} dosya seçildi`;
  }
  if (batchBar) {
    batchBar.style.display = (count > 0 || state.batchMode) ? 'flex' : 'none';
  }
  document.querySelectorAll('[data-file]').forEach(el => {
    const fn = el.getAttribute('data-file');
    const checked = state.selectedFiles.has(fn);
    el.classList.toggle('selected', checked);
    const cb = el.querySelector('input[type="checkbox"]');
    if (cb && cb.checked !== checked) cb.checked = checked;
  });
}

function initGalleryAndBatch() {
  if (state.viewMode === 'gallery') {
    galleryViewBtn?.classList.add('active');
    listViewBtn?.classList.remove('active');
  } else {
    listViewBtn?.classList.add('active');
    galleryViewBtn?.classList.remove('active');
  }

  listViewBtn?.addEventListener('click', () => {
    state.viewMode = 'list';
    localStorage.setItem('airmesh_view_mode', 'list');
    listViewBtn.classList.add('active');
    galleryViewBtn?.classList.remove('active');
    renderFiles(getFilteredFiles());
  });

  galleryViewBtn?.addEventListener('click', () => {
    state.viewMode = 'gallery';
    localStorage.setItem('airmesh_view_mode', 'gallery');
    galleryViewBtn.classList.add('active');
    listViewBtn?.classList.remove('active');
    renderFiles(getFilteredFiles());
  });

  batchSelectModeBtn?.addEventListener('click', () => {
    state.batchMode = !state.batchMode;
    batchSelectModeBtn.classList.toggle('active', state.batchMode);
    if (!state.batchMode && state.selectedFiles.size === 0) {
      batchBar.style.display = 'none';
    } else {
      batchBar.style.display = 'flex';
    }
  });

  cancelBatchBtn?.addEventListener('click', () => {
    state.selectedFiles.clear();
    state.batchMode = false;
    batchSelectModeBtn?.classList.remove('active');
    updateBatchUI();
  });

  downloadSelectedZipBtn?.addEventListener('click', () => {
    if (state.selectedFiles.size === 0) {
      showToast('Lütfen önce indirilecek dosyaları seçin', 'info');
      return;
    }
    const filesQuery = Array.from(state.selectedFiles).map(encodeURIComponent).join(',');
    window.location.href = `/api/zip?files=${filesQuery}`;
  });

  deleteSelectedBtn?.addEventListener('click', async () => {
    const count = state.selectedFiles.size;
    if (count === 0) {
      showToast('Lütfen silinecek dosyaları seçin', 'info');
      return;
    }
    if (!confirm(`Seçilen ${count} dosyayı silmek istediğinize emin misiniz?`)) return;

    try {
      const filesQuery = Array.from(state.selectedFiles).map(encodeURIComponent).join(',');
      const res = await fetch(`/api/delete?files=${filesQuery}`, { method: 'POST' });
      if (res.ok) {
        showToast(`🗑️ ${count} dosya başarıyla silindi`, 'info');
        state.selectedFiles.clear();
        state.batchMode = false;
        batchSelectModeBtn?.classList.remove('active');
        updateBatchUI();
        loadFiles();
      } else {
        showToast('Toplu silme sırasında bir hata oluştu', 'error');
      }
    } catch (e) {
      showToast('Bağlantı hatası', 'error');
    }
  });
}

// Lightbox Image Viewer
window.openLightbox = function(encodedName) {
  const fileName = decodeURIComponent(encodedName);
  if (!lightboxModal) return;
  lightboxImg.src = `/api/stream?file=${encodedName}`;
  lightboxTitle.textContent = fileName;
  lightboxDownloadBtn.href = `/api/download?file=${encodedName}`;
  lightboxDownloadBtn.setAttribute('download', fileName);
  lightboxModal.classList.add('active');
};

window.closeLightbox = function() {
  if (!lightboxModal) return;
  lightboxModal.classList.remove('active');
  setTimeout(() => {
    if (!lightboxModal.classList.contains('active')) {
      lightboxImg.src = '';
    }
  }, 200);
};

function initLightbox() {
  lightboxCloseBtn?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal?.classList.contains('active')) {
      closeLightbox();
    }
  });
}

function filterFiles() {
  renderFiles(getFilteredFiles());
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

function formatChatText(text) {
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color); text-decoration:underline; word-break:break-all;">${url}</a>`);
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function appendChatMessage(sender, text, isSelf) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${isSelf ? 'self' : ''}`;
  msgDiv.innerHTML = `
    <div class="chat-msg-header">
      <span>${escapeHtml(sender)}</span>
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="chat-msg-body">${formatChatText(text)}</div>
    <button class="chat-copy-btn" onclick="copyToClipboard('${escapeJs(text)}')">📋 Kopyala</button>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (!isSelf) playNotificationSound();
}

window.copyToClipboard = function(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Metin panoya kopyalandı!', 'info');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
};

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('📋 Metin panoya kopyalandı!', 'info');
  } catch (e) {
    prompt('Metni kopyalayın:', text);
  }
  document.body.removeChild(ta);
}

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

// File Deletion
window.deleteFile = async function(encodedName) {
  const fileName = decodeURIComponent(encodedName);
  if (!confirm(`"${fileName}" dosyasını silmek istediğinize emin misiniz?`)) return;
  try {
    const res = await fetch(`/api/delete?file=${encodedName}`, { method: 'POST' });
    if (res.ok) {
      showToast(`🗑️ "${fileName}" silindi`, 'info');
      loadFiles();
    } else {
      showToast('Hata: Dosya silinemedi', 'error');
    }
  } catch (e) {
    showToast('Bağlantı hatası', 'error');
  }
};

// Radar & Hotspot Management
function initRadar() {
  refreshRadarBtn?.addEventListener('click', loadRadarDevices);
  toggleHotspotBtn?.addEventListener('click', toggleHotspot);
  loadHotspotInfo();
  loadRadarDevices();
}

async function loadHotspotInfo() {
  try {
    const res = await fetch('/api/hotspot');
    if (!res.ok) return;
    const data = await res.json();
    state.hotspot = data;
    if (hotspotSsidVal) hotspotSsidVal.textContent = data.ssid || 'Bilinmiyor';
    if (hotspotPassVal) hotspotPassVal.textContent = data.passphrase || 'Bilinmiyor';
    if (hotspotStatusBadge) {
      hotspotStatusBadge.textContent = data.state === 'On' ? 'Aktif (Açık)' : 'Kapalı';
      hotspotStatusBadge.style.color = data.state === 'On' ? '#10b981' : '#ef4444';
    }
  } catch (e) {
    console.error('Hotspot bilgisi alınamadı:', e);
  }
}

async function toggleHotspot() {
  if (!state.hotspot) return;
  const nextAction = state.hotspot.state === 'On' ? 'stop' : 'start';
  showToast(`⚡ Hotspot ${nextAction === 'start' ? 'açılıyor...' : 'kapatılıyor...'}`, 'info');
  try {
    const res = await fetch(`/api/hotspot?action=${nextAction}`, { method: 'POST' });
    if (res.ok) {
      setTimeout(loadHotspotInfo, 1200);
    }
  } catch (e) {
    showToast('Hotspot işleminde hata oluştu', 'error');
  }
}

function initWifiQrModal() {
  showWifiQrBtn?.addEventListener('click', () => {
    wifiQrImage.src = '/api/hotspot/qr?' + Date.now();
    if (wifiQrSsidText && state.hotspot) {
      wifiQrSsidText.textContent = `Ağ: ${state.hotspot.ssid} | Şifre: ${state.hotspot.passphrase}`;
    }
    wifiQrModal.classList.add('active');
  });

  wifiQrModalCloseBtn?.addEventListener('click', () => wifiQrModal.classList.remove('active'));
  wifiQrModalBackdrop?.addEventListener('click', () => wifiQrModal.classList.remove('active'));
}

async function loadRadarDevices() {
  try {
    const res = await fetch('/api/radar');
    if (!res.ok) return;
    const list = await res.json();
    state.devices = list || [];
    renderConnectedDevices(state.devices);
  } catch (e) {
    console.error('Radar cihazları alınamadı:', e);
  }
}

function renderConnectedDevices(devices) {
  if (!connectedDevicesList) return;
  if (!devices || devices.length === 0) {
    connectedDevicesList.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <p>Şu anda odaya bağlı başka bir alıcı cihaz yok.</p>
      </div>`;
    return;
  }

  connectedDevicesList.innerHTML = devices.map(dev => {
    let icon = '📱';
    const ua = dev.userAgent || '';
    if (/Windows/i.test(ua)) icon = '💻';
    else if (/Mac/i.test(ua)) icon = '🍏';
    else if (/Android/i.test(ua)) icon = '🤖';
    else if (/iPhone|iPad/i.test(ua)) icon = '📱';

    const isSelf = dev.id === state.deviceId;

    return `
      <div class="device-card">
        <div class="device-main-info">
          <div class="device-icon-badge">${icon}</div>
          <div>
            <div class="device-name-text">${escapeHtml(dev.name)} ${isSelf ? '<span class="sub-badge" style="font-size: 10px;">Sen</span>' : ''}</div>
            <div class="device-ip-text">IP: ${escapeHtml(dev.ip)} • Giriş: ${dev.connectedAt}</div>
          </div>
        </div>
        <div class="chip" style="font-size: 11px; color: var(--accent-color);">🟢 Çevrimiçi</div>
      </div>
    `;
  }).join('');
}

// PWA Support
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker registration error:', err);
    });
  }
}

// Wi-Fi Speed Benchmark Test
function initSpeedTest() {
  startSpeedTestBtn?.addEventListener('click', runSpeedBenchmark);
}

let isSpeedTesting = false;
async function runSpeedBenchmark() {
  if (isSpeedTesting) return;
  isSpeedTesting = true;
  startSpeedTestBtn.disabled = true;
  speedGauge?.classList.add('running');
  speedTestStatusBadge.textContent = 'Ping Ölçülüyor...';
  speedTestStatusBadge.style.color = '#3b82f6';
  pingResultVal.textContent = '-- ms';
  downResultVal.textContent = '-- MB/s';
  upResultVal.textContent = '-- MB/s';

  try {
    // Step 1: Ping Test (3 samples)
    let totalPing = 0;
    for (let i = 0; i < 3; i++) {
      const pStart = performance.now();
      await fetch('/api/speedtest/ping?' + Math.random());
      totalPing += (performance.now() - pStart);
    }
    const avgPing = Math.round(totalPing / 3);
    pingResultVal.textContent = `${avgPing} ms`;

    // Step 2: Download Test (Streams 30MB)
    speedTestStatusBadge.textContent = 'İndirme Test Ediliyor...';
    speedTestStatusBadge.style.color = 'var(--accent-color)';
    const dStart = performance.now();
    const dRes = await fetch('/api/speedtest/download?size=30');
    const reader = dRes.body.getReader();
    let bytesReceived = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesReceived += value.length;
      const elapsed = (performance.now() - dStart) / 1000;
      if (elapsed > 0) {
        const currentMBs = (bytesReceived / (1024 * 1024)) / elapsed;
        speedValText.textContent = currentMBs.toFixed(1);
        speedMbpsText.textContent = `${Math.round(currentMBs * 8)} Mbps`;
      }
    }
    const dElapsed = (performance.now() - dStart) / 1000;
    const finalDownMBs = (bytesReceived / (1024 * 1024)) / dElapsed;
    downResultVal.textContent = `${finalDownMBs.toFixed(1)} MB/s`;

    // Step 3: Upload Test (10MB payload)
    speedTestStatusBadge.textContent = 'Yükleme Test Ediliyor...';
    speedTestStatusBadge.style.color = 'var(--primary-color)';
    const uploadData = new Uint8Array(10 * 1024 * 1024); // 10MB dummy buffer

    const uStart = performance.now();
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/speedtest/upload', true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const uElapsed = (performance.now() - uStart) / 1000;
          if (uElapsed > 0) {
            const currentUpMBs = (e.loaded / (1024 * 1024)) / uElapsed;
            speedValText.textContent = currentUpMBs.toFixed(1);
            speedMbpsText.textContent = `${Math.round(currentUpMBs * 8)} Mbps`;
          }
        }
      };
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error('Yükleme hatası'));
      xhr.send(uploadData);
    });

    const uElapsed = (performance.now() - uStart) / 1000;
    const finalUpMBs = (uploadData.length / (1024 * 1024)) / uElapsed;
    upResultVal.textContent = `${finalUpMBs.toFixed(1)} MB/s`;

    // Completion
    speedTestStatusBadge.textContent = 'Tamamlandı ✅';
    speedTestStatusBadge.style.color = '#10b981';
    speedValText.textContent = finalDownMBs.toFixed(1);
    speedMbpsText.textContent = `${Math.round(finalDownMBs * 8)} Mbps`;
    showToast(`⚡ Hız Testi Bitti: İndirme ${finalDownMBs.toFixed(1)} MB/s | Yükleme ${finalUpMBs.toFixed(1)} MB/s`, 'success');

  } catch (err) {
    speedTestStatusBadge.textContent = 'Hata ❌';
    speedTestStatusBadge.style.color = '#ef4444';
    showToast('Hız testi sırasında hata oluştu: ' + err.message, 'error');
  } finally {
    isSpeedTesting = false;
    startSpeedTestBtn.disabled = false;
    speedGauge?.classList.remove('running');
  }
}
