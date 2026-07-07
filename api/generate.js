import { GoogleGenerativeAI } from '@google/generative-ai';

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
    
    // Model utama untuk analisis skrip
    const textModel = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      // Menggunakan definisi skema standar JSON agar tidak bergantung pada objek 'Type' yang bermasalah
      generationConfig: {
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
                  dialogAtauAudio: { type: "STRING" },
                  deskripsiCerita: { type: "STRING" },
                  promptGambarSpesifik: { type: "STRING" }
                },
                required: ["nomorAdegan", "jenisShot", "dialogAtauAudio", "deskripsiCerita", "promptGambarSpesifik"],
              },
            },
          },
          required: ["gayaVisualUmum", "panels"],
        },
      }
    });

    const systemInstruction = 
      "Anda adalah sutradara profesional. Analisis gambar/video referensi untuk mendeteksi gaya visual, rupa karakter, dan mood latar belakang secara universal.\n" +
      "Pecah cerita pengguna menjadi panel-panel JSON. Di kolom 'promptGambarSpesifik', buatkan prompt bahasa Inggris yang sangat detail untuk AI generator gambar (Imagen 3). " +
      "Pastikan prompt menyertakan detail bentuk karakter, warna background, pencahayaan, jenis shot, dan suasana agar konsisten dari panel awal hingga akhir mengikuti gambar referensi.";

    const contents = [`${systemInstruction}\n\nIde Cerita: ${prompt}`];
    if (images) images.forEach(img => contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    if (video) contents.push({ inlineData: { data: video.base64, mimeType: video.mimeType } });

    const textResult = await textModel.generateContent(contents);
    const storyboardData = JSON.parse(textResult.response.text());

    // 2. Gunakan Model Imagen Google untuk merender Gambar per Panel secara otomatis
    const imageModel = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });

    // Batasi maksimum 3 panel di serverless Vercel gratis agar aman dari Vercel Timeout (10 detik)
    const activePanels = storyboardData.panels.slice(0, 3); 

    for (let panel of activePanels) {
      try {
        const fullPrompt = `${panel.promptGambarSpesifik}, in the style of ${storyboardData.gayaVisualUmum}, cinematic composition, high detail storyboard panel`;
        
        const imageResult = await imageModel.generateContent({ prompt: fullPrompt });
        
        // Ambil data base64 gambar langsung dari Imagen 3
        const base64Image = imageResult.response.generatedImages[0].image.imageBytesBase64;
        panel.imageUrl = `data:image/jpeg;base64,${base64Image}`;
      } catch (imgErr) {
        console.error("Gagal membuat gambar untuk panel ini:", imgErr);
        panel.imageUrl = "https://placehold.co/600x400?text=Gambar+Gagal+Dimuat";
      }
    }

    return res.status(200).json({ data: activePanels });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
