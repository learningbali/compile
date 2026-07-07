import { GoogleGenAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, images, video } = req.body;

    // Inisialisasi API Key dari environment variable Vercel Anda
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Menggunakan model gemini-2.5-flash karena sangat efisien dalam memproses multimodal (Teks + Gambar + Video)
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Instruksi sistem yang memaksa AI bekerja secara Universal tanpa terikat satu topik
    const systemInstruction = 
      "Anda adalah seorang Sutradara dan Ahli Storyboard Universal profesional. Anda akan menerima teks ide cerita, " +
      "beberapa gambar referensi (yang mendefinisikan gaya visual, palet warna, atau rupa karakter), dan satu video referensi " +
      "(yang mendefinisikan tempo adegan, gaya pergerakan kamera, atau jenis transisi shot).\n\n" +
      "Tugas Anda:\n" +
      "1. Analisis gaya visual/artistik dari gambar yang diunggah.\n" +
      "2. Analisis dinamika sinematografi/gerakan dari video yang diunggah.\n" +
      "3. Bedah teks konsep cerita yang diberikan menjadi sebuah rancangan storyboard terstruktur per adegan (panel-panel shot).\n" +
      "4. Setiap panel wajib berisi: Nama Adegan/Shot, Jenis Kamera (misal: Close-up, Wide Shot, Panning), Deskripsi Visual Detail " +
      "(gabungkan konsep cerita pengguna dengan gaya visual dari gambar dan gerakan dari video secara presisi), dan Audio/Dialog.\n" +
      "5. Patuhi gaya referensi tersebut secara universal, baik itu untuk tema fiksi ilmiah, anime, live-action korporat, iklan, maupun fantasi.";

    // Susun isi konten yang akan dikirim
    const contents = [];

    // 1. Masukkan Instruksi Kerja dan Teks Cerita Pengguna
    contents.push(`${systemInstruction}\n\nIde Cerita Pengguna:\n${prompt}`);

    // 2. Jika ada Gambar referensi, masukkan ke array konten
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

    // 3. Jika ada Video referensi, masukkan ke array konten
    if (video) {
      contents.push({
        inlineData: {
          data: video.base64,
          mimeType: video.mimeType
        }
      });
    }

    // Eksekusi ke Gemini API
    const result = await model.generateContent(contents);
    const responseText = result.response.text();

    // Kirimkan balik hasilnya ke front-end
    return res.status(200).json({ data: responseText });

  } catch (error) {
    console.error("Gemini Processing Error:", error);
    return res.status(500).json({ error: 'Gagal memproses storyboard: ' + error.message });
  }
}
