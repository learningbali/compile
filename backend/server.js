import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors()); // Mengizinkan frontend mengakses backend ini
app.use(express.json());

// Inisialisasi Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/generate-storyboard', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt tidak boleh kosong' });
    }

    const systemInstruction = `
        Anda adalah seorang AI Storyboard Director Profesional universal.
        Tugas Anda adalah memecah ide cerita pengguna menjadi rancangan storyboard video pendek yang terdiri dari 4 sampai 5 adegan (scene) detail.
        
        Format respon Anda WAJIB hanya berupa JSON array murni tanpa pembuka/penutup kata, tanpa format markdown (\`\`\`json ... \`\`\`).
        
        Struktur JSON yang harus Anda buat wajib mengikuti template ini:
        [
          {
            "scene": 1,
            "durasi": "00:00 - 00:02",
            "visual": "Deskripsi visual yang sangat detail mengenai objek, background, warna sesuai konteks cerita user",
            "camera": "Tipe sudut/gerakan kamera (misal: Macro Close-up, Panning, Tracking Shot, Bird Eye View)",
            "motion": "Detail gerakan objek atau karakter utama di dalam frame",
            "sfx": "Efek suara latar atau ambience yang terdengar"
          }
        ]
    `;

    try {
        // Menggunakan model Gemini 2.5 Flash
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemInstruction}\n\nIde Cerita Pengguna: ${prompt}`,
            config: {
                responseMimeType: 'application/json' // Memaksa output berupa JSON murni
            }
        });

        const rawText = response.text;
        const storyboardData = JSON.parse(rawText);
        
        res.json(storyboardData);
    } catch (error) {
        console.error('Error dari Gemini API:', error);
        res.status(500).json({ error: 'Gagal memproses data ke AI Gemini' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server berjalan di http://localhost:${PORT}`);
});
