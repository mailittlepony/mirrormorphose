const cameraSource = document.createElement('img');

let faceClassifier = null;
let eyeClassifier = null;
let faceCascadeFile = 'haarcascade_frontalface_default.xml';
let eyeCascadeFile = 'haarcascade_eye.xml';
let streaming = false;

let onHeadDetected = null;
let onHeadPositionChange = null;
let onEyeStateChange = null;
let onHeadNotDetected = null;

function createFileFromUrl(path, url, callback) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load ' + url + ' status: ' + response.status);
            }
            return response.arrayBuffer();
        })
        .then(data => {
            let uint8Array = new Uint8Array(data);
            cv.FS_createDataFile('/', path, uint8Array, true, false, false);
            callback();
        })
        .catch(error => {
            console.error(error.message);
        });
}

function openCvReady() {
    cv['onRuntimeInitialized']=()=>{ 
        console.log("OpenCV loaded !")

        faceClassifier = new cv.CascadeClassifier();
        eyeClassifier = new cv.CascadeClassifier();

        createFileFromUrl(faceCascadeFile, "models/" + faceCascadeFile, () => {
            faceClassifier.load(faceCascadeFile);
        });
        createFileFromUrl(eyeCascadeFile, "models/" + eyeCascadeFile, () => {
            eyeClassifier.load(eyeCascadeFile);
        });
    };
}

function processImage(img) {
    const src = cv.imread(img);
    let gray = new cv.Mat();
    let faces = new cv.RectVector();
    let eyes = new cv.RectVector();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    let msize = new cv.Size(0, 0);
    faceClassifier.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);

    let maxFace = null;
    let maxFaceArea = 0;

    // Step 1: Find the largest face based on area
    for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        let faceArea = face.width * face.height; // Area of the face

        if (faceArea > maxFaceArea) {
            maxFaceArea = faceArea;
            maxFace = face; // Keep the largest face
        }
    }

    // Step 2: If a face was detected
    if (maxFace) {
        let centerX = maxFace.x + maxFace.width / 2;
        let centerY = maxFace.y + maxFace.height / 2;

        if (onHeadDetected && !this.prevHeadState) {
            onHeadDetected(centerX, centerY);
        }
        this.prevHeadState = true;

        // Check if the head position has changed significantly
        if (this.prevHeadCenterX !== undefined && this.prevHeadCenterY !== undefined) {
            let headMoveThreshold = 20; // Change threshold (you can adjust this)
            let dx = Math.abs(centerX - this.prevHeadCenterX);
            let dy = Math.abs(centerY - this.prevHeadCenterY);

            if (dx > headMoveThreshold || dy > headMoveThreshold) {
                // Call onHeadPositionChange callback when the head position changes
                if (onHeadPositionChange) {
                    onHeadPositionChange(centerX, centerY);
                }
            }
        }

        // Store current head position for future comparisons
        this.prevHeadCenterX = centerX;
        this.prevHeadCenterY = centerY;

        let roiGray = gray.roi(maxFace); // Region of interest in gray scale
        let roiSrc = src.roi(maxFace);   // Region of interest in original image

        eyeClassifier.detectMultiScale(roiGray, eyes);

        // Filter eyes based on aspect ratio relative to the face's bounding box
        let validEyes = [];
        for (let i = 0; i < eyes.size(); ++i) {
            let eye = eyes.get(i);
            // Calculate the aspect ratio of the eye compared to the face's width and height
            let aspectRatio = eye.width / eye.height;
            let eyeToFaceWidthRatio = eye.width / maxFace.width;
            let eyeToFaceHeightRatio = eye.height / maxFace.height;

            // Apply the aspect ratio threshold (adjust this threshold as necessary)
            let aspectRatioThreshold = 0.2; // Adjust based on your requirements
            let sizeThreshold = 0.05; // Threshold for minimum size relative to the face

            if (aspectRatio > aspectRatioThreshold &&
                eyeToFaceWidthRatio > sizeThreshold && 
                eyeToFaceHeightRatio > sizeThreshold) {
                validEyes.push(eye);
            }
        }

        // Determine eyeState based on the number of valid eyes
        let eyeState;
        if (validEyes.length < 2) {
            eyeState = "closed";
        } else if (validEyes.length === 2) {
            eyeState = "open";
        }

        // Call the onEyeStateChange callback when the eye state changes
        if (this.prevEyeState !== undefined && this.prevEyeState !== eyeState) {
            if (onEyeStateChange) {
                onEyeStateChange(eyeState);
            }
        }

        // Store the current eye state for future comparison
        this.prevEyeState = eyeState;

        roiGray.delete();
        roiSrc.delete();
    } else {
        if (onHeadNotDetected && this.prevHeadState) {
            onHeadNotDetected();
        }
        this.prevHeadState = false;
    }

    // Store that no head is detected in the current frame
    this.prevHeadCenterX = undefined;
    this.prevHeadCenterY = undefined;

    src.delete();
    gray.delete();
    faces.delete();
    eyes.delete();
}

function processFrame() {
    if (streaming) {
        processImage(cameraSource);
    } 
    requestAnimationFrame(processFrame);
}

function startDetection() {
    cameraSource.src = "stream.mjpg";
    cameraSource.style.display = "none";
    cameraSource.addEventListener('load', function() {
        processFrame();
    });
    document.body.appendChild(cameraSource);

    streaming = true;
}

function stopDetection() {
    streaming = false;
}

