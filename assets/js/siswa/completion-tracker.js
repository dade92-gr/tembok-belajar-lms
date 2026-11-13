// ============================================
// COMPLETION-TRACKER.JS
// Tracking untuk siswa: video watch, time, scroll, auto-complete
// Dipakai di unit-view.html
// ============================================

(function(global) {
  'use strict';

  // ============================================
  // YOUTUBE IFrame API LOADER
  // ============================================
  let ytApiPromise = null;

  function loadYouTubeAPI() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) { resolve(); return; }
      window.onYouTubeIframeAPIReady = () => resolve();
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
    return ytApiPromise;
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function isDriveUrl(url) {
    return url && /drive\.google\.com/.test(url);
  }

  // ============================================
  // TIME TRACKER (idle-aware)
  // ============================================
  class TimeTracker {
    constructor({ onUpdate, onComplete, thresholdSeconds = 120, idleThreshold = 30 }) {
      this.onUpdate = onUpdate;
      this.onComplete = onComplete;
      this.threshold = thresholdSeconds;
      this.idleThreshold = idleThreshold;
      this.activeSeconds = 0;
      this.lastActivityAt = Date.now();
      this.isActive = true;
      this.isRunning = false;
      this.intervalId = null;
      this.lastSaveAt = 0;
      this.completed = false;
      this._bindActivity = this._onActivity.bind(this);
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(ev => {
        document.addEventListener(ev, this._bindActivity, { passive: true });
      });
      this.intervalId = setInterval(() => this._tick(), 1000);
    }

    stop() {
      this.isRunning = false;
      if (this.intervalId) clearInterval(this.intervalId);
      ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(ev => {
        document.removeEventListener(ev, this._bindActivity);
      });
    }

    _onActivity() {
      this.lastActivityAt = Date.now();
      this.isActive = true;
    }

    _tick() {
      const idleFor = (Date.now() - this.lastActivityAt) / 1000;
      if (idleFor > this.idleThreshold) this.isActive = false;
      if (this.isActive && !document.hidden) {
        this.activeSeconds++;
        if (this.onUpdate) this.onUpdate(this.activeSeconds, this.threshold);
        // Save tiap 10 detik
        if (this.activeSeconds - this.lastSaveAt >= 10) {
          this.lastSaveAt = this.activeSeconds;
          if (this.onSave) this.onSave(this.activeSeconds);
        }
        // Cek complete
        if (!this.completed && this.activeSeconds >= this.threshold) {
          this.completed = true;
          if (this.onComplete) this.onComplete({ activeSeconds: this.activeSeconds });
        }
      }
    }

    getElapsed() { return this.activeSeconds; }
  }

  // ============================================
  // SCROLL TRACKER
  // ============================================
  class ScrollTracker {
    constructor({ container, onUpdate, onComplete, thresholdPercent = 80 }) {
      this.container = container;
      this.onUpdate = onUpdate;
      this.onComplete = onComplete;
      this.threshold = thresholdPercent;
      this.maxScrollPercent = 0;
      this.completed = false;
      this._bindScroll = this._onScroll.bind(this);
    }

    start() {
      if (!this.container) return;
      this.container.addEventListener('scroll', this._bindScroll, { passive: true });
      this._onScroll(); // cek awal
    }

    stop() {
      if (!this.container) return;
      this.container.removeEventListener('scroll', this._bindScroll);
    }

    _onScroll() {
      const el = this.container;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      const percent = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;
      if (percent > this.maxScrollPercent) {
        this.maxScrollPercent = percent;
        if (this.onUpdate) this.onUpdate(percent, this.threshold);
        if (!this.completed && percent >= this.threshold) {
          this.completed = true;
          if (this.onComplete) this.onComplete({ scrollPercent: percent });
        }
      }
    }

    getPercent() { return this.maxScrollPercent; }
  }

  // ============================================
  // VIDEO TRACKER (YouTube)
  // ============================================
  class YouTubeTracker {
    constructor({ containerId, videoId, onUpdate, onComplete, thresholdPercent = 95, onSave }) {
      this.containerId = containerId;
      this.videoId = videoId;
      this.onUpdate = onUpdate;
      this.onComplete = onComplete;
      this.onSave = onSave;
      this.threshold = thresholdPercent;
      this.player = null;
      this.watchedPositions = new Set();
      this.lastPosition = 0;
      this.lastSaveAt = 0;
      this.completed = false;
      this.duration = 0;
      this.intervalId = null;
      this.lastPlaybackRate = 1;
    }

    async init() {
      await loadYouTubeAPI();
      this.player = new YT.Player(this.containerId, {
        videoId: this.videoId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
        events: {
          'onReady': (e) => { this.duration = e.target.getDuration(); },
          'onStateChange': (e) => this._onStateChange(e),
        }
      });
      this.intervalId = setInterval(() => this._tick(), 1000);
    }

    _onStateChange(e) {
      // 1 = playing
      if (e.data === 1) {
        this._tick();
      }
      // 0 = ended
      if (e.data === 0) {
        this._checkComplete();
      }
    }

    _tick() {
      if (!this.player || typeof this.player.getCurrentTime !== 'function') return;
      const now = this.player.getCurrentTime();
      const delta = now - this.lastPosition;

      // Anti-skip: kalau lompat > 2 detik, skip
      if (delta > 0 && delta <= 2) {
        // Tandai posisi unik (pembulatan ke detik)
        for (let t = Math.floor(this.lastPosition); t < Math.floor(now); t++) {
          this.watchedPositions.add(t);
        }
      }
      this.lastPosition = now;

      // Playback rate
      try { this.lastPlaybackRate = this.player.getPlaybackRate() || 1; } catch (e) {}

      // Hitung percent unik
      const uniqueCount = this.watchedPositions.size;
      const percent = this.duration > 0 ? Math.round((uniqueCount / this.duration) * 100) : 0;

      if (this.onUpdate) this.onUpdate(percent, this.threshold, uniqueCount, this.duration);

      // Save tiap 10 detik
      if (uniqueCount - this.lastSaveAt >= 10) {
        this.lastSaveAt = uniqueCount;
        if (this.onSave) {
          this.onSave({
            watchedSeconds: uniqueCount,
            totalSeconds: this.duration,
            lastPosition: Math.floor(now),
            playbackRate: this.lastPlaybackRate,
            positionsWatched: Array.from(this.watchedPositions)
          });
        }
      }

      if (!this.completed && percent >= this.threshold) {
        this.completed = true;
        if (this.onComplete) {
          this.onComplete({
            watchedSeconds: uniqueCount,
            totalSeconds: this.duration,
            percent
          });
        }
      }
    }

    _checkComplete() {
      if (this.completed) return;
      if (this.duration > 0 && this.watchedPositions.size >= this.duration * (this.threshold / 100)) {
        this.completed = true;
        if (this.onComplete) this.onComplete({
          watchedSeconds: this.watchedPositions.size,
          totalSeconds: this.duration,
          percent: 100
        });
      }
    }

    stop() {
      if (this.intervalId) clearInterval(this.intervalId);
      if (this.player && this.player.destroy) {
        try { this.player.destroy(); } catch (e) {}
      }
    }
  }

  // ============================================
  // DRIVE TIMER TRACKER (manual duration)
  // ============================================
  class DriveTimerTracker {
    constructor({ onUpdate, onComplete, durationSeconds = 0, thresholdPercent = 95 }) {
      this.onUpdate = onUpdate;
      this.onComplete = onComplete;
      this.duration = durationSeconds;
      this.threshold = thresholdPercent;
      this.activeSeconds = 0;
      this.isActive = true;
      this.isRunning = false;
      this.lastActivityAt = Date.now();
      this.intervalId = null;
      this.completed = false;
      this.targetSeconds = durationSeconds * (thresholdPercent / 100);
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      document.addEventListener('mousemove', () => { this.lastActivityAt = Date.now(); }, { passive: true });
      document.addEventListener('keydown', () => { this.lastActivityAt = Date.now(); }, { passive: true });
      this.intervalId = setInterval(() => this._tick(), 1000);
    }

    _tick() {
      const idleFor = (Date.now() - this.lastActivityAt) / 1000;
      if (idleFor > 30) return;
      if (document.hidden) return;
      this.activeSeconds++;
      const percent = this.duration > 0 ? Math.round((this.activeSeconds / this.duration) * 100) : 0;
      if (this.onUpdate) this.onUpdate(this.activeSeconds, Math.round(this.targetSeconds), percent);
      if (!this.completed && this.activeSeconds >= this.targetSeconds) {
        this.completed = true;
        if (this.onComplete) this.onComplete({ activeSeconds: this.activeSeconds, duration: this.duration });
      }
    }

    stop() {
      if (this.intervalId) clearInterval(this.intervalId);
      this.isRunning = false;
    }
  }

  // ============================================
  // COMPOSITE TRACKER
  // ============================================
  class CompositeTracker {
    constructor({ trackers, onComplete, onUpdate }) {
      this.trackers = trackers;
      this.onComplete = onComplete;
      this.onUpdate = onUpdate;
      this.completedStates = {};
      this.completed = false;
    }

    start() {
      this.trackers.forEach(({ key, tracker }) => {
        tracker.start();
        // Override onComplete
        const origOnComplete = tracker.onComplete;
        tracker.onComplete = (data) => {
          this.completedStates[key] = true;
          if (origOnComplete) origOnComplete(data);
          if (this.onUpdate) this.onUpdate(this.completedStates);
          this._checkAllComplete();
        };
      });
    }

    _checkAllComplete() {
      if (this.completed) return;
      const allDone = this.trackers.every(({ key }) => this.completedStates[key]);
      if (allDone) {
        this.completed = true;
        if (this.onComplete) this.onComplete(this.completedStates);
      }
    }

    stop() {
      this.trackers.forEach(({ tracker }) => tracker.stop());
    }
  }

  // ============================================
  // EXPORT
  // ============================================
  global.CompletionTracker = {
    loadYouTubeAPI,
    extractYouTubeId,
    isDriveUrl,
    TimeTracker,
    ScrollTracker,
    YouTubeTracker,
    DriveTimerTracker,
    CompositeTracker
  };

  console.log('[completion-tracker] Loaded');

})(window);