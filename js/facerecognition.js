const imageSource = document.getElementById('cameraSource');
const canvasOutput = document.getElementById('canvasOutput');
const ctx = canvasOutput.getContext('2d');
const startButton = document.getElementById('startButton');

let faceClassifier = null;
let eyeClassifier = null;
let faceCascadeFile = 'haarcascade_frontalface_default.xml';
let eyeCascadeFile = 'haarcascade_eye.xml';

let streaming = false;

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

        createFileFromUrl(faceCascadeFile, faceCascadeFile, () => {
            faceClassifier.load(faceCascadeFile);
        });
        createFileFromUrl(eyeCascadeFile, eyeCascadeFile, () => {
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

    // detect faces
    for (let i = 0; i < faces.size(); ++i) {
        let roiGray = gray.roi(faces.get(i));
        let roiSrc = src.roi(faces.get(i));
        let point1 = new cv.Point(faces.get(i).x, faces.get(i).y);
        let point2 = new cv.Point(faces.get(i).x + faces.get(i).width, faces.get(i).y + faces.get(i).height);
        cv.rectangle(src, point1, point2, [255, 0, 0, 255]);

        // detect eyes in face ROI
        eyeClassifier.detectMultiScale(roiGray, eyes);
        for (let j = 0; j < eyes.size(); ++j) {
            let point1 = new cv.Point(eyes.get(j).x, eyes.get(j).y);
            let point2 = new cv.Point(eyes.get(j).x + eyes.get(j).width,
                eyes.get(j).y + eyes.get(j).height);
            cv.rectangle(roiSrc, point1, point2, [0, 0, 255, 255]);
        }
        roiGray.delete(); roiSrc.delete();
    }

    cv.imshow(canvasOutput, src);

    src.delete();
    gray.delete(); 
    faces.delete(); 
    eyes.delete();
}

function clean() {
    faceClassifier.delete();
    eyeClassifier.delete(); 
}

function processFrame() {
    if (streaming) {
        processImage(cameraSource);
    } 
    requestAnimationFrame(processFrame);
}

cameraSource.addEventListener('load', function() {
    processFrame();
});

startButton.addEventListener("click", function() {
    if (this.innerHTML === "Start") {
        this.innerHTML = "Stop";
        streaming = true;
    } else if (this.innerHTML === "Stop") {
        this.innerHTML = "Start";
        streaming = false;
    }
});

