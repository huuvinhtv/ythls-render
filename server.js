import express from "express";
import { exec } from "child_process";

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("YT-Direct Redirect Server is running...");
});

const getDirectUrl = (url) => {
  return new Promise((resolve, reject) => {
    // Thêm --user-agent giả lập trình duyệt và --format để ép lấy 1080p
    const cmd = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -g --format "bestvideo[height<=1080]+bestaudio/best" ${url}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
        return;
      }
      // Khi tải format phức tạp (video+audio), yt-dlp trả về 2 dòng link
      // Chúng ta cần lấy link đầu tiên hoặc sử dụng --get-url
      resolve(stdout.trim().split('\n')[0]);
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
