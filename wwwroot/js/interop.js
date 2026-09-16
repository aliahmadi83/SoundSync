// interop.js — پل بین Blazor WebAssembly و پخش‌کننده‌ی صوت

window.lectureSync = {
    dotNetRef: null,

    // از فایل انتخاب‌شده در یک <input type=file> یک URL موقت می‌سازد
    // (برای نگه‌داشتن چند فایل صوتی هم‌زمان در حافظه، برای هر سخنرانی)
    createObjectUrl: function (inputElementId) {
        const input = document.getElementById(inputElementId);
        if (!input || !input.files || !input.files[0]) return null;
        return URL.createObjectURL(input.files[0]);
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
