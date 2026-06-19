import express from "express";
import { exec } from "child_process";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// Bật CORS để tránh lỗi khi nhúng luồng vào Web Admin hoặc Player
app.use(cors());

// ==========================================
// HỆ THỐNG CACHE TRÁNH BỊ YOUTUBE BAN IP
// Link Direct của YouTube thường sống được khoảng 4-6 tiếng.
// Ta sẽ lưu link này lại trong RAM 2 tiếng để dùng chung cho mọi người xem.
// ==========================================
const streamCache = {};
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // Cache trong 2 giờ

app.get("/", (req, res) => {
  res.send("YT-Direct Playlist Router is running...");
});

/**
 * Hàm lấy URL luồng trực tiếp từ YouTube
 */
const getDirectUrl = (url, cacheKey) => {
  return new Promise((resolve, reject) => {
    
    // 1. Kiểm tra xem link đã có sẵn trong Cache chưa
    if (streamCache[cacheKey] && Date.now() < streamCache[cacheKey].expires) {
      console.log(`[CACHE HIT] Trả về link trực tiếp có sẵn cho: ${cacheKey}`);
      return resolve(streamCache[cacheKey].url);
    }

    console.log(`[FETCH] Đang lấy link YouTube gốc cho: ${cacheKey}`);
    
    // 2. Nếu chưa có, dùng yt-dlp ép lấy định dạng gộp sẵn MP4 (720p)
    const cmd = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -g --format "best[ext=mp4]/best" ${url}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
        return;
      }
      
      const directLink = stdout.trim().split('\n')[0];
      
      // 3. Lưu link vào Cache để tái sử dụng
      streamCache[cacheKey] = {
        url: directLink,
        expires: Date.now() + CACHE_TTL_MS
      };
      
      resolve(directLink);
    });
  });
};

// =========================
// ROUTER: VIDEO VOD
// =========================
app.get("/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    const cleanId = videoId.replace('.m3u8', ''); 
    const url = `https://www.youtube.com/watch?v=${cleanId}`;
    
    const directUrl = await getDirectUrl(url, `video_${cleanId}`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] VOD: ${err}`);
    res.status(500).send("Lỗi định tuyến VOD: " + err);
  }
});

// =========================
// ROUTER: CHANNEL LIVE
// =========================
app.get("/channel/:id", async (req, res) => {
  try {
    const channelId = req.params.id;
    const cleanId = channelId.replace('.m3u8', '');
    const url = `https://www.youtube.com/channel/${cleanId}/live`;
    
    const directUrl = await getDirectUrl(url, `live_${cleanId}`);
    res.redirect(directUrl);
  } catch (err) {
    console.error(`[ERROR] LIVE: ${err}`);
    res.status(500).send("Lỗi định tuyến Live: " + err);
  }
});

app.listen(PORT, () => {
  console.log(`Hệ thống định tuyến đang chạy tại Port: ${PORT}`);
});
