# Device Wake-up & Registration API

Registers a new device or wakes up/updates the status and IP address of an existing device.

## Route

- **Method**: `POST`
- **URL**: `/api/device/wake-up`
- **Content-Type**: `application/json`

## Request Format

The request body must be a JSON object detailing the hardware configuration and runtime status of the device. `serialNumber` and `model` are required.

- `serialNumber` (string, required): Unique identifier for the device hardware.
- `model` (string, required): Model name of the device.
- `mac` (string, optional): MAC address of the device.
- `ip` (string, optional): Current IP address of the device.
- `status` (string, optional): Initial status of the device. Allowed values: `"online"`, `"offline"`.
- `components` (array, optional): List of subcomponents attached to the device. Each component contains:
  - `id` (number): Numeric identifier.
  - `catagory` (string): Component category (e.g. "sensor").
  - `name` (string): Human-readable name.
  - `type` (string): Allowed values: `"sensor"`, `"accutator"`.

### Example Request

```json
{
  "serialNumber": "SN-M9V-4820",
  "model": "M9-Vending-Pro",
  "mac": "00:1A:2B:3C:4D:5E",
  "ip": "192.168.1.55",
  "status": "online",
  "components": [
    {
      "id": 1,
      "catagory": "sensor",
      "name": "Temperature Sensor",
      "type": "sensor"
    }
  ]
}
```

## Response Format

### Success Responses (200 OK)

#### Case 1: Device is registered for the first time
```json
{
  "message": "Created New Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": {
    "url": "localhost",
    "port": 1883,
    "username": "Device",
    "password": "Device@123"
  },
  "topics": {
    "pub": ["telemetry", "status"],
    "sub": ["commands"]
  },
  "isProvisioned": false
}
```

#### Case 2: Device already exists in DB but is not owned (unprovisioned)
```json
{
  "message": "Wakeup Existing Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": {
    "url": "localhost",
    "port": 1883,
    "username": "Device",
    "password": "Device@123"
  },
  "topics": {
    "pub": ["telemetry", "status"],
    "sub": ["commands"]
  },
  "isProvisioned": false
}
```

#### Case 3: Device already exists in DB and is owned (provisioned)
```json
{
  "message": "Wakeup Existing Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": {
    "url": "localhost",
    "port": 1883,
    "username": "Device",
    "password": "Device@123"
  },
  "topics": {
    "pub": ["telemetry", "status"],
    "sub": ["commands"]
  },
  "isProvisioned": true,
  "kioskBrowserURL": "https://kiosk.m9vends.com/60d5ec49f3e4e9001f3b2e75"
}
```

## Error Responses

### 400 Bad Request

Returned if request payload is completely missing or is null.

```json
{
  "message": "Bad Request"
}
```

### 500 Internal Server Error

Returned if schema validation fails (e.g., missing `serialNumber` or `model`) or database operations encounter issues.

```json
{
  "message": "Something Went Wrong"
}
```
