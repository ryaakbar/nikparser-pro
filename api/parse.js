// api/parse.js — NIK Parser dengan database wilayah lokal + API fallback

const WILAYAH = require('./wilayah.js');

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

function parseNikFull(nik) {
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

  // Lookup wilayah dari database lokal
  const wilayah  = WILAYAH[kodeWilayah] || null;
  const kotaKec  = wilayah ? wilayah.split('|') : null;
  const kota      = kotaKec ? kotaKec[0] : null;
  const kecamatan = kotaKec ? kotaKec[1] : null;

  // Umur detail
  const now   = new Date();
  const birth = new Date(tahun, mm-1, dd);
  let years   = now.getFullYear() - birth.getFullYear();
  let months  = now.getMonth()    - birth.getMonth();
  let days    = now.getDate()     - birth.getDate();
  if (days   < 0) { months--; days   += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--;  months += 12; }

  // Ultah berikutnya
  let nextBday = new Date(now.getFullYear(), mm-1, dd);
  if (nextBday <= now) nextBday.setFullYear(now.getFullYear() + 1);
  const diffDays = Math.ceil((nextBday - now) / (1000*60*60*24));
  const bMonths  = Math.floor(diffDays / 30);
  const bDays    = diffDays % 30;

  // Zodiak
  const zodiakData = [
    [1,20,'Capricorn'],[2,19,'Aquarius'],[3,20,'Pisces'],[4,20,'Aries'],
    [5,21,'Taurus'],[6,21,'Gemini'],[7,23,'Cancer'],[8,23,'Leo'],
    [9,23,'Virgo'],[10,23,'Libra'],[11,22,'Scorpio'],[12,22,'Sagittarius'],
  ];
  let zodiak = 'Capricorn';
  for (let i = 0; i < zodiakData.length; i++) {
    const [m, d, name] = zodiakData[i];
    if (mm === m) {
      zodiak = dd < d ? name : (zodiakData[(i+1) % 12][2]);
      break;
    }
  }

  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][birth.getDay()];

  return {
    nik,
    kodeWilayah,
    kodeProv,
    provinsi:         PROVINSI[kodeProv] || 'Tidak diketahui',
    kota:             kota     || 'Tidak ada dalam database',
    kecamatan:        kecamatan || 'Tidak ada dalam database',
    jenisKelamin:     isPerempuan ? 'PEREMPUAN' : 'LAKI-LAKI',
    tanggalLahir:     tglLahir,
    hariLahir:        hari,
    zodiak,
    umur:             `${years} Tahun ${months} Bulan ${days} Hari`,
    ultahBerikutnya:  `${bMonths} Bulan ${bDays} Hari Lagi`,
    nomorUrut,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { nik } = req.query;
  if (!nik)             return res.status(400).json({ success: false, message: 'NIK wajib diisi.' });
  if (!/^\d{16}$/.test(nik)) return res.status(400).json({ success: false, message: 'NIK harus 16 digit angka.' });

  try {
    const result = parseNikFull(nik);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal parse NIK: ' + err.message });
  }
};
