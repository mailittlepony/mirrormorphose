import io
import logging
import subprocess
import socketserver
from http import server
from threading import Condition
import os
from backgroundremover.bg import remove
from PIL import Image, ImageFilter
from io import BytesIO
import numpy as np

from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

def refine_edges(image_with_alpha):
    alpha_channel = np.array(image_with_alpha.convert("RGBA"))[:, :, 3]
    alpha_channel = Image.fromarray(alpha_channel).filter(ImageFilter.GaussianBlur(2))
    image_with_alpha.putalpha(alpha_channel)

    return image_with_alpha

def add_black_background(input_image):
    image_with_alpha = input_image.convert("RGBA")
    black_background = Image.new("RGBA", image_with_alpha.size, (0, 0, 0, 255))
    black_background.paste(image_with_alpha, (0, 0), mask=image_with_alpha)

    return black_background

def remove_background(input_path, output_path):
    cmd = [
        "backgroundremover", "-i", input_path, "-o", output_path, "--alpha-matting"
    ]

    subprocess.run(cmd, check=True)

    image = Image.open(output_path)
    refined_image = refine_edges(image)
    black_background = add_black_background(refined_image)
    black_background.save(output_path, format="PNG")

class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()


class StreamingHandler(server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(301)
            self.send_header('Location', '/index.html')
            self.end_headers()
        elif self.path == '/stream.mjpg':
            self.send_response(200)
            self.send_header('Age', 0)
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
            self.end_headers()
            try:
                while True:
                    with output.condition:
                        output.condition.wait()
                        frame = output.frame
                    self.wfile.write(b'--FRAME\r\n')
                    self.send_header('Content-Type', 'image/jpeg')
                    self.send_header('Content-Length', len(frame))
                    self.end_headers()
                    self.wfile.write(frame)
                    self.wfile.write(b'\r\n')
            except Exception as e:
                logging.warning(
                    'Removed streaming client %s: %s',
                    self.client_address, str(e))

        elif self.path == '/get_child_img':
            self.send_response(200)
            self.send_header('Content-type', 'image/jpeg')
            self.end_headers()

            img_filename = 'assets/image/output.png'
            print("removing background...")
            remove_background("assets/image/input.jpg", img_filename)
            with open(img_filename, 'rb') as img_file:
                self.wfile.write(img_file.read())
            print("background removed")
            
        else:
            file_path = '.' + self.path
            if os.path.isfile(file_path):
                self.send_response(200)
                if self.path.endswith('.html'):
                    self.send_header('Content-Type', 'text/html')
                elif self.path.endswith('.js'):
                    self.send_header('Content-Type', 'application/javascript')
                elif self.path.endswith('.css'):
                    self.send_header('Content-Type', 'text/css')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')

                self.send_header('Content-Length', os.path.getsize(file_path))
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404)
                self.end_headers()


class StreamingServer(socketserver.ThreadingMixIn, server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


picam2 = Picamera2()
picam2.configure(picam2.create_video_configuration(main={"size": (640, 480)}))
# picam2.configure(picam2.create_video_configuration(main={"size": (1920, 1080)}))
output = StreamingOutput()
picam2.start_recording(JpegEncoder(), FileOutput(output))

try:
    address = ('', 8000)
    server = StreamingServer(address, StreamingHandler)
    server.serve_forever()
finally:
    picam2.stop_recording()

