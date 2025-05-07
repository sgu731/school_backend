from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from openai import OpenAI
#from dotenv import load_dotenv
import os

# 載入環境變數
#load_dotenv()
# 可以用環境變數決定 key 之後也可以用別的 不過我先直接設定
OPENROUTER_API_KEY = "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"
YOUR_SITE_URL = "http://localhost:5000"
YOUR_SITE_NAME = "Transcription App"

# 初始化 OpenRouter 客戶端
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

router = APIRouter(prefix="/ai", tags=["AI Analysis"])

# 分析文字
@router.post("/analyze")
async def analyze_transcription(
    transcription: str = Form(...),
    prompt: str = Form(default="請整理這段文字為筆記，提取關鍵點並按主題分類。")
):
    try:
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": YOUR_SITE_URL,
                "X-Title": YOUR_SITE_NAME,
            },
            #這可以改
            model="deepseek/deepseek-chat-v3-0324:free",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that organizes text into notes."},
                {"role": "user", "content": f"{prompt}\n\nText: {transcription}"}
            ],
            max_tokens=1000
        )
        analysis = completion.choices[0].message.content
        return JSONResponse({
            "success": True,
            "analysis": analysis
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze transcription: {str(e)}")