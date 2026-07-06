export default async function handler(req, res) {
    // Pengaturan Header CORS agar bisa diakses browser 
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt tidak boleh kosong' });
    }

    // Mengambil API Key tersembunyi yang Anda simpan di Vercel tadi
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API Key belum terkonfigurasi di Vercel' });
    }

    const systemInstruction = `
        Anda adalah seorang AI Storyboard Director Profesional universal.
        Tugas Anda adalah memecah ide cerita pengguna menjadi rancangan storyboard video pendek yang terdiri dari 4 sampai 5 adegan (scene) detail.
        Format respon Anda WAJIB hanya berupa JSON array murni tanpa pembuka/penutup kata, tanpa format markdown (\`\`\`json ... \`\`\`).
        Struktur JSON wajib mengikuti template ini:
        [
          {
            "scene": 1,
            "durasi": "00:00 - 00:02",
            "visual": "Deskripsi visual detail objek, lingkungan, dan suasana",
            "camera": "Tipe sudut/gerakan kamera",
            "motion": "Detail gerakan objek utama di dalam frame",
            "sfx": "Efek suara atau detail audio ASMR/Voice yang terdengar"
          }
        ]
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nIde Cerita Pengguna: ${prompt}` }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error dari Google:', errorText);
            return res.status(response.status).json({ error: 'Google AI menolak permintaan.' });
        }

        const resData = await response.json();
        const rawJsonText = resData.candidates[0].content.parts[0].text;
        const storyboardData = JSON.parse(rawJsonText);

        return res.status(200).json(storyboardData);
    } catch (error) {
        console.error('Crash Error:', error);
        return res.status(500).json({ error: 'Terjadi kegagalan server internal.' });
    }
}
