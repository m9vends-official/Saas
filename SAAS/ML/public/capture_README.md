# Image Capture Client — Receiver API Specification

This document describes the HTTP API required by the backend service that receives images from the browser/WebView image-capture client.

The client captures frames from the device camera, converts each frame to JPEG, and sends the JPEG directly as the HTTP request body.

---

## 1. Endpoint

The backend must expose an HTTP `POST` endpoint.

Example:

```text
POST https://your-backend.example.com/capture
```

---

## 2. Device ID

The device ID is sent as a query parameter:

```http
?deviceID=<DEVICE_ID>
```

Example:

```http
POST /capture?deviceID=ESP32-001
```

Backend should read:

```text
deviceID = ESP32-001
```

### Important

The parameter name is exactly:

```text
deviceID
```

It is case-sensitive.

If the client was opened without a device ID, it sends:

```text
deviceID=unknown-device
```

The backend should therefore not assume that `deviceID` is always a valid registered device.

---

# 3. Request Format

The image is sent as the **raw HTTP request body**.

It is **NOT** sent using:

```text
multipart/form-data
```

Therefore, do NOT use a multipart file parser such as Multer-style handling.

The request looks like:

```http
POST /capture?deviceID=ESP32-001 HTTP/1.1
Host: your-backend.example.com
Content-Type: image/jpeg

<raw JPEG binary data>
```

The backend should read the entire request body as binary image data.

---

# 4. Content-Type

The client always sends:

```http
Content-Type: image/jpeg
```

The backend should treat the request body as a JPEG image.

---

# 5. Image Resolution

The client creates a canvas with:

```text
Width:  640 px
Height: 480 px
```

Therefore, the image sent to the backend is intended to be:

```text
640 × 480 pixels
```

Aspect ratio:

```text
4:3
```

The backend should not rely solely on the HTTP headers for the dimensions; if dimensions matter, they can be validated from the JPEG itself.

---

# 6. Image Format

Images are encoded as:

```text
JPEG
```

The browser generates the JPEG using:

```javascript
canvas.toBlob(
    callback,
    "image/jpeg",
    0.6
);
```

Therefore:

```text
Format: JPEG
Quality parameter: 0.6
```

The resulting file size is variable and depends on the actual image content.

The backend should **not assume a fixed image size in bytes**.

---

# 7. Capture / Upload Frequency

The client attempts to capture a frame every:

```text
250 ms
```

Therefore the theoretical maximum capture frequency is:

```text
1000 / 250 = 4 frames/second
```

or approximately:

```text
4 FPS
```

However, the client has an upload lock:

```javascript
let sending = false;
```

If the previous upload has not completed, the next frame is skipped.

Therefore the actual request rate can be **lower than 4 FPS** depending on network latency and backend response time.

The backend should be designed to handle approximately:

```text
Up to 4 POST requests/second/device
```

but should not assume that exactly 4 requests will arrive every second.

---

# 8. Request Lifecycle

The client performs the following:

```text
Camera
   │
   ▼
Video element
   │
   ▼
Canvas 640×480
   │
   ▼
JPEG encoding
   │
   │ quality = 0.6
   ▼
HTTP POST
   │
   ├── Query: deviceID
   ├── Content-Type: image/jpeg
   └── Body: raw JPEG bytes
   │
   ▼
Backend
```

---

# 9. Example Request

A real request will look conceptually like:

```http
POST /capture?deviceID=ESP32-001 HTTP/1.1
Content-Type: image/jpeg
Content-Length: <variable>

<JPEG binary bytes>
```

The backend should extract:

```text
deviceID → from query parameters
image    → from raw request body
```

---

# 10. Backend Response

After successfully receiving and processing the image, the backend should return a successful HTTP status.

Recommended:

```http
200 OK
```

Example JSON response:

```json
{
    "success": true
}
```

The client does not currently depend on any particular response JSON structure.

A simple:

```http
200 OK
```

is sufficient.

---

# 11. Error Responses

Recommended HTTP status codes:

| Status | Meaning                        |
| ------ | ------------------------------ |
| `200`  | Image received successfully    |
| `400`  | Invalid/missing request        |
| `401`  | Authentication required/failed |
| `403`  | Device not authorized          |
| `413`  | Image/request too large        |
| `415`  | Unsupported content type       |
| `429`  | Rate limit exceeded            |
| `500`  | Internal server error          |

The client currently logs failed requests in the browser console but does not implement special handling for individual HTTP error codes.

---

# 12. Validation Recommended on Backend

The receiver should validate at least:

### Content-Type

Expected:

```text
image/jpeg
```

### Device ID

Check:

```text
deviceID
```

is present and valid according to the application's device registry.

### Request body

Check that the body:

* is not empty
* contains valid JPEG data
* does not exceed the configured maximum request size

### Image dimensions

If required by the ML pipeline, validate that the decoded image is:

```text
640 × 480
```

---

# 13. Maximum Request Size

The client is expected to send relatively small JPEG images.

