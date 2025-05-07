from fastapi import FastAPI, HTTPException, Form, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import whisper
import torch
import yt_dlp
import os
import tempfile
from ai import router as ai_router
from analysis import router as analysis_router 

app = FastAPI(title="Python Service", description="A general-purpose Python service")

# ✅ 加入 CORS 設定（允許本地前端連線）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 若只允許某些來源可寫 ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 新增 AI 分析功能
app.include_router(ai_router)
app.include_router(analysis_router)

# 檢查是否有 GPU 可用
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# 讀取 Whisper 模型
model = whisper.load_model("small").to(device)

# 臨時檔案儲存路徑
TEMP_DIR = "temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)

# 獲取 YouTube 字幕 zh = 繁體中文
def get_youtube_subtitles(url: str, language="zh"):
    ydl_opts = {
        'skip_download': True,  # 不下載影片
        'writesubtitles': True,  # 嘗試獲取字幕
        'writeautomaticsub': True,  # 包含自動生成字幕
        'subtitleslangs': [language, 'en'],  # 優先指定語言，備選英文
        'outtmpl': os.path.join(TEMP_DIR, '%(id)s'),
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subtitles = info.get('subtitles', {}) or info.get('automatic_captions', {})
            for lang in [language, 'en']:  # 檢查指定語言和英文
                if lang in subtitles:
                    # 下載字幕檔案
                    ydl.params['writesubtitles'] = True
                    ydl.download([url])
                    subtitle_file = os.path.join(TEMP_DIR, f"{info['id']}.{lang}.vtt")
                    if os.path.exists(subtitle_file):
                        with open(subtitle_file, 'r', encoding='utf-8') as f:
                            subtitle_text = f.read()
                        os.remove(subtitle_file)  # 清理檔案
                        return {"success": True, "transcription": subtitle_text, "source": "subtitles"}
            return None  # 無可用字幕
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subtitles: {str(e)}")


"""             
檔案格式
'postprocessors': [{
    'key': 'FFmpegExtractAudio',
    'preferredcodec': 'mp3',
    #'preferredquality': '192',
}], """

# 下載 YouTube 語音的函數
def download_youtube_audio(url: str) -> str:
    try:
        ydl_opts = {
            'format': 'bestaudio',
            'outtmpl': os.path.join(TEMP_DIR, '%(id)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return os.path.join(TEMP_DIR, f"{info['id']}.mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download YouTube audio: {str(e)}")

# 轉錄函數
def whisper_transcribe(file_path: str):
    print("跑 Whisper 中...")
    try:
        result = model.transcribe(file_path, language="zh")
        return {
            "success": True,
            "transcription": result["text"],
            "language": result.get("language", "zh"),
            "device_used": device,
            "source": "whisper"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# 原有的檔案上傳端點（保留）
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    print("檔案上傳轉錄... ")
    try:
        # 驗證檔案副檔名
        allowed_extensions = {".mp3", ".wav", ".m4a"}
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Unsupported file format. Only .mp3, .wav, .m4a are allowed.")

        # 儲存檔案到臨時位置
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name

        # 使用 Whisper 轉錄
        result = whisper_transcribe(temp_file_path)

        # 清理臨時檔案
        os.unlink(temp_file_path)

        if result["success"]:
            return JSONResponse(result)
        else:
            return JSONResponse({
                "success": False,
                "error": "Transcription failed",
                "details": result["error"]
            }, status_code=500)
    except HTTPException as he:
        raise he
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": "Transcription failed",
            "details": str(e)
        }, status_code=500)

@app.post("/transcribe/youtube")
async def transcribe_youtube(url: str = Form(...)):
    print("Youtube轉錄功能...")
    # 先看Youtube有沒有字幕
    subtitle_result = get_youtube_subtitles(url)
    if subtitle_result:
        return subtitle_result

    # 如果沒有字幕，下載並轉錄
    audio_file = download_youtube_audio(url)
    result = whisper_transcribe(audio_file)
    
    # 清理臨時檔案
    if os.path.exists(audio_file):
        os.remove(audio_file)
    
    if result["success"]:
        return JSONResponse(result)
    else:
        return JSONResponse({
            "success": False,
            "error": "Transcription failed",
            "details": result["error"]
        }, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)