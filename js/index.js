/**
 * @class       : script
 * @author      : mailitg (mailitg@$HOSTNAME)
 * @created     : Wednesday Feb 26, 2025 13:56:07 CET
 * @description : script
 */

document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const preview = document.getElementById("preview");
    const generateBtn = document.getElementById("generateBtn");
    const videoResult = document.getElementById("video-result");
    const videoContainer = document.getElementById("video-container");
    const useTestVideo = true; // Set to false to use the API video
    let firstFrameTrimmed = false;

    imageInput.addEventListener("change", () => {
        if (imageInput.files[0]) {
            preview.style.cssText = "background-color: black; display: block; background-image: none;";
        }
    });

    generateBtn.addEventListener("click", async () => {
        const file = imageInput.files[0];

        if (!file) {
            alert("Please upload an image.");
            return;
        }
        const uploadSuccess = await uploadImage(file);

        if (!uploadSuccess) {
            alert("Image upload failed.");
        }

        setupVideoContainer();

        // Start OpenCV face and eye detection
        onHeadDetected = (x, y) => { 
            console.log(`face detected: (${x}, ${y})`);
        };

        onEyeStateChange = (state) => { 
            console.log(`eyes ${state}`);
            if (state === "open") {
                playVideo();
            } else {
                stopVideo();
            }
        };

        console.log("start OpenCV detection");
        startDetection();

        if (useTestVideo) {
            playTestVideo();
        } else {
            try {
                const videoUrl = await generateVideo(file);
                if (videoUrl) playGeneratedVideo(videoUrl);
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred while generating the video.");
            }
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "p") {
            playVideo();
        } else if (event.key === "q") {
            stopVideo();
        }
    });

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await fetch("http://raspberrypi.local:8001/upload-image", {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            console.log("Upload Response:", result);

            return response.ok; // Return true if upload was successful
        } catch (error) {
            console.error("Image upload failed:", error);
            return false;
        }
    }

    function setupVideoContainer() {
        videoContainer.style.cssText = "height: 100vh; width: 100%; display: block;";
        document.querySelectorAll("button, input").forEach(el => el.classList.add("hidden"));
    }

    function playTestVideo() {
        const videoUrl = "assets/videos/test.mp4";
        playGeneratedVideo(videoUrl);
    }

    async function generateVideo(file) {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch("http://raspberrypi.local:8001/generate-video", {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        console.log("Server Response:", result);

        if (response.ok && result.videoUrl) {
            console.log("Setting video URL:", result.videoUrl);
            return result.videoUrl;
        } else {
            console.error("Video generation failed:", result);
            alert("Video generation failed. See console for details.");
            return null;
        }
    }

    function playGeneratedVideo(videoUrl) {
        videoResult.src = videoUrl;
        videoResult.load();
        videoResult.style.opacity = "0";
        videoResult.style.display = "block";
    }

    function playVideo() {
        firstFrameTrimmed = false;
        videoResult.currentTime = 0;
        videoResult.loop = false;
        videoResult.style.cssText = "opacity: 1; transition: opacity 1s ease;";
        videoResult.play();

        videoResult.onended = () => {
            if (!firstFrameTrimmed) {
                firstFrameTrimmed = true;
                videoResult.currentTime = 3.5;
                videoResult.play();
            } else if (videoResult.currentTime >= videoResult.duration - 0.1) {
                videoResult.currentTime = 3.5;
                videoResult.play();
            }
        };
    }

    function stopVideo() {
        videoResult.pause();
        videoResult.currentTime = 0;
        videoResult.loop = false;
        firstFrameTrimmed = false;
        videoResult.style.opacity = "0";
        videoResult.onended = null;
    }
});

