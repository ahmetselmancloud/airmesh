// AirMesh Client Application Logic

const state = {
  deviceId: 'dev_' + Math.random().toString(36).substring(2, 9),
  deviceName: localStorage.getItem('airmesh_dev_name') || getRandomDeviceName(),
  ws: null,
  currentDir: '',
  files: [],
  activeFilter: 'all',
  activeUploads: {},
  isPlayingSync: false,
  viewMode: localStorage.getItem('airmesh_view_mode') || 'list',
  batchMode: false,
  selectedFiles: new Set(),
  isAdmin: false,
  isAuth: true,
  pinEnabled: false,
  pinCode: '',
  readOnly: false,
  allowDelete: false,
  token: localStorage.getItem('airmesh_token') || ''
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
const folderInput = document.getElementById('folderInput');
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
const breadcrumbBar = document.getElementById('breadcrumbBar');
const newFolderBtn = document.getElementById('newFolderBtn');
const newFolderModal = document.getElementById('newFolderModal');
const newFolderCloseBtn = document.getElementById('newFolderCloseBtn');
const newFolderBackdrop = document.getElementById('newFolderBackdrop');
const cancelNewFolderBtn = document.getElementById('cancelNewFolderBtn');
const newFolderForm = document.getElementById('newFolderForm');
const newFolderNameInput = document.getElementById('newFolderNameInput');

// Storage & Rename DOM Elements
const storageText = document.getElementById('storageText');
const storageProgressFill = document.getElementById('storageProgressFill');
const renameModal = document.getElementById('renameModal');
const renameCloseBtn = document.getElementById('renameCloseBtn');
const renameBackdrop = document.getElementById('renameBackdrop');
const cancelRenameBtn = document.getElementById('cancelRenameBtn');
const renameForm = document.getElementById('renameForm');
const renameOldName = document.getElementById('renameOldName');
const renameCurrentLabel = document.getElementById('renameCurrentLabel');
const renameNewNameInput = document.getElementById('renameNewNameInput');

// Security & Auth DOM Elements
const securityBtn = document.getElementById('securityBtn');
const securityModal = document.getElementById('securityModal');
const securityCloseBtn = document.getElementById('securityCloseBtn');
const securityBackdrop = document.getElementById('securityBackdrop');
const secPinToggle = document.getElementById('secPinToggle');
const secPinInputGroup = document.getElementById('secPinInputGroup');
const secPinCodeInput = document.getElementById('secPinCodeInput');
const secReadOnlyToggle = document.getElementById('secReadOnlyToggle');
const secAllowDeleteToggle = document.getElementById('secAllowDeleteToggle');
const saveSecurityBtn = document.getElementById('saveSecurityBtn');
const pinModal = document.getElementById('pinModal');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinErrorMsg = document.getElementById('pinErrorMsg');

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
  initSecurity();
  initGalleryAndBatch();
  initLightbox();
  initFolderHandlers();
  initRenameHandlers();
  initFilterChips();
  checkSecurityStatus();
  loadStorageInfo();
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
  document.getElementById('openFolderBtn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/openfolder', { method: 'POST' });
      if (res.ok) {
        showToast('📂 Paylaşılan klasör bilgisayarda açıldı', 'info');
      }
    } catch (e) {
      showToast('Klasör açılamadı', 'error');
    }
  });
  downloadAllZipBtn?.addEventListener('click', () => {
    const dirQuery = state.currentDir ? `?dir=${encodeURIComponent(state.currentDir)}` : '';
    window.location.href = `/api/zip${dirQuery}`;
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
  applyTheme(saved);

  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('airmesh_theme', next);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '🌓' : '☀️';
      themeToggle.title = theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0b0f19' : '#f8fafc');
    }
  }
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
    case 'security_config_updated':
      checkSecurityStatus();
      loadFiles();
      showToast('🛡️ Oda güvenlik ayarları güncellendi', 'info');
      break;
  }
}

// Files & Navigation Handling
window.navigateToDir = function(relDir) {
  state.currentDir = relDir || '';
  state.selectedFiles.clear();
  updateBatchUI();
  loadFiles();
};

