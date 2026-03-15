// api/parse.js — NIK Parser via nekolabs API

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const { nik } = req.query;

        if (!nik) {
            return res.status(400).json({ success: false, message: 'NIK parameter wajib diisi.' });
        }

        if (!/^\d{16}$/.test(nik)) {
            return res.status(400).json({ success: false, message: 'NIK harus 16 digit angka.' });
        }

        const apiUrl = `https://api.nekolabs.web.id/tools/nikparser?nik=${nik}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(`API eksternal error: HTTP ${response.status}`);
        }

        const data = await response.json();

        return res.status(200).json(data);

    } catch (error) {
        console.error('[parse] Error:', error.message);

        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            return res.status(504).json({ success: false, message: 'Request timeout. Coba lagi.' });
        }

        return res.status(500).json({ success: false, message: 'Gagal parse NIK: ' + error.message });
    }
};
