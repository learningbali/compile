import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_PANELS_FOR_VERCEL = 3; 
const IMAGE_MODEL_NAME = 'imagen-3.0-generate-002'; 

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

    // 1. TAHAP PEMBUATAN SKRIP STORYBOARD (Konfigurasi Skema JSON)
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
                promptGambarSpesifik: { type: "STRING" },
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

    // --- PERBAIKAN DI SINI ---
    // Semua komponen teks dan media HARUS dibungkus dalam struktur part objek yang legal
    const contents = [
      {
        role: 'user',
        parts: [
          { text: `${systemInstruction}\n\nIde Cerita: ${prompt}` }
        ]
      }
    ];

    // Jika ada gambar, masukkan ke dalam struktur parts yang sama
    if (images && images.length > 0) {
      images.forEach(img => {
        contents[0].parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType
          }
        });
      });
    }

    // Jika ada video, masukkan ke dalam struktur parts
    if (video && video.base64) {
      contents[0].parts.push({
        inlineData: {
          data: video.base64,
          mimeType: video.mimeType
        }
      });
    }
    // -------------------------

    // Panggil model untuk menghasilkan teks skrip/prompt JSON
    const textResult = await textModel.generateContent({ 
      contents: contents, 
      generationConfig: generationConfig 
    });
    
    const storyboardData = JSON.parse(textResult.response.text());
    const activePanels = storyboardData.panels.slice(0, MAX_PANELS_FOR_VERCEL);

    // 2. TAHAP PEMBUATAN GAMBAR PARALEL
    const generatePanelImage = async (panel, gaya) => {
      try {
        const fullPrompt = `${panel.promptGambarSpesifik}, in the style of ${gaya}, highly detailed storyboard art, cinematic lighting, 8k resolution`;
        
        // Pemanggilan Imagen 3 menggunakan struktur parameter objek tunggal yang direkomendasikan
        const imageResult = await imageModel.generateContent({ 
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] 
        });
        
        const base64Image = imageResult.response.generatedImages[0].image.imageBytesBase64;
        return `data:image/jpeg;base64,${base64Image}`;
      } catch (imgErr) {
        console.error(`Gagal membuat gambar untuk panel ${panel.nomorAdegan}:`, imgErr);
        return "https://placehold.co/600x400?text=Gambar+Gagal+Dimuat";
      }
    };

    // Jalankan semua request gambar secara paralel
    const imageGenerationPromises = activePanels.map(panel => 
      generatePanelImage(panel, storyboardData.gayaVisualUmum)
    );

    const imageUrls = await Promise.all(imageGenerationPromises);

    // Pasangkan URL gambar ke masing-masing data adegan
    for (let i = 0; i < activePanels.length; i++) {
      activePanels[i].imageUrl = imageUrls[i];
    }

    return res.status(200).json({ data: activePanels });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
