import { GoogleGenerativeAI } from '@google/generative-ai';

// Menggunakan model penghasil gambar gratis yang tidak memerlukan setup billing
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image'; 
const MAX_PANELS_FOR_VERCEL = 3; 

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

    // 1. TAHAP PEMBUATAN SKRIP STORYBOARD
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
      `Pastikan deskripsi karakter, background, pencahayaan, dan mood detail agar AI bisa merender dengan konsisten.`;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: `${systemInstruction}\n\nIde Cerita: ${prompt}` }
        ]
      }
    ];

    if (images && images.length > 0) {
      images.forEach(img => {
        contents[0].parts.push({
          inlineData: { data: img.base64, mimeType: img.mimeType }
        });
      });
    }

    if (video && video.base64) {
      contents[0].parts.push({
        inlineData: { data: video.base64, mimeType: video.mimeType }
      });
    }

    const textResult = await textModel.generateContent({ 
      contents: contents, 
      generationConfig: generationConfig 
    });
    
    const storyboardData = JSON.parse(textResult.response.text());
    const activePanels = storyboardData.panels.slice(0, MAX_PANELS_FOR_VERCEL);

    // 2. TAHAP PEMBUATAN GAMBAR PARALEL (Perbaikan Struktur Output Gambar)
    const generatePanelImage = async (panel, gaya) => {
      try {
        const fullPrompt = `${panel.promptGambarSpesifik}, in the style of ${gaya}, highly detailed storyboard art, cinematic lighting, 8k resolution`;
        
        // Panggil model pembuat gambar
        const imageResult = await imageModel.generateContent({ 
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] 
        });
        
        // --- PERBAIKAN STRUKTUR PEMBACAAN DATA GAMBAR ---
        // Mencari part yang memiliki inlineData base64 di dalam response Gemini
        let base64Image = null;
        if (imageResult.response.candidates?.[0]?.content?.parts) {
          for (const part of imageResult.response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }

        if (base64Image) {
          return `data:image/png;base64,${base64Image}`;
        } else {
          throw new Error("Data inline_data gambar tidak ditemukan pada response.");
        }
        // ------------------------------------------------
        
      } catch (imgErr) {
        console.error(`Gagal membuat gambar untuk panel ${panel.nomorAdegan}:`, imgErr);
        return "https://placehold.co/600x400?text=Gambar+Gagal+Dimuat";
      }
    };

    // Eksekusi semua proses gambar secara bersamaan
    const imageGenerationPromises = activePanels.map(panel => 
      generatePanelImage(panel, storyboardData.gayaVisualUmum)
    );

    const imageUrls = await Promise.all(imageGenerationPromises);

    // Tempelkan URL gambar ke data panel masing-masing
    for (let i = 0; i < activePanels.length; i++) {
      activePanels[i].imageUrl = imageUrls[i];
    }

    return res.status(200).json({ data: activePanels });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
