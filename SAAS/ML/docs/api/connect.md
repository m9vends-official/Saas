# Connect Device (Get MQTT Credentials) API

Generates JWT-based MQTT connection credentials for a provisioned device.

## Route

- **Method**: `GET`
- **URL**: `/api/device/connect/:id`

## Request Format

This route uses a URL path parameter to identify the device:

- `id` (string, required): The 24-character hexadecimal MongoDB ObjectId of the device.

### Example Request

`GET /api/device/connect/60d5ec49f3e4e9001f3b2e99`

## Response Format

### Success Response (200 OK)

Returns JWT credentials signed for the MQTT broker, along with the token's expiration time (defaults to 25 minutes).

```json
{
  "message": "Successfully generated mqtt credentials",
  "mqttCredentials": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfYXR0cnMiOnsiZGV2aWNlVklEIjoiNjBkNWVjNDlmM2U0ZTkwMDFmM2IyZTk5In0sImlhdCI6MTQ4MjI4ODAwMCwiZXhwIjoxNDgyMjg5NTAwfQ.signature",
    "expiresIn": "25m"
  }
}
```

### Error Responses

#### 400 Bad Request (Invalid Device ID format)

Returned if the URL path parameter `:id` is not a valid 24-character hexadecimal ObjectId.

```json
{
  "message": "Invalid Device ID"
}
```

#### 400 Bad Request (Device does not exist or has no owner)

Returned if the device is not found in the database, or is found but has not been provisioned to a user (i.e. does not have an owner).

```json
{
  "message": "Device doesn't exist, Invalid Id"
}
```