window.navigateToParentDir = function() {
  if (!state.currentDir) return;
  const parts = state.currentDir.split('/').filter(Boolean);
  parts.pop();
  window.navigateToDir(parts.join('/'));
};

function renderBreadcrumbs() {
  if (!breadcrumbBar) return;

  if (!state.currentDir) {
    breadcrumbBar.innerHTML = '<span class="breadcrumb-item active" onclick="navigateToDir(\'\')">🏠 Ana Dizin</span>';
    return;
  }

  const parts = state.currentDir.split('/').filter(Boolean);
  let html = `<span class="breadcrumb-item" onclick="navigateToDir('')">🏠 Ana Dizin</span>`;

  let accumulated = '';
  parts.forEach((part, idx) => {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    const isLast = idx === parts.length - 1;
    html += `<span class="breadcrumb-separator">/</span>`;
    if (isLast) {
      html += `<span class="breadcrumb-item active">${escapeHtml(part)}</span>`;
    } else {
      const targetDir = accumulated;
      html += `<span class="breadcrumb-item" onclick="navigateToDir('${escapeJs(targetDir)}')">${escapeHtml(part)}</span>`;
    }
  });

  breadcrumbBar.innerHTML = html;
}

async function loadStorageInfo() {
  try {
    const res = await fetch('/api/storage');
    if (!res.ok) return;
    const data = await res.json();
    if (!storageText || !storageProgressFill) return;
    const freeText = formatBytes(data.free);
    const totalText = formatBytes(data.total);
    const usedPercent = data.percentUsed ? data.percentUsed.toFixed(1) : 0;
    storageText.textContent = `${freeText} boş / ${totalText} (%${usedPercent} dolu)`;
    storageProgressFill.style.width = `${Math.min(100, usedPercent)}%`;
    if (usedPercent > 85) {
      storageProgressFill.classList.add('warning');
    } else {
      storageProgressFill.classList.remove('warning');
    }
  } catch (e) {
    console.error('Storage query error:', e);
  }
}