Nevertheless, the backend should configure a request-body limit.

A reasonable initial limit is:

```text
10 MB
```

This is intentionally much larger than a normal 640×480 JPEG and prevents accidentally enormous requests.

---

# 14. FastAPI Example

Example implementation:

```python
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()


@app.post("/capture")
async def capture(request: Request):

    device_id = request.query_params.get("deviceID")

    if not device_id:
        raise HTTPException(
            status_code=400,
            detail="Missing deviceID"
        )

    content_type = request.headers.get("content-type")

    if content_type != "image/jpeg":
        raise HTTPException(
            status_code=415,
            detail="Expected image/jpeg"
        )

    image_data = await request.body()

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="Empty image body"
        )

    # image_data contains the raw JPEG bytes

    print("Device:", device_id)
    print("Image size:", len(image_data), "bytes")

    # Process image_data here
    # e.g. OpenCV / PIL / ML model

    return {
        "success": True
    }
```

For production, add an explicit body-size limit and proper device authentication/authorization.

---

# 15. Flask Example

```python
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route("/capture", methods=["POST"])
def capture():

    device_id = request.args.get("deviceID")

    if not device_id:
        return jsonify({
            "error": "Missing deviceID"
        }), 400

    if request.content_type != "image/jpeg":
        return jsonify({
            "error": "Expected image/jpeg"
        }), 415

    image_data = request.get_data()

    if not image_data:
        return jsonify({
            "error": "Empty image body"
        }), 400

    print("Device:", device_id)
    print("Image size:", len(image_data), "bytes")

    # Process image_data here

    return jsonify({
        "success": True
    }), 200


if __name__ == "__main__":
    app.run(port=8000)
```

---

# 16. Saving the Received Image

For testing, the backend can save the raw JPEG:

```python
from pathlib import Path
import time

Path("received_images").mkdir(exist_ok=True)

filename = f"{device_id}_{int(time.time() * 1000)}.jpg"

with open(
    Path("received_images") / filename,
    "wb"
) as f:
    f.write(image_data)
```

Result:

```text
received_images/
├── ESP32-001_1758281234567.jpg
├── ESP32-001_1758281234821.jpg
└── ESP32-002_1758281235124.jpg
```

---

# 17. Using the Image Directly for ML

The image does not necessarily need to be saved to disk.

For example, with Python/Pillow:

```python
from io import BytesIO
from PIL import Image

image = Image.open(BytesIO(image_data))

print(image.size)
```

Expected:

```text
(640, 480)
```

With OpenCV:

```python
import numpy as np
import cv2

image = cv2.imdecode(
    np.frombuffer(image_data, np.uint8),
    cv2.IMREAD_COLOR
)
```

The resulting `image` can then be passed directly to the ML pipeline.

---

# 18. CORS

The image is uploaded using JavaScript `fetch()` from the WebViewer/browser.

Therefore, if the capture page and image backend are on different origins, the backend must allow the required CORS origin.

For development/testing, this can be configured broadly:

```text
Access-Control-Allow-Origin: *
```

For production, preferably restrict it to the actual application origin.

Note that CORS is a browser security requirement; it is not required for the backend to receive the HTTP request itself.

---

# 19. HTTPS Requirement

The capture client uses:

```javascript
navigator.mediaDevices.getUserMedia()
```

Camera access generally requires a secure context.

Therefore, when deployed publicly, the capture page should be served through:

```text
HTTPS
```

The image API should also preferably be exposed through:

```text
HTTPS
```

Example:

```text
https://capture.example.com/capture.html
```

and:

```text
https://ml.example.com/capture
```

---

# 20. Current Client Configuration

The current client is configured as follows:

```text
Camera:
    Front-facing camera
    facingMode = "user"

Resolution:
    640 × 480

Image format:
    JPEG

JPEG quality:
    0.6

Capture interval:
    250 ms

Maximum theoretical FPS:
    4 FPS

Audio:
    Disabled

Request method:
    POST

Request Content-Type:
    image/jpeg

Image location:
    Raw HTTP request body

Device ID:
    Query parameter: deviceID

Endpoint:
    /capture
```

---

# 21. Complete API Contract

The backend team can treat the API contract as:

```text
POST /capture?deviceID=<DEVICE_ID>

Headers:
    Content-Type: image/jpeg

Body:
    Raw JPEG binary data

Expected image:
    640 × 480 JPEG
    JPEG quality ≈ 0.6

Frequency:
    Up to ~4 requests/second/device

Response:
    HTTP 200
```

Example:

```http
POST https://ml.example.com/capture?deviceID=ESP32-001
Content-Type: image/jpeg

<raw JPEG bytes>
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
    "success": true
}
```

---

## Important Implementation Note

**Do not implement this endpoint as a multipart file upload.**

This client does **not** send:

```text
multipart/form-data
```

It sends:

```text
Content-Type: image/jpeg
```

with the JPEG itself directly as the request body.

The backend must therefore read the **raw request body as bytes** and decode those bytes as JPEG.
