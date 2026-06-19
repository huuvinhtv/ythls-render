import express from "express";
import { exec } from "child_process";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// Cho phép tất cả các nguồn truy cập để tránh lỗi CORS khi nhúng vào web/player
app.use(cors());

app.get("/", (req, res) => {
  res.send("YT-Direct Redirect Server (H.264 1080p Mode) is running...");
});

/**
 * Hàm lấy URL luồng trực tiếp từ YouTube
 * Ép buộc định dạng AVC (H.264) và AAC (m4a) để đảm bảo tương thích 100%
 */
const getDirectUrl = (url) => {
  return new Promise((resolve, reject) => {
    // --user-agent: Giả lập trình duyệt Chrome để không bị YouTube chặn (403)
    // bestvideo[vcodec^=avc1][height<=1080]: Chỉ lấy H.264 tối đa 1080p
    // bestaudio[ext=m4a]: Chỉ lấy âm thanh AAC
    const cmd = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -g --format "bestvideo[vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]/best[vcodec^=avc1][ext=mp4]" ${url}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
        return;
      }
      // yt-dlp trả về 1 hoặc 2 dòng (nếu có audio), lấy dòng đầu tiên
      const urls = stdout.trim().split('\n');
      resolve(urls[0]);
    });
  });
};

// Route lấy link cho VOD (Video thông thường)
app.get("/video/:id", async (req, res) => {
  try {
    const url = `https://www.youtube.com/watch?v=${req.params.id}`;
    const directUrl = await getDirectUrl(url);
    console.log(`[REDIRECT] Video ${req.params.id} -> ${directUrl}`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] ${err}`);
    res.status(500).send("Lỗi lấy luồng: " + err);
  }
});

// Route lấy link cho Live Stream
app.get("/channel/:id", async (req, res) => {
  try {
    const url = `https://www.youtube.com/channel/${req.params.id}/live`;
    const directUrl = await getDirectUrl(url);
    console.log(`[REDIRECT] Channel ${req.params.id} -> ${directUrl}`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] ${err}`);
    res.status(500).send("Lỗi lấy luồng Live: " + err);
  }
});

app.listen(PORT, () => {
  console.log(`Server Redirect chạy tại Port: ${PORT}`);
});
