import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Menggunakan model gambar native terbaru yang didukung penyesuaian modalitas gambar
    const imageModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const result = await imageModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"] // Wajib disertakan pada SDK versi baru untuk menghasilkan output visual
      }
    });

    let base64Image = null;
    if (result.response.candidates?.[0]?.content?.parts) {
      for (const part of result.response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) throw new Error("Gagal mengekstrak data gambar.");

    return res.status(200).json({ imageUrl: `data:image/png;base64,${base64Image}` });

  } catch (error) {
    console.error("Image API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
