const activeDownloads = new Map();
const cancelledIds = new Set();

const STALE_TIMEOUT_MS = 10 * 60 * 1000;

function registerDownload(downloadId, data) {
  activeDownloads.set(downloadId, {
    id: downloadId,
    gameTitle: data.gameTitle || '',
    fileName: data.fileName || '',
    fileSize: data.fileSize || 0,
    bytesTransferred: 0,
    status: 'active',
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    clientIp: data.clientIp || '',
    consoleId: data.consoleId || '',
    stream: data.stream || null,
    response: data.response || null,
    external: data.external || false,
    dbDownloadId: data.dbDownloadId || null
  });
}

function updateProgress(downloadId, bytesTransferred) {
  const dl = activeDownloads.get(downloadId);
  if (dl) {
    dl.bytesTransferred = bytesTransferred;
    dl.lastUpdatedAt = new Date();
  }
}

function completeDownload(downloadId) {
  activeDownloads.delete(downloadId);
}

function isCancelled(downloadId) {
  return cancelledIds.has(downloadId);
}

function clearCancelled(downloadId) {
  cancelledIds.delete(downloadId);
}

function cancelDownload(downloadId) {
  const dl = activeDownloads.get(downloadId);
  if (dl) {
    cancelledIds.add(downloadId);
    dl.status = 'cancelled';
    if (dl.stream && typeof dl.stream.destroy === 'function') {
      dl.stream.destroy();
    }
    if (dl.response && typeof dl.response.end === 'function') {
      try { dl.response.end(); } catch (e) {}
    }
    activeDownloads.delete(downloadId);
    return true;
  }
  return false;
}

function getActiveDownloads() {
  const now = Date.now();
  const list = [];
  for (const [id, dl] of activeDownloads) {
    const elapsedMs = now - dl.startedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const speed = elapsedSeconds > 0 && dl.bytesTransferred > 0
      ? Math.round(dl.bytesTransferred / elapsedSeconds)
      : 0;

    list.push({
      id: dl.id,
      gameTitle: dl.gameTitle,
      fileName: dl.fileName,
      fileSize: dl.fileSize,
      bytesTransferred: dl.bytesTransferred,
      status: dl.status,
      startedAt: dl.startedAt,
      clientIp: dl.clientIp,
      consoleId: dl.consoleId || '',
      external: dl.external || false,
      progress: dl.fileSize > 0 ? Math.round((dl.bytesTransferred / dl.fileSize) * 100) : 0,
      elapsedSeconds: elapsedSeconds,
      speed: speed
    });
  }
  return list;
}

function getActiveCount() {
  return activeDownloads.size;
}

function findByFileAndConsole(fileId, consoleId) {
  for (const [id, dl] of activeDownloads) {
    if (dl.id === `ext_${fileId}_${consoleId}`) {
      return dl;
    }
  }
  return null;
}

function cleanupStale() {
  const now = Date.now();
  for (const [id, dl] of activeDownloads) {
    if (dl.external && (now - dl.lastUpdatedAt.getTime()) > STALE_TIMEOUT_MS) {
      activeDownloads.delete(id);
    }
  }
}

setInterval(cleanupStale, 60 * 1000);

module.exports = {
  registerDownload,
  updateProgress,
  completeDownload,
  cancelDownload,
  isCancelled,
  clearCancelled,
  getActiveDownloads,
  getActiveCount,
  findByFileAndConsole,
  cleanupStale
};
