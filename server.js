import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;
const STREAM_DIR = "./streams";

if (!fs.existsSync(STREAM_DIR)) {
  fs.mkdirSync(STREAM_DIR, { recursive: true });
}

app.use("/streams", express.static(STREAM_DIR));

app.get("/", (req, res) => {
  res.send("YT-HLS Proxy (Strict H.264/AAC for Web) is running...");
});

const activeStreams = {};
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, stream] of Object.entries(activeStreams)) {
    if (now - stream.lastAccessed > IDLE_TIMEOUT_MS) {
      console.log(`[CLEANUP] Tự động tắt stream [${id}] do không có người xem.`);
      stream.ffmpeg.kill('SIGKILL');
      stream.ytdlp.kill('SIGKILL');
      delete activeStreams[id];

      const streamPath = path.join(STREAM_DIR, id);
      if (fs.existsSync(streamPath)) {
        fs.rmSync(streamPath, { recursive: true, force: true });
      }
    }
  }
}, 60000);

const handleStream = (req, res, streamId, ytUrl, isLive) => {
  const streamPath = path.join(STREAM_DIR, streamId);
  const m3u8File = path.join(streamPath, "index.m3u8");

  if (!fs.existsSync(streamPath)) {
    fs.mkdirSync(streamPath, { recursive: true });
  }

  if (!activeStreams[streamId]) {
    console.log(`[START] Đang khởi tạo luồng cho: ${streamId}`);

    // ==========================================
    // BỘ LỌC CỰC KỲ NGHIÊM NGẶT (STRICT CODEC FILTER)
    // vcodec^=avc: Bắt buộc lõi video phải là họ H.264 (avc1)
    // acodec^=mp4a: Bắt buộc lõi audio phải là họ AAC (mp4a)
    // ==========================================
    const format = isLive 
      ? "best[vcodec^=avc]" 
      : "bestvideo[vcodec^=avc][height<=1080]+bestaudio[ext=m4a]/best[vcodec^=avc]";
    
    const ytdlpArgs = [
      "-f", format,
      "--merge-output-format", "mkv",
      "-o", "-",
      ytUrl
    ];

    const ytdlp = spawn("yt-dlp", ytdlpArgs);

    const ffmpegArgs = [
      "-i", "pipe:0",
      "-c:v", "copy", "-c:a", "copy",
      "-f", "hls", 
      "-hls_time", "6",
      "-hls_list_size", "10",
      "-hls_flags", "delete_segments",
      m3u8File
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ytdlp.stdout.pipe(ffmpeg.stdin);

    activeStreams[streamId] = { 
      ytdlp, 
      ffmpeg, 
      lastAccessed: Date.now() 
    };

    ytdlp.stderr.on('data', (data) => {
      // In ra để bạn kiểm tra xem nó tải Codec gì (Nên thấy tải itag 137 hoặc 136 và 140)
      console.log(`[YT-DLP]`, data.toString().trim());
    });
    
    ffmpeg.on('close', () => {
      console.log(`[STOP] Tiến trình FFmpeg [${streamId}] đã đóng.`);
      delete activeStreams[streamId];
    });

  } else {
    activeStreams[streamId].lastAccessed = Date.now();
  }

  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (fs.existsSync(m3u8File)) {
      clearInterval(checkInterval);
      res.redirect(`/streams/${streamId}/index.m3u8`);
    } else if (attempts >= 25) { 
      clearInterval(checkInterval);
      if (!res.headersSent) {
        res.status(500).send("Lỗi Timeout: Tải và xử lý stream quá lâu.");
      }
    }
  }, 1000);
};

app.get("/video/:id.m3u8", (req, res) => {
  const videoId = req.params.id;
  handleStream(req, res, videoId, `https://www.youtube.com/watch?v=${videoId}`, false);
});

app.get("/channel/:id.m3u8", (req, res) => {
  const channelId = req.params.id;
  handleStream(req, res, channelId, `https://www.youtube.com/channel/${channelId}/live`, true);
});

app.listen(PORT, () => {
  console.log(`Server chạy thành công tại Port: ${PORT}`);
});
