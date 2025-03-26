/**
 * @class       : server
 * @author      : mailitg (mailitg@$HOSTNAME)
 * @created     : Wednesday Feb 26, 2025 13:58:37 CET
 * @description : server
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const RunwayML = require("@runwayml/sdk");

require("dotenv").config();

const app = express();
const PORT = 8001;
const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));
app.use(express.json());

// Ensure the directory for image storage exists
const imageDir = path.join(__dirname, "assets", "image");
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

const imagePath = path.join(imageDir, "input.jpg");

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imageDir);
  },
  filename: function (req, file, cb) {
    cb(null, "input.jpg"); // Always saves as 'input.jpg'
  }
});

const upload = multer({ storage });

app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    console.log("Image uploaded and saved at:", imagePath);
    res.json({ message: "Image uploaded successfully", path: imagePath });

  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Image processing failed.", details: error.message });
  }
});

app.post("/generate-video", async (req, res) => {
  try {
    const response = await axios.get("http://raspberrypi.local:8000/get_child_img", {
      responseType: "arraybuffer",
    });

    if (response.status !== 200) {
      return res.status(500).json({ error: "Failed to fetch processed image" });
    }

    const imageBuffer = Buffer.from(response.data);
    const imageSize = imageBuffer.length;
    console.log("Fetched Image Size (in bytes):", imageSize);

    if (imageSize > 1024 * 1024 * 5) {
      return res.status(400).json({ error: "Image size exceeds 5MB limit." });
    }

    const mimeType = "jpeg";
    const base64String = imageBuffer.toString("base64");
    const dataUri = `data:image/${mimeType};base64,${base64String}`;

    console.log("Base64 String Length:", base64String.length);
    console.log("Data URI (first 100 chars):", dataUri.slice(0, 100) + "...");

    const imageToVideo = await client.imageToVideo.create({
      model: "gen3a_turbo",
      promptImage: dataUri,
      promptText: "A young kid, around 10 years old, sits still. He maintains a serious expression and direct eye contact with the camera. The camera is completely still, with soft natural lighting. The kid nods slowly at the 3-second marks, blinks naturally, and occasionally tilts his head slightly, creating a natural and realistic effect. The video is 10 seconds long.",
      duration: 10,
    });

    const taskId = imageToVideo.id;
    let task;

    do {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      task = await client.tasks.retrieve(taskId);
    } while (!["SUCCEEDED", "FAILED"].includes(task.status));

    if (task.status === "SUCCEEDED") {
      console.log("Full task response:", JSON.stringify(task, null, 2));
      console.log("Generated video URL:", task.output[0]);
      res.json({ videoUrl: task.output[0] });
    } else {
      console.error("Task failed:", task);
      res.status(500).json({ error: "Video generation failed.", details: task });
    }
  } catch (error) {
    console.error("Error during video generation:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

