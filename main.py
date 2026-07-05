from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time

# Inisialisasi Aplikasi Web
app = FastAPI(title="Visionary AI Prompt Builder API")

# Mengizinkan Frontend (HTML) untuk mengakses Backend ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Di tahap produksi, ganti dengan domain website Anda
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Struktur Data Balasan ke Frontend
class StoryboardSegment(BaseModel):
    timecode: str
    prompt: str

@app.post("/api/process-video", response_model=list[StoryboardSegment])
async def process_video(
    youtube_url: str = Form(None),
    style_preference: str = Form("dokumenter")
):
    """
    Endpoint ini menerima URL video dan gaya visual dari pengguna,
    lalu mengembalikan daftar prompt yang sudah dipotong per detik.
    """
    
    # ---------------------------------------------------------
    # TAHAP 1: UNDUH & POTONG VIDEO (Simulasi)
    # Di aplikasi nyata, gunakan library 'yt-dlp' untuk mengunduh,
    # dan 'moviepy' atau 'ffmpeg' untuk memotong video per 10 detik.
    # ---------------------------------------------------------
    print(f"Menerima permintaan untuk URL: {youtube_url} dengan gaya: {style_preference}")
    time.sleep(2) # Simulasi waktu pemrosesan server
    
    # ---------------------------------------------------------
    # TAHAP 2: PARAMETER WAJIB (Negative & Base Prompts)
    # ---------------------------------------------------------
    base_prompt = (
        "Ultra-Realistic Cinematic ASMR Commercial. Photorealistic, Hyper-realistic textures, "
        "8K quality, Luxury commercial, Professional styling, Editorial product photography, "
        "Cinematic masterpiece, Commercial advertisement quality. "
    )
    
    negative_prompt = (
        "No music. No dialogue. No narration. No voice-over. No text overlay. "
        "No subtitles. No captions. No logo. No watermark. No branding. No face visible."
    )

    # ---------------------------------------------------------
    # TAHAP 3: INJEKSI GAYA (Style Modifier)
    # ---------------------------------------------------------
    style_modifier = ""
    if style_preference == "futuristik":
        style_modifier = "Cyberpunk aesthetic, neon lighting, holographic elements, high-tech lab setting. "
    elif style_preference == "ghibli":
        style_modifier = "Anime Studio Ghibli style, hand-drawn animation look, pastel colors, magical lighting. "
    elif style_preference == "klasik":
        style_modifier = "Classical oil painting style, Renaissance chiaroscuro lighting, canvas texture. "
    elif style_preference == "dokumenter":
        style_modifier = "Raw documentary footage, gritty, handheld camera movement, natural cinematic lighting. "

    # ---------------------------------------------------------
    # TAHAP 4: ANALISIS AI & GENERATE PROMPT (Simulasi Output)
    # Di aplikasi nyata, Anda mengirim frame video ke OpenAI GPT-4V 
    # atau Gemini Pro Vision untuk diubah menjadi teks deskripsi adegan.
    # ---------------------------------------------------------
    
    storyboard_results = [
        StoryboardSegment(
            timecode="0:00 - 0:02",
            prompt=f"{base_prompt}{style_modifier}Macro close-up of a precision screwdriver tightening a polished metal screw into the detailed chassis of a sleek diecast sports car. {negative_prompt}"
        ),
        StoryboardSegment(
            timecode="0:03 - 0:04",
            prompt=f"{base_prompt}{style_modifier}Extreme close-up of heavy, vintage metal model train wheels being gently lowered and perfectly locking onto miniature steel railway tracks. {negative_prompt}"
        ),
        StoryboardSegment(
            timecode="0:05 - 0:06",
            prompt=f"{base_prompt}{style_modifier}Slow-motion macro shot of brushed aluminum wings being seamlessly snapped into the fuselage of a high-end model airplane. {negative_prompt}"
        )
    ]

    return storyboard_results
