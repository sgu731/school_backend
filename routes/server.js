const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");

const app = express();
const upload = multer();

app.use(cors());

app.post("/whisper/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const whisperRes = await axios.post(
      "http://localhost:8000/whisper/transcribe",
      req.file.buffer,
      {
        headers: {
          "Content-Type": "audio/webm",
        },
      }
    );
    res.json({ text: whisperRes.data.text });
  } catch (e) {
    console.error("❌ Whisper 錯誤:", e.message);
    res.status(500).json({ error: "Whisper轉錄失敗" });
  }
});

app.listen(3001, () => {
  console.log("🟢 Node API running at http://localhost:3001");
});