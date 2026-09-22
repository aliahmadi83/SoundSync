// interop.js — پل بین Blazor WebAssembly و پخش‌کننده‌ی صوت

(function () {
    const DB_NAME = 'lectureSyncDb';
    const STORE = 'lectures';
    let objectUrls = [];

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE, { keyPath: 'dir' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // همه‌ی رکوردهای قبلی را پاک می‌کند و رکوردهای جدید را می‌نویسد (در یک تراکنش)
    async function replaceAll(records) {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            store.clear();
            for (const r of records) store.put(r);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        db.close();
    }

    async function getAll() {
        const db = await openDb();
        const records = await new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return records;
    }

    // رکوردها را مرتب می‌کند و برای هرکدام یک URL موقت صوتی می‌سازد
    function toItems(records) {
        objectUrls.forEach(u => URL.revokeObjectURL(u));
        objectUrls = [];

        records.sort((a, b) => a.title.localeCompare(b.title, 'fa', { numeric: true }));

        return records.map(r => {
            const url = URL.createObjectURL(r.audio);
            objectUrls.push(url);
            return { title: r.title, audioUrl: url, text: r.text };
        });
            // خواندن txt با تشخیص انکدینگ (UTF-8، UTF-16، ویندوز-۱۲۵۶)
    async function decodeText(file) {
        const buf = await file.arrayBuffer();
        const b = new Uint8Array(buf);
        if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
        if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
        let s = new TextDecoder('utf-8').decode(buf);
        if (s.includes('\uFFFD')) {
            try { s = new TextDecoder('windows-1256').decode(buf); } catch (e) { }
        }
        return s;
    }
    }

    window.lectureSync = {
        dotNetRef: null,

        // پوشه‌ی اصلی انتخاب‌شده را می‌خواند، در IndexedDB ذخیره می‌کند (جایگزین قبلی‌ها)
               readFolder: async function (inputId) {
            const input = document.getElementById(inputId);
            const files = Array.from((input && input.files) || []);

            const groups = new Map();
            for (const f of files) {
                const parts = (f.webkitRelativePath || f.name).split('/');
                if (parts.length < 2) continue;
                const dir = parts.slice(0, -1).join('/');
                if (!groups.has(dir)) groups.set(dir, { audio: null, txt: null });
                const g = groups.get(dir);
                const name = f.name.toLowerCase();
                if (/\.(mp3|m4a|wav|ogg|aac)$/.test(name) && !g.audio) g.audio = f;
                else if (name.endsWith('.txt') && !g.txt) g.txt = f;
            }

            const stats = { totalFiles: files.length, dirs: groups.size, withAudio: 0, withText: 0, sample: "" };
            const records = [];
            for (const [dir, g] of groups) {
                if (g.audio) stats.withAudio++;
                if (g.txt) stats.withText++;
                if (!g.audio || !g.txt) continue;
                const text = await decodeText(g.txt);
                if (!stats.sample) stats.sample = text.slice(0, 80);
                records.push({ dir: dir, title: dir.split('/').pop(), audio: g.audio, text: text });
            }

            // اگر چیزی پیدا نشد، لیست قبلی دست نخورد
            if (records.length === 0) {
                if (input) input.value = "";
                return { items: [], stats: stats };
            }

            try {
                if (navigator.storage && navigator.storage.persist) {
                    await navigator.storage.persist();
                }
                await replaceAll(records);
            } catch (e) {
                console.warn('ذخیره در IndexedDB ناموفق بود:', e);
            }

            if (input) input.value = "";
            return { items: toItems(records), stats: stats };
        },

            const records = [];
            for (const [dir, g] of groups) {
                if (!g.audio || !g.txt) continue;
                records.push({
                    dir: dir,
                    title: dir.split('/').pop(),
                    audio: g.audio,
                    text: await g.txt.text()
                });
            }

            // اگر چیزی پیدا نشد، لیست قبلی دست نخورد
            if (records.length === 0) {
                if (input) input.value = "";
                return [];
            }

            try {
                if (navigator.storage && navigator.storage.persist) {
                    await navigator.storage.persist();
                }
                await replaceAll(records);
            } catch (e) {
                console.warn('ذخیره در IndexedDB ناموفق بود:', e);
            }

            if (input) input.value = ""; // اجازه‌ی انتخاب دوباره‌ی همان پوشه
            return toItems(records);
        },

        // سخنرانی‌های ذخیره‌شده‌ی قبلی را برمی‌گرداند
        loadSaved: async function () {
            try {
                return toItems(await getAll());
            } catch (e) {
                console.warn('خواندن از IndexedDB ناموفق بود:', e);
                return [];
            }
        },

        setAudioSrc: function (mediaElementId, url) {
            const el = document.getElementById(mediaElementId);
            if (!el || !url) return;
            el.src = url;
            el.load();
        },

        initTimeUpdate: function (mediaElementId, dotNetRef) {
            const el = document.getElementById(mediaElementId);
            if (!el) return;
            window.lectureSync.dotNetRef = dotNetRef;
            el.addEventListener('timeupdate', () => {
                if (window.lectureSync.dotNetRef) {
                    window.lectureSync.dotNetRef.invokeMethodAsync('OnTimeUpdate', el.currentTime);
                }
            });
        },

        seekTo: function (mediaElementId, seconds, autoplay) {
            const el = document.getElementById(mediaElementId);
            if (!el) return;
            el.currentTime = seconds;
            if (autoplay) {
                el.play();
            }
        },

        scrollToActive: function () {
            const el = document.querySelector('.sentence.active');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };
})();
