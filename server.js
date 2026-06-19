import express from "express";
import { exec } from "child_process";

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("YT-Direct Redirect Server is running...");
});

// Hàm lấy link m3u8 gốc từ YouTube
const getDirectUrl = (url) => {
  return new Promise((resolve, reject) => {
    // Dùng --get-url để lấy link stream trực tiếp từ YouTube
    const cmd = `yt-dlp -g --format "best[ext=mp4][height<=1080]/best[ext=mp4]" ${url}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
        return;
      }
      resolve(stdout.trim());
    });
  });
};

// Router cho Video thường
app.get("/video/:id", async (req, res) => {
  try {
    const url = `https://www.youtube.com/watch?v=${req.params.id}`;
    const directUrl = await getDirectUrl(url);
    res.redirect(directUrl);
  } catch (err) {
    res.status(500).send("Không thể lấy link trực tiếp: " + err);
  }
});

// Router cho Channel Live
app.get("/channel/:id", async (req, res) => {
  try {
    const url = `https://www.youtube.com/channel/${req.params.id}/live`;
    const directUrl = await getDirectUrl(url);
    res.redirect(directUrl);
  } catch (err) {
    res.status(500).send("Không thể lấy link Live: " + err);
  }
});

app.listen(PORT, () => {
  console.log(`Server Redirect chạy tại Port: ${PORT}`);
});
