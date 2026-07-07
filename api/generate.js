import { GoogleGenerativeAI } from '@google/generative-ai';

// Konfigurasi konstan untuk performa & biaya
const MAX_PANELS_FOR_VERCEL = 3; // Batasi 3 panel agar tidak kena timeout Vercel
const IMAGE_MODEL_NAME = 'imagen-3.0-generate-002'; // Pastikan Imagen 3 diaktifkan

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, images, video } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const imageModel = genAI.getGenerativeModel({ model: IMAGE_MODEL_NAME });

    // 1. TAHAP PEMBUATAN SKRIP STORYBOARD (Analisis & Ekstraksi Gaya)
    // Meminta Gemini membuat output JSON bersih per panel dengan prompt gambar detail
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          gayaVisualUmum: { type: "STRING" },
          panels: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                nomorAdegan: { type: "STRING" },
                jenisShot: { type: "STRING" },
                deskripsiVisual: { type: "STRING" },
                promptGambarSpesifik: { type: "STRING" }, // Prompt detail dalam Bahasa Inggris
                audio: { type: "STRING" }
              },
              required: ["nomorAdegan", "jenisShot", "deskripsiVisual", "promptGambarSpesifik", "audio"],
            },
          },
        },
        required: ["gayaVisualUmum", "panels"],
      },
    };

    const systemInstruction = 
      `Anda adalah sutradara profesional yang menganalisis referensi gaya universal.\n` +
      `Pecah cerita pengguna menjadi panel-panel storyboard JSON rapi (maksimal ${MAX_PANELS_FOR_VERCEL}).\n` +
      `Untuk setiap panel, buat prompt gambar Bahasa Inggris spesifik yang menggabungkan elemen cerita dan gaya referensi yang konsisten.\n` +
      `Pastikan deskripsi karakter, background, pencahayaan, dan mood detail agar AI Imagen bisa merender dengan konsisten.`;

    const contents = [`${systemInstruction}\n\nIde Cerita: ${prompt}`];
    if (images) images.forEach(img => contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    if (video) contents.push({ inlineData: { data: video.base64, mimeType: video.mimeType } });

    // Generate teks storyboard
    const textResult = await textModel.generateContent({ contents, generationConfig });
    const storyboardData = JSON.parse(textResult.response.text());

    // 2. TAHAP PEMBUATAN GAMBAR PARALEL (Perbaikan Timeout)
    const activePanels = storyboardData.panels.slice(0, MAX_PANELS_FOR_VERCEL);

    // Fungsi pembantu untuk membuat SATU gambar panel
    const generatePanelImage = async (panel, gaya) => {
      try {
        const fullPrompt = `${panel.promptGambarSpesifik}, in the style of ${gaya}, highly detailed storyboard art, cinematic lighting, 8k resolution`;
        
        // Panggil Imagen 3
        const imageResult = await imageModel.generateContent({ prompt: fullPrompt });
        
        // Ambil base64 gambar
        const base64Image = imageResult.response.generatedImages[0].image.imageBytesBase64;
        return `data:image/jpeg;base64,${base64Image}`;
      } catch (imgErr) {
        console.error(`Gagal membuat gambar untuk panel ${panel.nomorAdegan}:`, imgErr);
        // Placeholder fallback jika satu gambar gagal
        return "https://placehold.co/600x400?text=Gambar+Gagal+Dimuat";
      }
    };

    // Jalankan semua request gambar secara PARALEL untuk efisiensi waktu
    const imageGenerationPromises = activePanels.map(panel => 
      generatePanelImage(panel, storyboardData.gayaVisualUmum)
    );

    // Tunggu semua gambar selesai dibuat bersamaan
    const imageUrls = await Promise.all(imageGenerationPromises);

    // Pasangkan URL gambar yang dihasilkan ke data panel masing-masing
    for (let i = 0; i < activePanels.length; i++) {
      activePanels[i].imageUrl = imageUrls[i];
    }

    // Kembalikan data storyboard lengkap ke front-end
    return res.status(200).json({ data: activePanels });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
