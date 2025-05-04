import sys
import io
import os
from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from openai import OpenAI

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# OpenRouter API 設定
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
YOUR_SITE_URL = "http://localhost:8000"
YOUR_SITE_NAME = "AI筆記分析工具"

# 初始化 OpenAI Client（透過 OpenRouter）
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

router = APIRouter(prefix="/analyze", tags=["分析模式路由"])

def get_prompt_for_mode(mode: str) -> str:
    if mode == "考試模式":
        return "請以條列式列出這段筆記的重點（Bullet Points），整理出重要知識點與相關概念。"
    elif mode == "報告模式":
        return "請將這段內容整理為 mermaid.js 格式的流程圖、心智圖或資訊結構圖，適合視覺化理解。"
    elif mode == "摘要":
        return "請為這段內容撰寫簡潔摘要，涵蓋主要內容。"
    else:
        return "請整理這段文字為筆記，提取重點。"

@router.post("/analyze")
async def analyze_transcription(
    transcription: str = Form(...),
    mode: str = Form(default="摘要")
):
    prompt = get_prompt_for_mode(mode)

    try:
        print("📨 發送請求中：", mode)
        print("📝 Prompt:", prompt)

        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": YOUR_SITE_URL,
                "X-Title": YOUR_SITE_NAME,
            },
            model="deepseek/deepseek-chat-v3-0324:free",
            messages=[
                {"role": "system", "content": "你是一個擅長筆記整理與視覺化的助理。"},
                {"role": "user", "content": f"{prompt}\n\n以下是內容：{transcription}"}
            ],
            max_tokens=1000,
        )

        result = completion.choices[0].message.content
        print("✅ 成功取得分析結果")
        return JSONResponse({"success": True, "analysis": result})

    except Exception as e:
        print("❌ 發生錯誤：", str(e))
        raise HTTPException(status_code=500, detail=f"AI分析失敗：{str(e)}")