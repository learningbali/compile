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
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Konfigurasi Skema JSON untuk mengunci 6 Panel Adegan secara universal
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
      "Anda adalah sutradara profesional yang menganalisis referensi gaya universal.\n" +
      "TUGAS UTAMA: Pecah cerita pengguna menjadi TEPAT 6 panel storyboard berbentuk JSON.\n" +
      "Di setiap panel, buat 'promptGambarSpesifik' dalam Bahasa Inggris yang sangat detail mendeskripsikan subjek karakter, background, suasana, dan pencahayaan secara konsisten berdasarkan gaya gambar/video referensi.";

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nIde Cerita: ${prompt}` }]
      }
    ];

    if (images && images.length > 0) {
      images.forEach(img => contents[0].parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    }
    if (video && video.base64) {
      contents[0].parts.push({ inlineData: { data: video.base64, mimeType: video.mimeType } });
    }

    // Eksekusi pembuatan 6 skrip panel storyboard
    const textResult = await textModel.generateContent({ contents, generationConfig });
    const storyboardData = JSON.parse(textResult.response.text());

    // Kembalikan teks skrip JSON beserta gaya payungnya ke client frontend
    return res.status(200).json({ 
      gayaVisualUmum: storyboardData.gayaVisualUmum,
      panels: storyboardData.panels 
    });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
