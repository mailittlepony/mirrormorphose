/**
 * @class       : script
 * @author      : mailitg (mailitg@$HOSTNAME)
 * @created     : Wednesday Feb 26, 2025 13:56:07 CET
 * @description : script
 */

document.addEventListener("DOMContentLoaded", function () {
    const imageInput = document.getElementById("imageInput");
    const preview = document.getElementById("preview");
    const generateBtn = document.getElementById("generateBtn");
    const videoResult = document.getElementById("video-result"); 
    const videoContainer = document.getElementById("video-container");
    const useTestVideo = true; // Change to false to use the API video
    let firstFrameTrimmed = false;

    imageInput.addEventListener("change", function () {
        const file = imageInput.files[0];
        if (file) {
            preview.style.backgroundColor = "black"; 
            preview.style.display = "block";
            preview.style.backgroundImage = "";
        }
    });

    generateBtn.addEventListener("click", async function () {
        const file = imageInput.files[0];

        if (!file) {
            alert("Please upload an image.");
            return;
        }

        videoContainer.style.height = "100vh";
        videoContainer.style.width = "100%";
        document.querySelectorAll("button, input").forEach(el => el.classList.add("hidden"));
        if (useTestVideo) {
            // const videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; 
            const videoUrl = "http://localhost:8001/videos/test.mp4"; 
            videoResult.src = videoUrl;
            videoResult.load();
            videoResult.style.display = "block";
            videoResult.style.opacity = "0";
            videoContainer.style.display = "block";
        } else {
            try {
                const formData = new FormData();
                formData.append("image", file);

                const response = await fetch("http://localhost:8000/generate-video", {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();
                console.log("Server Response:", result);

                if (response.ok && result.videoUrl) {
                    console.log("Setting video URL:", result.videoUrl);
                    videoResult.src = result.videoUrl;
                    videoResult.load();
                    videoResult.style.display = "block";
                    videoContainer.style.display = "block";
                    videoResult.style.opacity = "0";
                } else {
                    console.error("Video generation failed:", result);
                    alert("Video generation failed. See console for details.");
                }
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred while generating the video.");
            }
        }
    });

    //keyboard handling
    document.addEventListener(("keydown"), function (event) {
        if (event.key === "p")
        {
            firstFrameTrimmed = false;
            videoResult.currentTime = 0;
            videoResult.loop = false;

            videoResult.style.opacity = "1";
            videoResult.style.transition = "opacity 1s ease";
            videoResult.play();

            videoResult.onended = function () {
                if (!firstFrameTrimmed) {
                    firstFrameTrimmed = true;
                    videoResult.currentTime = 3.5;
                    videoResult.play();
                } else {
                    if (videoResult.currentTime >= videoResult.duration - 0.1) {
                        videoResult.currentTime = 3.5;
                        videoResult.play();
                    }
                }

            };
        }

        if (event.key ==="q")
        {
            videoResult.pause();
            videoResult.currentTime = 0;
            videoResult.loop = false;
            firstFrameTrimmed = false;
            videoResult.style.opacity = "0";
            videoResult.onended = null;
        }
        });
    });


