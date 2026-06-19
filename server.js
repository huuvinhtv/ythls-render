import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;
const STREAM_DIR = "./streams";

// Tạo thư mục gốc chứa stream nếu chưa có
if (!fs.existsSync(STREAM_DIR)) {
  fs.mkdirSync(STREAM_DIR, { recursive: true });
}

app.use("/streams", express.static(STREAM_DIR));

app.get("/", (req, res) => {
  res.send("YT-HLS Proxy (1080p Supported) is running...");
});

// Lưu trữ các tiến trình đang chạy và thời gian truy cập cuối
const activeStreams = {};
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 phút không ai xem sẽ tự tắt

// =========================
// HỆ THỐNG DỌN RÁC (Garbage Collector)
// =========================
setInterval(() => {
  const now = Date.now();
  for (const [id, stream] of Object.entries(activeStreams)) {
    if (now - stream.lastAccessed > IDLE_TIMEOUT_MS) {
      console.log(`[CLEANUP] Tự động tắt stream [${id}] do không có người xem.`);
      
      // Kill tiến trình
      stream.ffmpeg.kill('SIGKILL');
      stream.ytdlp.kill('SIGKILL');
      delete activeStreams[id];

      // Xóa thư mục chứa file .ts và .m3u8 để giải phóng ổ cứng
      const streamPath = path.join(STREAM_DIR, id);
      if (fs.existsSync(streamPath)) {
        fs.rmSync(streamPath, { recursive: true, force: true });
      }
    }
  }
}, 60000); // Quét mỗi 60 giây

// =========================
// HÀM XỬ LÝ CHUNG CHO VOD VÀ LIVE
// =========================
const handleStream = (req, res, streamId, ytUrl, isLive) => {
  const streamPath = path.join(STREAM_DIR, streamId);
  const m3u8File = path.join(streamPath, "index.m3u8");

  if (!fs.existsSync(streamPath)) {
    fs.mkdirSync(streamPath, { recursive: true });
  }

  // Nếu tiến trình chưa chạy, bắt đầu tạo mới
  if (!activeStreams[streamId]) {
    console.log(`[START] Đang khởi tạo luồng cho: ${streamId}`);

    // CẤU HÌNH YT-DLP:
    const format = isLive ? "best" : "bestvideo[height<=1080]+bestaudio/best";
    
    const ytdlpArgs = [
      "-f", format,
      "--merge-output-format", "mkv", // ĐÃ FIX: Đổi từ mpegts sang mkv
      "-o", "-",
      ytUrl
    ];

    const ytdlp = spawn("yt-dlp", ytdlpArgs);

    // CẤU HÌNH FFMPEG:
    // -hls_list_size 10 & delete_segments: Chỉ giữ 10 file (chống tràn ổ cứng)
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

    // Nối dữ liệu từ yt-dlp sang ffmpeg
    ytdlp.stdout.pipe(ffmpeg.stdin);

    // Lưu vào bộ nhớ để quản lý
    activeStreams[streamId] = { 
      ytdlp, 
      ffmpeg, 
      lastAccessed: Date.now() 
    };

    // Log lỗi để dễ debug (Render sẽ hiện cái này nếu có lỗi mới)
    ytdlp.stderr.on('data', (data) => console.log(`[YT-DLP ${streamId}]:`, data.toString().trim()));
    
    ffmpeg.on('close', () => {
      console.log(`[STOP] Tiến trình FFmpeg [${streamId}] đã đóng.`);
      delete activeStreams[streamId];
    });

  } else {
    // Nếu stream đang chạy, cập nhật lại thời gian truy cập (reset thời gian đếm ngược 5 phút)
    activeStreams[streamId].lastAccessed = Date.now();
  }

  // =========================
  // CHỜ FILE M3U8 RỒI MỚI REDIRECT
  // =========================
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (fs.existsSync(m3u8File)) {
      clearInterval(checkInterval);
      res.redirect(`/streams/${streamId}/index.m3u8`);
    } else if (attempts >= 25) { // Timeout sau 25 giây
      clearInterval(checkInterval);
      if (!res.headersSent) {
        res.status(500).send("Lỗi Timeout: Tải và xử lý stream quá lâu.");
      }
    }
  }, 1000);
};

// =========================
// ROUTER VOD (Video thường)
// =========================
app.get("/video/:id.m3u8", (req, res) => {
  const videoId = req.params.id;
  handleStream(req, res, videoId, `https://www.youtube.com/watch?v=${videoId}`, false);
});

// =========================
// ROUTER LIVE (Kênh trực tiếp)
// =========================
app.get("/channel/:id.m3u8", (req, res) => {
  const channelId = req.params.id;
  handleStream(req, res, channelId, `https://www.youtube.com/channel/${channelId}/live`, true);
});

app.listen(PORT, () => {
  console.log(`Server chạy thành công tại Port: ${PORT}`);
});
