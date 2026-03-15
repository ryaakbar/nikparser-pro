// ============================================
// NIK PARSER PRO — SCRIPT
// by ryaakbar
// ============================================

let currentResult = null;
let currentNik    = '';
let history       = JSON.parse(localStorage.getItem('nik_history') || '[]');
let toastTimer    = null;

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const navbar = document.getElementById('navbar');
    const scrollBtns = document.getElementById('scrollBtns');
    window.addEventListener('scroll', () => {
        const s = window.scrollY > 20;
        navbar?.classList.toggle('scrolled', s);
        scrollBtns?.classList.toggle('visible', s);
    });

    renderHistory();
});

// ── NIK INPUT ─────────────────────────────
function onNikInput(input) {
    // Hanya angka
    input.value = input.value.replace(/\D/g, '').slice(0, 16);
    const len = input.value.length;

    // Badge counter
    const badge = document.getElementById('nikLenBadge');
    badge.textContent = `${len}/16`;
    badge.classList.toggle('done', len === 16);

    // Clear btn
    document.getElementById('nikClearBtn').classList.toggle('show', len > 0);

    // Update segment visual
    updateSegments(input.value);
}

function updateSegments(nik) {
    const parts = {
        prov: nik.slice(0, 2)   || '--',
        kota: nik.slice(0, 4)   || '----',
        kec:  nik.slice(0, 6)   || '------',
        tgl:  nik.slice(6, 12)  || '------',
        seq:  nik.slice(12, 16) || '----',
    };

    for (const [key, val] of Object.entries(parts)) {
        const el = document.getElementById('segval-' + key);
        const seg = document.getElementById('seg-' + key);
        if (el) {
            const filled = val.replace(/-/g, '').length > 0;
            el.textContent = val;
            seg.classList.toggle('active', filled);
        }
    }
}

function clearNik() {
    const input = document.getElementById('nikInput');
    input.value = '';
    onNikInput(input);
    input.focus();
}

