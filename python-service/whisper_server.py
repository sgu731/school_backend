from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import openai
import tempfile

app = FastAPI()

# 跨域設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI API 金鑰（請改成你自己的）
openai.api_key = "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"

@app.post("/whisper/transcribe")
async def transcribe(audio: UploadFile):
    # 儲存成臨時檔
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    # Whisper 轉錄
    with open(tmp_path, "rb") as f:
        transcript = openai.Audio.transcribe("whisper-1", f)

    return { "text": transcript["text"] }