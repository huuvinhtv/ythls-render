import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

const STREAM_DIR = "./streams";
if (!fs.existsSync(STREAM_DIR)) {
  fs.mkdirSync(STREAM_DIR);
}

app.use("/streams", express.static(STREAM_DIR));

// =========================
// HEALTH CHECK (chống sleep)
// =========================
app.get("/", (req, res) => {
  res.send("YT-HLS Render is running...");
});

// =========================
// Stream từ YouTube VIDEO ID (Cho video bình thường / VOD)
// =========================
app.get("/video/:id.m3u8", (req, res) => {
  const videoId = req.params.id;
  const streamPath = path.join(STREAM_DIR, videoId);
  const m3u8File = path.join(streamPath, "index.m3u8");

  if (!fs.existsSync(streamPath)) {
    fs.mkdirSync(streamPath);

    // FIX: Dùng -hls_list_size 0 và bỏ delete_segments để xem trọn vẹn video dài
    const cmd = `
      yt-dlp -f best -o - https://www.youtube.com/watch?v=${videoId} | \
      ffmpeg -i pipe:0 -c:v copy -c:a copy \
      -f hls -hls_time 10 -hls_list_size 0 \
      ${m3u8File}
    `;

    exec(cmd);
  }

  res.redirect(`/streams/${videoId}/index.m3u8`);
});

// =========================
// Stream từ YouTube CHANNEL (Cho luồng trực tiếp / Live Stream)
// =========================
app.get("/channel/:id.m3u8", (req, res) => {
  const channelId = req.params.id;
  const streamPath = path.join(STREAM_DIR, channelId);
  const m3u8File = path.join(streamPath, "index.m3u8");

  if (!fs.existsSync(streamPath)) {
    fs.mkdirSync(streamPath);

    // Dùng cấu hình bộ nhớ đệm xoay vòng cho Live Stream
    const cmd = `
      yt-dlp -f best -o - https://www.youtube.com/channel/${channelId}/live | \
      ffmpeg -i pipe:0 -c:v copy -c:a copy \
      -f hls -hls_time 4 -hls_list_size 6 -hls_flags delete_segments \
      ${m3u8File}
    `;

    exec(cmd);
  }

  res.redirect(`/streams/${channelId}/index.m3u8`);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
