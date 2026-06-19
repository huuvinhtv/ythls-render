import express from "express";
import { exec } from "child_process";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// Cho phép tất cả các nguồn truy cập để tránh lỗi CORS khi gắn vào Web/App
app.use(cors());

app.get("/", (req, res) => {
  res.send("YT-Direct Redirect Server (Pre-muxed Video+Audio) is running...");
});

/**
 * Hàm lấy URL luồng trực tiếp từ YouTube
 * Dùng format "best[ext=mp4]/best" để bắt buộc lấy file gộp sẵn cả hình và tiếng.
 * Giới hạn cao nhất của định dạng gộp sẵn này trên YouTube là 720p.
 */
const getDirectUrl = (url) => {
  return new Promise((resolve, reject) => {
    const cmd = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -g --format "best[ext=mp4]/best" ${url}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
        return;
      }
      
      // Lúc này yt-dlp sẽ trả về 1 link duy nhất chứa cả hình và tiếng
      const directLink = stdout.trim().split('\n')[0];
      resolve(directLink);
    });
  });
};

// =========================
// Router cho VOD (Video thường)
// =========================
app.get("/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    // Bỏ đuôi .m3u8 nếu có người dùng gọi nhầm link cũ
    const cleanId = videoId.replace('.m3u8', ''); 
    const url = `https://www.youtube.com/watch?v=${cleanId}`;
    
    const directUrl = await getDirectUrl(url);
    console.log(`[REDIRECT] Video ${cleanId} -> Lấy link thành công`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] Video: ${err}`);
    res.status(500).send("Không thể lấy link trực tiếp. Lỗi: " + err);
  }
});

// =========================
// Router cho Live Stream
// =========================
app.get("/channel/:id", async (req, res) => {
  try {
    const channelId = req.params.id;
    // Bỏ đuôi .m3u8 nếu có
    const cleanId = channelId.replace('.m3u8', '');
    const url = `https://www.youtube.com/channel/${cleanId}/live`;
    
    const directUrl = await getDirectUrl(url);
    console.log(`[REDIRECT] Channel Live ${cleanId} -> Lấy link thành công`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] Channel: ${err}`);
    res.status(500).send("Không thể lấy link Live trực tiếp. Lỗi: " + err);
  }
});

app.listen(PORT, () => {
  console.log(`Server Redirect chạy thành công tại Port: ${PORT}`);
});
