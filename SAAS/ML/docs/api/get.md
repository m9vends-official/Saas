# Get Device(s) API

Retrieves a single device's configuration and status by device ID, or a list of all devices associated with a specific user ID.

## Route

- **Method**: `GET`
- **URL**: `/api/device/:type/:id`

## Request Format

This route uses two URL path parameters:

- `type` (string, required): The query type. Allowed values:
  - `"device"`: Retrieve a single device.
  - `"user"`: Retrieve all devices owned by the user.
- `id` (string, required): The 24-character hexadecimal MongoDB ObjectId of either the device or user, depending on the `type`.

### Example Requests

- **Single Device Lookup**: `GET /api/device/device/60d5ec49f3e4e9001f3b2e99`
- **User Devices Lookup**: `GET /api/device/user/60d5ec49f3e4e9001f3b2e75`

## Response Format

### Success Responses (200 OK)

#### Case 1: When querying `type = device`

Returns a single device object.

```json
{
  "device": {
    "_id": "60d5ec49f3e4e9001f3b2e99",
    "serialNumber": "SN-M9V-4820",
    "model": "M9-Vending-Pro",
    "mac": "00:1A:2B:3C:4D:5E",
    "ip": "192.168.1.55",
    "status": "online",
    "components": []
  },
  "message": "device fetched successfully"
}
```

#### Case 2: When querying `type = user`

Returns an array of device objects.

```json
{
  "device": [
    {
      "_id": "60d5ec49f3e4e9001f3b2e99",
      "serialNumber": "SN-M9V-4820",
      "model": "M9-Vending-Pro",
      "mac": "00:1A:2B:3C:4D:5E",
      "ip": "192.168.1.55",
      "status": "online",
      "components": []
    }
  ],
  "message": "devices fetched successfully"
}
```

## Error Responses

### When querying `type = device`

#### 400 Bad Request (Invalid Device ID format)

Returned if `id` is not a valid 24-character hexadecimal ObjectId format, OR if the device does not exist in the database (due to internal handler catching all query errors as `400 Invalid Device ID`).

```json
{
  "message": "Invalid Device ID"
}
```

---

### When querying `type = user`

#### 400 Bad Request (Invalid User ID format)

Returned if the `id` path parameter is not a valid 24-character hexadecimal ObjectId format.

```json
{
  "message": "Invalid User ID"
}
```

#### 404 Not Found (User Not Exists)

Returned if the user with the specified `id` does not exist in the database.

```json
{
  "message": "User Not Exists"
}
```

#### 404 Not Found (No Devices Found)

Returned if the user exists but has no devices registered or provisioned.

```json
{
  "message": "No Devices Found"
}
```
