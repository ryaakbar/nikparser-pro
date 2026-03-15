// api/parse.js — NIK Parser dengan multi-source + local fallback

const PROVINSI = {
  '11':'Aceh','12':'Sumatera Utara','13':'Sumatera Barat','14':'Riau',
  '15':'Jambi','16':'Sumatera Selatan','17':'Bengkulu','18':'Lampung',
  '19':'Kepulauan Bangka Belitung','21':'Kepulauan Riau','31':'DKI Jakarta',
  '32':'Jawa Barat','33':'Jawa Tengah','34':'DI Yogyakarta','35':'Jawa Timur',
  '36':'Banten','51':'Bali','52':'Nusa Tenggara Barat','53':'Nusa Tenggara Timur',
  '61':'Kalimantan Barat','62':'Kalimantan Tengah','63':'Kalimantan Selatan',
  '64':'Kalimantan Timur','65':'Kalimantan Utara','71':'Sulawesi Utara',
  '72':'Sulawesi Tengah','73':'Sulawesi Selatan','74':'Sulawesi Tenggara',
  '75':'Gorontalo','76':'Sulawesi Barat','81':'Maluku','82':'Maluku Utara',
  '91':'Papua Barat','92':'Papua','93':'Papua Selatan','94':'Papua Tengah',
  '95':'Papua Pegunungan','96':'Papua Barat Daya',
};

function parseNikLocal(nik) {
  const kodeWilayah = nik.slice(0, 6);
  const kodeProv    = nik.slice(0, 2);
  const tglRaw      = nik.slice(6, 12);
  const nomorUrut   = nik.slice(12, 16);

  let dd = parseInt(tglRaw.slice(0,2));
  const mm = parseInt(tglRaw.slice(2,4));
  const yy = parseInt(tglRaw.slice(4,6));

  const isPerempuan = dd > 40;
  if (isPerempuan) dd -= 40;

  const tahun = yy <= 30 ? 2000 + yy : 1900 + yy;
  const tglLahir = `${String(dd).padStart(2,'0')}-${String(mm).padStart(2,'0')}-${tahun}`;

  // Hitung umur detail
  const now = new Date();
  const birth = new Date(tahun, mm-1, dd);
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }

  // Hitung hari menuju ulang tahun berikutnya
  let nextBday = new Date(now.getFullYear(), mm-1, dd);
  if (nextBday <= now) nextBday.setFullYear(now.getFullYear() + 1);
  const diffMs = nextBday - now;
  const diffDays = Math.ceil(diffMs / (1000*60*60*24));
  const bmonths = Math.floor(diffDays / 30);
  const bdays   = diffDays % 30;

  // Zodiak
  const zodiaks = [
    [1,20,'Capricorn'],[2,19,'Aquarius'],[3,20,'Pisces'],[4,20,'Aries'],
    [5,21,'Taurus'],[6,21,'Gemini'],[7,23,'Cancer'],[8,23,'Leo'],
    [9,23,'Virgo'],[10,23,'Libra'],[11,22,'Scorpio'],[12,22,'Sagittarius'],
  ];
  let zodiak = 'Capricorn';
  for (const [m, d, name] of zodiaks) {
    if (mm === m && dd < d) { zodiak = name; break; }
    if (mm === m && dd >= d) {
      const next = zodiaks[m % 12];
      zodiak = next ? next[2] : 'Capricorn';
      break;
    }
  }

  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][birth.getDay()];
  const provinsi = PROVINSI[kodeProv] || 'Tidak diketahui';

  return {
    nik,
    kodeWilayah,
    kodeProv,
    provinsi,
    jenisKelamin: isPerempuan ? 'PEREMPUAN' : 'LAKI-LAKI',
    tanggalLahir: tglLahir,
    hariLahir: hari,
    zodiak,
    umur: `${years} Tahun ${months} Bulan ${days} Hari`,
    ultahBerikutnya: `${bmonths} Bulan ${bdays} Hari Lagi`,
    nomorUrut,
    source: 'local',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { nik } = req.query;
  if (!nik) return res.status(400).json({ success: false, message: 'NIK wajib diisi.' });
  if (!/^\d{16}$/.test(nik)) return res.status(400).json({ success: false, message: 'NIK harus 16 digit angka.' });

  // Coba API eksternal dulu, fallback ke local parser
  const APIs = [
    `https://api.jagospot.my.id/api/nikparser?nik=${nik}`,
    `https://api.siputzx.my.id/api/tools/nikparser?nik=${nik}`,
    `https://api.lolhuman.xyz/api/nikparse?apikey=Yagami&nik=${nik}`,
  ];

  for (const url of APIs) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) continue;
      const data = await r.json();
      // Cek ada data wilayah
      const d = data?.data || data?.result || data;
      if (d?.provinsi || d?.province || d?.kota || d?.city) {
        // Merge dengan local parser untuk data yang lebih lengkap
        const local = parseNikLocal(nik);
        return res.status(200).json({
          success: true,
          data: {
            ...local,
            provinsi:   d.provinsi  || d.province  || local.provinsi,
            kota:       d.kota      || d.city       || d.kabupaten || null,
            kecamatan:  d.kecamatan || d.district   || null,
            source: 'api',
          }
        });
      }
    } catch (e) {
      console.warn('[parse] API failed:', e.message);
    }
  }

  // Semua API gagal → pakai local parser
  const local = parseNikLocal(nik);
  return res.status(200).json({ success: true, data: local });
};