// ── PARSE NIK ─────────────────────────────
async function parseNik() {
    const nik = document.getElementById('nikInput').value.trim();

    if (!nik) {
        showToast('⚠️ Masukkan NIK dulu bro!', 'error');
        document.getElementById('nikInput').focus();
        return;
    }
    if (!/^\d{16}$/.test(nik)) {
        showToast('⚠️ NIK harus tepat 16 digit angka!', 'error');
        return;
    }

    setLoading(true);
    hideResult();
    hideError();

    try {
        const res = await fetch(`/api/parse?nik=${nik}`);
        const ct  = res.headers.get('content-type') || '';

        if (!ct.includes('application/json')) {
            throw new Error(`Server error HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

        currentResult = data;
        currentNik    = nik;

        renderResult(data, nik);
        addToHistory(nik, data);
        setLoading(false);
        showToast('✅ NIK berhasil diurai!', 'success');

        setTimeout(() => {
            document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);

    } catch (err) {
        setLoading(false);
        showError(err.message);
        showToast('❌ ' + err.message, 'error');
    }
}

// ── RENDER RESULT ─────────────────────────
function renderResult(data, nik) {
    // Header NIK display dengan spasi tiap 4 digit
    document.getElementById('resultNikDisplay').textContent =
        nik.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');

    // NIK Breakdown visual
    renderBreakdown(nik);

    // Info grid
    renderInfoGrid(data, nik);

    document.getElementById('resultCard').classList.remove('hidden');
}

function renderBreakdown(nik) {
    const segments = [
        { digits: nik.slice(0,2),   cls: 'prov', label: 'Prov' },
        { digits: nik.slice(2,4),   cls: 'kota', label: 'Kota' },
        { digits: nik.slice(4,6),   cls: 'kec',  label: 'Kec'  },
        { digits: nik.slice(6,8),   cls: 'tgl',  label: 'DD'   },
        { digits: nik.slice(8,10),  cls: 'tgl',  label: 'MM'   },
        { digits: nik.slice(10,12), cls: 'tgl',  label: 'YY'   },
        { digits: nik.slice(12,16), cls: 'seq',  label: 'Urut' },
    ];

    const row = document.getElementById('breakdownRow');
    row.innerHTML = segments.map(seg => `
        <div class="breakdown-seg ${seg.cls}">
            ${seg.digits.split('').map(d => `<div class="breakdown-digit">${d}</div>`).join('')}
            <div class="breakdown-seg-label">${seg.label}</div>
        </div>
    `).join('');
}

function renderInfoGrid(data, nik) {
    const grid = document.getElementById('infoGrid');
    // Data bisa dari API eksternal atau local parser
    const d = data?.data || data?.result || data || {};

    const isP = (d.jenisKelamin || '').includes('PEREMPUAN') ||
                (d.jenisKelamin || '').includes('Perempuan');

    const genderLabel = isP
        ? `<span class="gender-badge gender-f">♀ Perempuan</span>`
        : `<span class="gender-badge gender-m">♂ Laki-laki</span>`;

    // Kota & kecamatan hanya tampil kalau ada di database
    const kotaVal = d.kota && !d.kota.includes('Tidak ada') ? d.kota : null;
    const kecVal  = d.kecamatan && !d.kecamatan.includes('Tidak ada') ? d.kecamatan : null;

    const items = [
        { key: 'Provinsi',         icon: 'fa-map',            val: d.provinsi || '-' },
        ...(kotaVal ? [{ key: 'Kabupaten/Kota', icon: 'fa-city',         val: kotaVal }] : []),
        ...(kecVal  ? [{ key: 'Kecamatan',      icon: 'fa-location-dot', val: kecVal  }] : []),
        { key: 'Kode Wilayah',     icon: 'fa-code',           val: d.kodeWilayah || nik.slice(0,6), mono: true },
        { key: 'Jenis Kelamin',    icon: 'fa-venus-mars',     val: genderLabel, raw: true },
        { key: 'Tanggal Lahir',    icon: 'fa-cake-candles',   val: d.tanggalLahir || '-', highlight: true },
        { key: 'Hari Lahir',       icon: 'fa-calendar-day',   val: d.hariLahir  || '-' },
        { key: 'Zodiak',           icon: 'fa-star',           val: d.zodiak     || '-' },
        { key: 'Umur',             icon: 'fa-hourglass-half', val: d.umur       || '-', highlight: true },
        { key: 'Ultah Berikutnya', icon: 'fa-gift',           val: d.ultahBerikutnya || '-' },
        { key: 'Nomor Urut',       icon: 'fa-list-ol',        val: d.nomorUrut  || nik.slice(12,16) },
        { key: 'NIK Lengkap',      icon: 'fa-id-card',        val: nik.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4'), full: true, highlight: true },
    ];

    grid.innerHTML = items.map(item => `
        <div class="info-item ${item.full ? 'full' : ''}">
            <div class="info-key">
                <i class="fa-solid ${item.icon}"></i>
                ${item.key}
            </div>
            <div class="info-val ${item.highlight ? 'highlight' : ''}" style="${item.mono ? 'font-family:var(--font-mono);letter-spacing:0.1em' : ''}">
                ${item.raw ? item.val : escHtml(String(item.val))}
            </div>
        </div>
    `).join('');
}

// ── ACTIONS ───────────────────────────────
function copyNik() {
    navigator.clipboard.writeText(currentNik).then(() => {
        showToast('📋 NIK copied!', 'success');
    });
}

function copyAllInfo() {
    if (!currentResult || !currentNik) return;
    const d   = currentResult?.data || currentResult?.result || currentResult || {};
    const nik = currentNik;

    const text = [
        `=== NIK PARSER PRO — by ryaakbar ===`,
        `NIK              : ${nik}`,
        `Provinsi         : ${d.provinsi || '-'}`,
        `Kabupaten/Kota   : ${d.kota || '-'}`,
        `Kecamatan        : ${d.kecamatan || '-'}`,
        `Kode Wilayah     : ${d.kodeWilayah || nik.slice(0,6)}`,
        `Jenis Kelamin    : ${d.jenisKelamin || '-'}`,
        `Tanggal Lahir    : ${d.tanggalLahir || '-'}`,
        `Hari Lahir       : ${d.hariLahir || '-'}`,
        `Zodiak           : ${d.zodiak || '-'}`,
        `Umur             : ${d.umur || '-'}`,
        `Ultah Berikutnya : ${d.ultahBerikutnya || '-'}`,
        `Nomor Urut       : ${d.nomorUrut || nik.slice(12,16)}`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Semua info copied!', 'success');
    });
}

function exportJson() {
    if (!currentResult || !currentNik) return;
    const d   = currentResult?.data || currentResult?.result || currentResult || {};
    const nik = currentNik;

    const obj = {
        meta: { tool: 'NIK Parser Pro by ryaakbar', parsedAt: new Date().toISOString() },
        nik,
        provinsi:         d.provinsi         || null,
        kota:             d.kota             || null,
        kecamatan:        d.kecamatan        || null,
        kodeWilayah:      d.kodeWilayah      || nik.slice(0,6),
        jenisKelamin:     d.jenisKelamin     || null,
        tanggalLahir:     d.tanggalLahir     || null,
        hariLahir:        d.hariLahir        || null,
        zodiak:           d.zodiak           || null,
        umur:             d.umur             || null,
        ultahBerikutnya:  d.ultahBerikutnya  || null,
        nomorUrut:        d.nomorUrut        || nik.slice(12,16),
    };

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    a.download = `nik_${nik}_${Date.now()}.json`;
    a.click();
    showToast('⬇️ Exported ke JSON!', 'success');
}

function newScan() {
    hideResult();
    hideError();
    clearNik();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── HISTORY ───────────────────────────────
function addToHistory(nik, data) {
    const d = data?.data || data?.result || data || {};
    // Pastiin info ga kosong
    const existing = history.findIndex(h => h.nik === nik);
    if (existing !== -1) history.splice(existing, 1);

    history.unshift({
        nik,
        info: `${d.provinsi || '-'} · ${d.kota || d.jenisKelamin || '-'}`,
        ts: Date.now(),
    });

    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('nik_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const card = document.getElementById('historyCard');
    const list = document.getElementById('historyList');

    if (!history.length) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    list.innerHTML = history.map((item, i) => `
        <div class="history-item" onclick="loadHistory(${i})">
            <div class="history-nik">${item.nik.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4')}</div>
            <div class="history-info">${item.info}</div>
            <button class="history-del" onclick="deleteHistory(event, ${i})" title="Hapus">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function loadHistory(i) {
    const item = history[i];
    if (!item) return;
    document.getElementById('nikInput').value = item.nik;
    onNikInput(document.getElementById('nikInput'));
    showToast('📋 NIK dimuat dari history', '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteHistory(e, i) {
    e.stopPropagation();
    history.splice(i, 1);
    localStorage.setItem('nik_history', JSON.stringify(history));
    renderHistory();
    showToast('🗑️ Dihapus dari history', '');
}

function clearHistory() {
    history = [];
    localStorage.removeItem('nik_history');
    renderHistory();
    showToast('🗑️ History cleared', '');
}

// ── UI HELPERS ────────────────────────────
function setLoading(show) {
    const btn = document.getElementById('parseBtn');
    document.getElementById('loading').classList.toggle('hidden', !show);
    btn.disabled = show;
    btn.innerHTML = show
        ? '<i class="fa-solid fa-spinner fa-spin"></i><span>Parsing...</span>'
        : '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Parse NIK</span><span class="btn-arrow">→</span>';
}
function hideResult() { document.getElementById('resultCard').classList.add('hidden'); }
function hideError()  { document.getElementById('errorCard').classList.add('hidden'); }
function showError(msg) {
    document.getElementById('errorText').textContent = msg;
    document.getElementById('errorCard').classList.remove('hidden');
}

// ── UTILS ─────────────────────────────────
function calcAge(birthDate) {
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
    return age;
}

function getHari(date) {
    return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][date.getDay()];
}

function getZodiak(dd, mm) {
    const z = [
        [1,20,'Capricorn'],[2,19,'Aquarius'],[3,20,'Pisces'],[4,20,'Aries'],
        [5,21,'Taurus'],[6,21,'Gemini'],[7,23,'Cancer'],[8,23,'Leo'],
        [9,23,'Virgo'],[10,23,'Libra'],[11,22,'Scorpio'],[12,22,'Sagittarius'],
    ];
    for (const [m, d, name] of z) {
        if (mm === m && dd < d) return name;
        if (mm === m + 1 && dd >= d) return name; // fallback
    }
    // Simpler lookup
    const zodiaks = ['Capricorn','Aquarius','Pisces','Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius'];
    const dates = [20,19,20,20,21,21,23,23,23,23,22,22];
    const idx = mm - 1;
    return dd < dates[idx] ? zodiaks[idx] : zodiaks[(idx + 1) % 12];
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
