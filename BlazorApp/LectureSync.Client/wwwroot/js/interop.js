// interop.js — پل بین Blazor WebAssembly و پخش‌کننده‌ی صوت

window.lectureSync = {
    dotNetRef: null,

    // از فایل انتخاب‌شده در یک <input type=file> یک URL موقت می‌سازد
    // (برای نگه‌داشتن چند فایل صوتی هم‌زمان در حافظه، برای هر سخنرانی)
    createObjectUrl: function (inputElementId) {
        const input = document.getElementById(inputElementId);
        if (!input || !input.files || !input.files[0]) return null;
        return URL.createObjectURL(input.files[0]);


        readFolder: async (inputId) => {
    const input = document.getElementById(inputId);
    const files = Array.from(input.files || []);

    // گروه‌بندی فایل‌ها بر اساس پوشه
    const groups = new Map();
    for (const f of files) {
        const parts = (f.webkitRelativePath || f.name).split('/');
        if (parts.length < 2) continue;
        const dir = parts.slice(0, -1).join('/');
        if (!groups.has(dir)) groups.set(dir, { audio: null, txt: null });
        const g = groups.get(dir);
        const name = f.name.toLowerCase();
        if (name.endsWith('.mp3') && !g.audio) g.audio = f;
        else if (name.endsWith('.txt') && !g.txt) g.txt = f;
    }

    const result = [];
    for (const [dir, g] of groups) {
        if (!g.audio || !g.txt) continue;
        result.push({
            title: dir.split('/').pop(),
            audioUrl: URL.createObjectURL(g.audio),
            text: await g.txt.text()
        });
    }

    // مرتب‌سازی طبیعی (سخنرانی 2 قبل از سخنرانی 10)
    result.sort((a, b) => a.title.localeCompare(b.title, 'fa', { numeric: true }));

    input.value = ""; // اجازه‌ی انتخاب دوباره‌ی همان پوشه
    return result;
},
    },

    // آدرس صوتی سخنرانی‌ی انتخاب‌شده از لیست را به پخش‌کننده وصل می‌کند
    setAudioSrc: function (mediaElementId, url) {
        const el = document.getElementById(mediaElementId);
        if (!el || !url) return;
        el.src = url;
        el.load();
    },

    // شنونده‌ی رویداد timeupdate را (فقط یک‌بار) وصل می‌کند تا هر بار زمان پخش تغییر کرد،
    // متد OnTimeUpdate در سمت C# صدا زده شود
    initTimeUpdate: function (mediaElementId, dotNetRef) {
        const el = document.getElementById(mediaElementId);
        if (!el) return;
        this.dotNetRef = dotNetRef;
        el.addEventListener('timeupdate', () => {
            if (this.dotNetRef) {
                this.dotNetRef.invokeMethodAsync('OnTimeUpdate', el.currentTime);
            }
        });
    },

    // با کلیک روی یک بخش از متن: پخش‌کننده را به ابتدای آن بخش می‌برد.
    // اگر autoplay=true باشد، پخش ادامه پیدا می‌کند (متوقف نمی‌شود).
    seekTo: function (mediaElementId, seconds, autoplay) {
        const el = document.getElementById(mediaElementId);
        if (!el) return;
        el.currentTime = seconds;
        if (autoplay) {
            el.play();
        }
    },

    // بخش فعال را به‌آرامی در دید کاربر قرار می‌دهد
    scrollToActive: function () {
        const el = document.querySelector('.sentence.active');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};
