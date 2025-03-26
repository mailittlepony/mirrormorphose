const cameraSource = document.createElement('img');

let faceClassifier = null;
let eyeClassifier = null;
let faceCascadeFile = 'haarcascade_frontalface_default.xml';
let eyeCascadeFile = 'haarcascade_eye.xml';
let streaming = false;

let canvasOutput = null;

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

        // Draw red rectangle around the detected face
        let facePoint1 = new cv.Point(maxFace.x, maxFace.y);
        let facePoint2 = new cv.Point(maxFace.x + maxFace.width, maxFace.y + maxFace.height);
        cv.rectangle(src, facePoint1, facePoint2, [255, 0, 0, 255], 2);

        eyeClassifier.detectMultiScale(roiGray, eyes);

        // Filter eyes based on aspect ratio relative to the face's bounding box
        let validEyes = [];
        for (let i = 0; i < eyes.size(); ++i) {
            let eye = eyes.get(i);
            let aspectRatio = eye.width / eye.height;
            let eyeToFaceWidthRatio = eye.width / maxFace.width;
            let eyeToFaceHeightRatio = eye.height / maxFace.height;
            let aspectRatioThreshold = 0.5;
            let sizeThreshold = 0.1;

            if (aspectRatio > aspectRatioThreshold && eyeToFaceWidthRatio > sizeThreshold && eyeToFaceHeightRatio > sizeThreshold) {
                validEyes.push(eye);
            }
        }

        // Draw blue rectangles around detected eyes
        for (let i = 0; i < validEyes.length; i++) {
            let eye = validEyes[i];
            let eyePoint1 = new cv.Point(eye.x, eye.y);
            let eyePoint2 = new cv.Point(eye.x + eye.width, eye.y + eye.height);
            cv.rectangle(roiSrc, eyePoint1, eyePoint2, [0, 0, 255, 255], 2);
        }

        let eyeState = validEyes.length < 2 ? "closed" : "open";

        if (this.prevEyeState !== undefined && this.prevEyeState !== eyeState) {
            if (onEyeStateChange) {
                onEyeStateChange(eyeState);
            }
        }

        this.prevEyeState = eyeState;
        roiGray.delete();
        roiSrc.delete();
    } else {
        if (onHeadNotDetected && this.prevHeadState) {
            onHeadNotDetected();
        }
        this.prevHeadState = false;
    }

    this.prevHeadCenterX = undefined;
    this.prevHeadCenterY = undefined;

    if (canvasOutput) {
        cv.imshow(canvasOutput, src);
    }

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

