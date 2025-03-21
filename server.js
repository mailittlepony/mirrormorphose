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
const RunwayML = require("@runwayml/sdk");

require("dotenv").config();

const app = express();
const PORT = 8000;
const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/generate-video", upload.single("image"), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const imageSize = imageBuffer.length;

        console.log("Image Size (in bytes):", imageSize);

        if (imageSize > 1024 * 1024 * 5) {
            return res.status(400).json({ error: "Image size exceeds 5MB limit." });
        }

        const mimeType = path.extname(req.file.originalname).slice(1); 
        console.log("MIME Type:", mimeType);

        if (!["jpeg", "jpg", "png", "webp"].includes(mimeType)) {
            return res.status(400).json({ error: "Unsupported image format. Only JPEG, PNG, and WebP are allowed." });
        }

        const base64String = imageBuffer.toString("base64");
        const dataUri = `data:image/${mimeType};base64,${base64String}`;


        console.log("Base64 String Length:", base64String.length);  
        console.log("Data URI:", dataUri.slice(0, 100) + "..."); 

        if (dataUri.length > 1024 * 1024 * 5) { 
            return res.status(400).json({ error: "Base64 encoded image exceeds 5MB limit." });
        }

        const imageToVideo = await client.imageToVideo.create({
            model: "gen3a_turbo",
            promptImage: dataUri,
            promptText: "A young kid, around 10 years old, sits still. He maintains a serious expression and direct eye contact with the camera. The camera is completely still, with soft natural lighting. The kid nods slowly at the 3-second marks, blinks naturally, and occasionally tilts his head slightly, creating a natural and realistic effect. The video is 10 seconds long",
            duration: 10,
        });

        const taskId = imageToVideo.id;

        let task;
        do {
            await new Promise((resolve) => setTimeout(resolve, 10000));  
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