async function loadFiles() {
  try {
    const headers = state.token ? { 'X-AirMesh-Token': state.token } : {};
    const dirQuery = state.currentDir ? `?dir=${encodeURIComponent(state.currentDir)}` : '';
    const res = await fetch(`/api/files${dirQuery}`, { headers });
    if (res.status === 401) {
      checkSecurityStatus();
      return;
    }
    if (!res.ok) throw new Error('Dosyalar alınamadı');
    const data = await res.json();
    if (data && typeof data === 'object' && Array.isArray(data.files)) {
      state.currentDir = data.currentDir || '';
      state.files = data.files || [];
    } else if (Array.isArray(data)) {
      state.files = data;
    } else {
      state.files = [];
    }
    renderBreadcrumbs();
    updateFilterCounts();
    renderFiles(getFilteredFiles());
    loadStorageInfo();
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
  let list = state.files || [];
  if (query) {
    list = list.filter(f => f.name.toLowerCase().includes(query));
  }
  if (state.activeFilter && state.activeFilter !== 'all') {
    list = list.filter(f => {
      switch (state.activeFilter) {
        case 'folder': return f.isDir;
        case 'image': return !f.isDir && isImageFile(f.name);
        case 'video': return !f.isDir && isVideoFile(f.name);
        case 'audio': return !f.isDir && isAudioFile(f.name);
        case 'document': return !f.isDir && !isImageFile(f.name) && !isVideoFile(f.name) && !isAudioFile(f.name);
        default: return true;
      }
    });
  }
  return list.slice().sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function filterFiles() {
  renderFiles(getFilteredFiles());
}

function renderFiles(files) {
  if (!files || files.length === 0) {
    filesList.classList.remove('gallery-view');
    if (state.currentDir) {
      filesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <p>Bu klasör henüz boş.</p>
          <button class="action-btn-sm" style="margin-top: 10px;" onclick="navigateToParentDir()">⬆️ Bir Üst Dizine Çık</button>
        </div>`;
    } else {
      filesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Henüz paylaşılan bir dosya yok.<br>İlk dosyayı sen yükleyebilirsin!</p>
        </div>`;
    }
    return;
  }

  const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
  const canEdit = state.isAdmin || !state.readOnly;

  if (state.viewMode === 'gallery') {
    filesList.classList.add('gallery-view');
    filesList.innerHTML = files.map(file => {
      const isSelected = state.selectedFiles.has(file.name);
      const encodedName = encodeURIComponent(file.name);

      if (file.isDir) {
        const subPath = state.currentDir ? `${state.currentDir}/${file.name}` : file.name;
        const encodedSubPath = encodeURIComponent(subPath);
        return `
          <div class="file-card is-directory ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}" ondragover="handleFolderDragOver(event)" ondragleave="handleFolderDragLeave(event)" ondrop="handleFolderDrop(event, '${encodedName}')">
            <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleSelectFile('${encodedName}', this.checked)">
            <div class="card-thumb-wrapper" onclick="navigateToDir('${escapeJs(subPath)}')">
              <div class="card-placeholder-icon">📁</div>
              <span class="card-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">Klasör</span>
            </div>
            <div class="card-body">
              <div class="card-title" title="${escapeHtml(file.name)}" onclick="navigateToDir('${escapeJs(subPath)}')">${escapeHtml(file.name)}</div>
              <div class="card-meta">Klasör • ${file.modTime || ''}</div>
              <div class="card-actions">
                ${canEdit ? `<button class="btn-icon-action" title="Yeniden Adlandır" onclick="event.stopPropagation(); openRenameModal('${encodedName}')">✏️</button>` : ''}
                <a class="btn-icon-action" title="Klasörü ZIP Olarak İndir" href="/api/zip?dir=${encodedSubPath}">📦 ZIP</a>
                ${(state.isAdmin || state.allowDelete) ? `<button class="btn-icon-action" title="Sil" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}', true)">🗑️</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }

      const isImg = isImageFile(file.name);
      const isVideo = isVideoFile(file.name);
      const isAudio = isAudioFile(file.name);
      const isMedia = isVideo || isAudio;

      let thumbHtml = '';
      if (isImg) {
        thumbHtml = `
          <div class="card-thumb-wrapper" onclick="openLightbox('${encodedName}')">
            <img class="card-thumb-img" src="/api/stream?file=${encodedName}${dirQuery}" alt="${escapeHtml(file.name)}" loading="lazy">
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
        <div class="file-card ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}" draggable="true" ondragstart="handleFileDragStart(event, '${encodedName}')">
          <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectFile('${encodedName}', this.checked)">
          ${thumbHtml}
          <div class="card-body">
            <div class="card-title" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="card-meta">${formatBytes(file.size)}</div>
            <div class="card-actions">
              ${canEdit ? `<button class="btn-icon-action" title="Yeniden Adlandır" onclick="event.stopPropagation(); openRenameModal('${encodedName}')">✏️</button>` : ''}
              ${isAudio ? `<button class="btn-icon-action" title="Odada Çal" onclick="syncPlayAudio('${encodedName}')">📻</button>` : ''}
              ${isMedia ? `<button class="btn-icon-action" title="İzle/Dinle" onclick="streamMedia('${encodedName}', '${isVideo ? 'video' : 'audio'}')">▶️</button>` : ''}
              <a class="btn-icon-action" title="İndir" href="/api/download?file=${encodedName}${dirQuery}" download="${escapeHtml(file.name)}">⬇️</a>
              ${(state.isAdmin || state.allowDelete) ? `<button class="btn-icon-action" title="Sil" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}', false)">🗑️</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    filesList.classList.remove('gallery-view');
    filesList.innerHTML = files.map(file => {
      const isSelected = state.selectedFiles.has(file.name);
      const encodedName = encodeURIComponent(file.name);

      if (file.isDir) {
        const subPath = state.currentDir ? `${state.currentDir}/${file.name}` : file.name;
        const encodedSubPath = encodeURIComponent(subPath);
        return `
          <div class="file-item is-directory ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}" ondragover="handleFolderDragOver(event)" ondragleave="handleFolderDragLeave(event)" ondrop="handleFolderDrop(event, '${encodedName}')">
            <div class="file-info" onclick="navigateToDir('${escapeJs(subPath)}')">
              <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleSelectFile('${encodedName}', this.checked)">
              <div class="file-icon">📁</div>
              <div class="file-details">
                <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="file-meta">Klasör • ${file.modTime || ''}</div>
              </div>
            </div>
            <div class="file-actions">
              ${canEdit ? `<button class="btn-icon-action" title="Yeniden Adlandır" onclick="event.stopPropagation(); openRenameModal('${encodedName}')">✏️</button>` : ''}
              <a class="btn-icon-action" href="/api/zip?dir=${encodedSubPath}" title="Klasörü ZIP Olarak İndir">📦 ZIP</a>
              ${(state.isAdmin || state.allowDelete) ? `<button class="btn-icon-action" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}', true)">🗑️ Sil</button>` : ''}
            </div>
          </div>
        `;
      }

      const isVideo = isVideoFile(file.name);
      const isAudio = isAudioFile(file.name);
      const isMedia = isVideo || isAudio;
      const isImg = isImageFile(file.name);
      const fileIcon = getFileIcon(file.name, file.isDir);

      return `
        <div class="file-item ${isSelected ? 'selected' : ''}" data-file="${escapeHtml(file.name)}" draggable="true" ondragstart="handleFileDragStart(event, '${encodedName}')">
          <div class="file-info">
            <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectFile('${encodedName}', this.checked)">
            <div class="file-icon" ${isImg ? `style="cursor:pointer;" onclick="openLightbox('${encodedName}')"` : ''}>${fileIcon}</div>
            <div class="file-details">
              <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="file-meta">${formatBytes(file.size)} • ${file.modTime || ''}</div>
            </div>
          </div>
          <div class="file-actions">
            ${canEdit ? `<button class="btn-icon-action" title="Yeniden Adlandır" onclick="event.stopPropagation(); openRenameModal('${encodedName}')">✏️ Adlandır</button>` : ''}
            ${isAudio ? `<button class="btn-icon-action" onclick="syncPlayAudio('${encodedName}')">📻 Odada Çal</button>` : ''}
            ${isMedia ? `<button class="btn-icon-action" onclick="streamMedia('${encodedName}', '${isVideo ? 'video' : 'audio'}')">▶️ İzle</button>` : ''}
            ${isImg ? `<button class="btn-icon-action" onclick="openLightbox('${encodedName}')">👁️ Önizle</button>` : ''}
            <a class="btn-icon-action" href="/api/download?file=${encodedName}${dirQuery}" download="${escapeHtml(file.name)}">⬇️ İndir</a>
            ${(state.isAdmin || state.allowDelete) ? `<button class="btn-icon-action" style="color: var(--danger-color);" onclick="deleteFile('${encodedName}', false)">🗑️ Sil</button>` : ''}
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
  if (deleteSelectedBtn) {
    deleteSelectedBtn.style.display = (state.isAdmin || state.allowDelete) ? 'inline-block' : 'none';
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
    const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
    window.location.href = `/api/zip?files=${filesQuery}${dirQuery}`;
  });

  deleteSelectedBtn?.addEventListener('click', async () => {
    const count = state.selectedFiles.size;
    if (count === 0) {
      showToast('Lütfen silinecek dosyaları seçin', 'info');
      return;
    }
    if (!confirm(`Seçilen ${count} öğeyi silmek istediğinize emin misiniz?`)) return;

    try {
      const filesQuery = Array.from(state.selectedFiles).map(encodeURIComponent).join(',');
      const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
      const res = await fetch(`/api/delete?files=${filesQuery}${dirQuery}`, {
        method: 'POST',
        headers: state.token ? { 'X-AirMesh-Token': state.token } : {}
      });
      if (res.ok) {
        showToast(`🗑️ ${count} öğe başarıyla silindi`, 'info');
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
  const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
  lightboxImg.src = `/api/stream?file=${encodedName}${dirQuery}`;
  lightboxTitle.textContent = fileName;
  lightboxDownloadBtn.href = `/api/download?file=${encodedName}${dirQuery}`;
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
    if (e.key === 'Escape') {
      if (lightboxModal?.classList.contains('active')) closeLightbox();
      if (mediaModal?.classList.contains('active')) closeModal();
      qrModal?.classList.remove('active');
      wifiQrModal?.classList.remove('active');
      securityModal?.classList.remove('active');
      newFolderModal?.classList.remove('active');
      renameModal?.classList.remove('active');
    }
  });
}

window.syncPlayAudio = function(encodedName) {
  const fileName = decodeURIComponent(encodedName);
  const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
  const streamUrl = `/api/stream?file=${encodedName}${dirQuery}`;
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
  const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
  const streamUrl = `/api/stream?file=${fileName}${dirQuery}`;
  
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

  dropzone.addEventListener('drop', async (e) => {
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      const filesToUpload = [];
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) {
        await traverseFileTree(entries, filesToUpload);
        if (filesToUpload.length > 0) {
          handleUploadFiles(filesToUpload);
          return;
        }
      }
    }
    const files = e.dataTransfer.files;
    handleUploadFiles(files);
  });

  fileInput?.addEventListener('change', () => {
    handleUploadFiles(fileInput.files);
  });

  folderInput?.addEventListener('change', () => {
    handleUploadFiles(folderInput.files);
  });
}

async function traverseFileTree(entries, resultFiles) {
  for (const entry of entries) {
    if (entry.isFile) {
      await new Promise((resolve) => {
        entry.file(f => {
          const relPath = entry.fullPath ? entry.fullPath.replace(/^\//, '') : f.name;
          Object.defineProperty(f, 'relativePath', {
            value: relPath,
            configurable: true
          });
          resultFiles.push(f);
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = () => {
        return new Promise((resolve) => {
          const entriesBatch = [];
          const read = () => {
            dirReader.readEntries((res) => {
              if (!res.length) {
                resolve(entriesBatch);
              } else {
                entriesBatch.push(...res);
                read();
              }
            }, () => resolve(entriesBatch));
          };
          read();
        });
      };
      const subEntries = await readAllEntries();
      await traverseFileTree(subEntries, resultFiles);
    }
  }
}

function handleUploadFiles(files) {
  if (!files || files.length === 0) return;
  if (state.readOnly && !state.isAdmin) {
    showToast('🔒 Bu oda salt-okunur (read-only) modundadır. Dosya yüklenemez.', 'error');
    return;
  }
  uploadList.style.display = 'block';

  Array.from(files).forEach(file => {
    uploadSingleFile(file);
  });
}

function uploadSingleFile(file) {
  const uploadId = 'up_' + Math.random().toString(36).substring(2, 9);
  const uploadName = file.relativePath || file.webkitRelativePath || file.name;
  
  const card = document.createElement('div');
  card.className = 'upload-progress-card';
  card.id = uploadId;
  card.innerHTML = `
    <div class="progress-header">
      <span class="file-name" style="max-width: 280px;" title="${escapeHtml(uploadName)}">${escapeHtml(uploadName)}</span>
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
      speedText.textContent = xhr.status === 403 ? 'Salt-Okunur Engeli' : `Hata Kodu: ${xhr.status}`;
    }
  });

  xhr.addEventListener('error', () => {
    percentText.textContent = 'Bağlantı Hatası ❌';
    percentText.style.color = '#ef4444';
  });

  const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
  xhr.open('POST', `/api/upload?name=${encodeURIComponent(uploadName)}${dirQuery}&uploader=${encodeURIComponent(state.deviceName)}`, true);
  if (state.token) {
    xhr.setRequestHeader('X-AirMesh-Token', state.token);
  }
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

// File & Folder Deletion
window.deleteFile = async function(encodedName, isFolder = false) {
  const fileName = decodeURIComponent(encodedName);
  const typeText = isFolder ? 'klasörünü ve içindeki tüm dosyaları' : 'dosyasını';
  if (!confirm(`"${fileName}" ${typeText} silmek istediğinize emin misiniz?`)) return;
  try {
    const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
    const res = await fetch(`/api/delete?file=${encodedName}${dirQuery}`, {
      method: 'POST',
      headers: state.token ? { 'X-AirMesh-Token': state.token } : {}
    });
    if (res.ok) {
      showToast(`🗑️ "${fileName}" silindi`, 'info');
      loadFiles();
    } else {
      showToast('Hata: Silme işlemi başarısız', 'error');
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

// Room Security, PIN & Access Control
async function checkSecurityStatus() {
  try {
    const headers = state.token ? { 'X-AirMesh-Token': state.token } : {};
    const res = await fetch('/api/auth/status', { headers });
    if (!res.ok) return;
    const data = await res.json();

    state.isAdmin = data.isAdmin;
    state.isAuth = data.isAuth;
    state.pinEnabled = data.pinEnabled;
    state.readOnly = data.readOnly;
    state.allowDelete = data.allowDelete;
    if (data.pinCode) state.pinCode = data.pinCode;

    // Show/hide Admin Security Button in header
    if (securityBtn) {
      securityBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
      securityBtn.textContent = state.pinEnabled ? '🔒' : '🔓';
      securityBtn.title = state.pinEnabled ? 'Oda Kilitli (PIN Aktif)' : 'Oda Açık (PIN Pasif)';
    }

    // Handle Guest Lockscreen (PIN Modal)
    if (pinModal) {
      if (!state.isAuth && state.pinEnabled) {
        pinModal.classList.add('active');
        if (pinInput) setTimeout(() => pinInput.focus(), 150);
      } else {
        pinModal.classList.remove('active');
      }
    }

    // Adapt Upload Dropzone if Read-Only
    if (dropzone) {
      const hint = dropzone.querySelector('.upload-hint');
      const dropHeader = dropzone.querySelector('h3');
      if (state.readOnly && !state.isAdmin) {
        dropzone.style.opacity = '0.6';
        dropzone.style.cursor = 'not-allowed';
        if (dropHeader) dropHeader.textContent = '🔒 Oda Salt-Okunur (Read-Only) Modunda';
        if (hint) hint.textContent = 'Dosya yükleme oda yöneticisi tarafından kısıtlanmıştır.';
      } else {
        dropzone.style.opacity = '1';
        dropzone.style.cursor = 'pointer';
        if (dropHeader) dropHeader.textContent = 'Dosyaları Buraya Sürükle & Bırak';
        if (hint) hint.textContent = 'Sıfır internet kotası • Doğrudan diske streaming • Yüksek hız';
      }
    }

    // Re-render files with updated permissions (e.g. delete buttons visibility)
    if (state.files && state.files.length > 0) {
      renderFiles(getFilteredFiles());
    }
  } catch (e) {
    console.error('Security status check error:', e);
  }
}

window.submitPin = async function() {
  const pin = pinInput?.value?.trim();
  if (!pin) return;
  if (pinErrorMsg) pinErrorMsg.style.display = 'none';

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      state.token = data.token;
      localStorage.setItem('airmesh_token', data.token);
      pinModal?.classList.remove('active');
      showToast('✅ Odaya başarıyla giriş yapıldı!', 'success');
      await checkSecurityStatus();
      loadFiles();
    } else {
      if (pinErrorMsg) {
        pinErrorMsg.textContent = data.message || 'Hatalı PIN kodu!';
        pinErrorMsg.style.display = 'block';
      }
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  } catch (e) {
    showToast('Bağlantı hatası', 'error');
  }
};

function initSecurity() {
  // Pin Form Submit
  pinForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitPin();
  });

  // Admin Security Modal
  securityBtn?.addEventListener('click', () => {
    if (secPinToggle) secPinToggle.checked = state.pinEnabled;
    if (secPinInputGroup) secPinInputGroup.style.display = state.pinEnabled ? 'block' : 'none';
    if (secPinCodeInput) secPinCodeInput.value = state.pinCode || '';
    if (secReadOnlyToggle) secReadOnlyToggle.checked = state.readOnly;
    if (secAllowDeleteToggle) secAllowDeleteToggle.checked = state.allowDelete;
    securityModal?.classList.add('active');
  });

  securityCloseBtn?.addEventListener('click', () => securityModal?.classList.remove('active'));
  securityBackdrop?.addEventListener('click', () => securityModal?.classList.remove('active'));

  secPinToggle?.addEventListener('change', () => {
    if (secPinInputGroup) secPinInputGroup.style.display = secPinToggle.checked ? 'block' : 'none';
    if (secPinToggle.checked && secPinCodeInput && !secPinCodeInput.value) {
      secPinCodeInput.value = Math.floor(1000 + Math.random() * 9000).toString();
    }
  });

  saveSecurityBtn?.addEventListener('click', async () => {
    const pinEnabled = secPinToggle?.checked || false;
    const pinCode = secPinCodeInput?.value?.trim() || '';
    const readOnly = secReadOnlyToggle?.checked || false;
    const allowDelete = secAllowDeleteToggle?.checked || false;

    if (pinEnabled && pinCode.length < 4) {
      showToast('PIN kodu en az 4 haneli olmalıdır!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinEnabled,
          pinCode,
          readOnly,
          allowDelete
        })
      });

      if (res.ok) {
        showToast('🛡️ Güvenlik ayarları kaydedildi', 'success');
        securityModal?.classList.remove('active');
        await checkSecurityStatus();
      } else {
        showToast('Ayarlar kaydedilemedi', 'error');
      }
    } catch (e) {
      showToast('Bağlantı hatası', 'error');
    }
  });
}

// Folder Management (Mkdir & Navigation)
function initFolderHandlers() {
  function openModal() {
    if (!newFolderModal) return;
    newFolderModal.classList.add('active');
    if (newFolderNameInput) {
      newFolderNameInput.value = '';
      setTimeout(() => newFolderNameInput.focus(), 150);
    }
  }

  function closeModal() {
    if (!newFolderModal) return;
    newFolderModal.classList.remove('active');
  }

  newFolderBtn?.addEventListener('click', openModal);
  newFolderCloseBtn?.addEventListener('click', closeModal);
  newFolderBackdrop?.addEventListener('click', closeModal);
  cancelNewFolderBtn?.addEventListener('click', closeModal);

  newFolderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newFolderNameInput?.value?.trim();
    if (!name) return;

    if (/[\\/:*?"<>|]/.test(name)) {
      showToast('Klasör adında geçersiz karakterler bulunamaz (\\ / : * ? " < > |)', 'error');
      return;
    }

    try {
      const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
      const res = await fetch(`/api/mkdir?name=${encodeURIComponent(name)}${dirQuery}`, {
        method: 'POST',
        headers: state.token ? { 'X-AirMesh-Token': state.token } : {}
      });

      if (res.ok) {
        closeModal();
        showToast(`📁 "${name}" klasörü oluşturuldu`, 'success');
        loadFiles();
      } else {
        const err = await res.text();
        showToast(err || 'Klasör oluşturulamadı', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası', 'error');
    }
  });
}

// Filter Chips
function initFilterChips() {
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.getAttribute('data-filter') || 'all';
      renderFiles(getFilteredFiles());
    });
  });
}

function updateFilterCounts() {
  const files = state.files || [];
  let cAll = files.length;
  let cFolder = 0, cImage = 0, cVideo = 0, cAudio = 0, cDoc = 0;
  files.forEach(f => {
    if (f.isDir) cFolder++;
    else if (isImageFile(f.name)) cImage++;
    else if (isVideoFile(f.name)) cVideo++;
    else if (isAudioFile(f.name)) cAudio++;
    else cDoc++;
  });
  const elAll = document.getElementById('countAll');
  const elFolder = document.getElementById('countFolder');
  const elImage = document.getElementById('countImage');
  const elVideo = document.getElementById('countVideo');
  const elAudio = document.getElementById('countAudio');
  const elDoc = document.getElementById('countDocument');
  if (elAll) elAll.textContent = cAll;
  if (elFolder) elFolder.textContent = cFolder;
  if (elImage) elImage.textContent = cImage;
  if (elVideo) elVideo.textContent = cVideo;
  if (elAudio) elAudio.textContent = cAudio;
  if (elDoc) elDoc.textContent = cDoc;
}

// Rename & Move Handlers
window.openRenameModal = function(encodedName) {
  const fileName = decodeURIComponent(encodedName);
  if (!renameModal) return;
  renameOldName.value = fileName;
  renameCurrentLabel.textContent = `Mevcut İsim: ${fileName}`;
  renameNewNameInput.value = fileName;
  renameModal.classList.add('active');
  setTimeout(() => {
    renameNewNameInput.focus();
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot > 0) {
      renameNewNameInput.setSelectionRange(0, lastDot);
    } else {
      renameNewNameInput.select();
    }
  }, 150);
};

function initRenameHandlers() {
  function closeRename() {
    renameModal?.classList.remove('active');
  }
  renameCloseBtn?.addEventListener('click', closeRename);
  renameBackdrop?.addEventListener('click', closeRename);
  cancelRenameBtn?.addEventListener('click', closeRename);

  renameForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldName = renameOldName.value;
    const newName = renameNewNameInput.value.trim();
    if (!oldName || !newName || oldName === newName) {
      closeRename();
      return;
    }

    if (/[\\/:*?"<>|]/.test(newName)) {
      showToast('Dosya adında geçersiz karakterler bulunamaz (\\ / : * ? " < > |)', 'error');
      return;
    }

    try {
      const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
      const res = await fetch(`/api/rename?old=${encodeURIComponent(oldName)}&new=${encodeURIComponent(newName)}${dirQuery}`, {
        method: 'POST',
        headers: state.token ? { 'X-AirMesh-Token': state.token } : {}
      });

      if (res.ok) {
        closeRename();
        showToast(`✏️ "${oldName}" adı "${newName}" olarak güncellendi`, 'success');
        loadFiles();
      } else {
        const err = await res.text();
        showToast(err || 'İsim değiştirilemedi', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası', 'error');
    }
  });
}

// Drag & Drop Moving into Folders
window.handleFileDragStart = function(e, encodedName) {
  const fn = decodeURIComponent(encodedName);
  e.dataTransfer.setData('text/plain', fn);
  e.dataTransfer.effectAllowed = 'move';
};

window.handleFolderDragOver = function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over-folder');
};

window.handleFolderDragLeave = function(e) {
  e.currentTarget.classList.remove('drag-over-folder');
};

window.handleFolderDrop = async function(e, encodedFolder) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over-folder');

  const draggedFile = e.dataTransfer.getData('text/plain');
  const targetFolder = decodeURIComponent(encodedFolder);
  if (!draggedFile || draggedFile === targetFolder) return;

  if (state.readOnly && !state.isAdmin) {
    showToast('🔒 Salt-okunur modda dosya taşınamaz', 'error');
    return;
  }

  const newPath = `${targetFolder}/${draggedFile}`;
  try {
    const dirQuery = state.currentDir ? `&dir=${encodeURIComponent(state.currentDir)}` : '';
    const res = await fetch(`/api/rename?old=${encodeURIComponent(draggedFile)}&new=${encodeURIComponent(newPath)}${dirQuery}`, {
      method: 'POST',
      headers: state.token ? { 'X-AirMesh-Token': state.token } : {}
    });

    if (res.ok) {
      showToast(`📂 "${draggedFile}" dosyası "${targetFolder}" içine taşındı`, 'success');
      loadFiles();
    } else {
      const err = await res.text();
      showToast(err || 'Dosya taşınamadı', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası', 'error');
  }
};

