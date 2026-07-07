import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, images, video } = req.body;

    // 1. Pastikan API Key tersedia
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Environment Variables Vercel.' });
    }

    // 2. Inisialisasi SDK Gemini yang benar untuk versi @google/generative-ai
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Gunakan model gemini-2.5-flash untuk kecepatan & fitur multimodal yang stabil
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemInstruction = 
      "Anda adalah seorang Sutradara dan Ahli Storyboard Universal profesional. Anda akan menerima teks ide cerita, " +
      "beberapa gambar referensi (gaya visual/karakter), dan satu video referensi (gerakan/kamera).\n\n" +
      "Tugas Anda:\n" +
      "1. Analisis gaya visual/artistik dari gambar.\n" +
      "2. Analisis dinamika sinematografi dari video jika ada.\n" +
      "3. Bedah teks konsep cerita menjadi rancangan storyboard per adegan (panel-panel shot).\n" +
      "4. Setiap panel wajib berisi: Nama Adegan/Shot, Jenis Kamera, Deskripsi Visual Detail (padukan cerita dengan gaya gambar & gerakan video), dan Audio/Dialog.\n" +
      "5. Patuhi gaya tersebut secara universal, baik itu untuk tema fiksi ilmiah, anime, live-action, iklan, maupun fantasi.";

    const contents = [];

    // Masukkan instruksi dasar dan prompt teks dari user
    contents.push(`${systemInstruction}\n\nIde Cerita Pengguna:\n${prompt}`);

    // Masukkan Gambar Referensi
    if (images && images.length > 0) {
      images.forEach(img => {
        contents.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType
          }
        });
      });
    }

    // Masukkan Video Referensi
    if (video && video.base64) {
      contents.push({
        inlineData: {
          data: video.base64,
          mimeType: video.mimeType
        }
      });
    }

    // Jalankan request ke AI
    const result = await model.generateContent(contents);
    
    // Pastikan response ada dan ambil teksnya
    if (!result || !result.response) {
      throw new Error("Tidak ada respons yang diterima dari Gemini API.");
    }
    
    const responseText = result.response.text();

    return res.status(200).json({ data: responseText });

  } catch (error) {
    console.error("Gemini Error:", error);
    // Mengembalikan error dalam format JSON asli agar ditangkap baik oleh frontend
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada internal server.' });
  }
}
