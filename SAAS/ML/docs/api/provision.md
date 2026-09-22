# Provision Device API

Provisions a registered/configured device to a user.

## Route

- **Method**: `POST`
- **URL**: `/api/device/provision`
- **Content-Type**: `application/json`

## Request Format

The request body must be a JSON object containing the device serial number and the target user ID:

- `serialNumber` (string, required): The unique hardware serial number of the device.
- `userID` (string, required): The 24-character hexadecimal MongoDB ObjectId of the user.

### Example Request

```json
{
  "serialNumber": "SN-M9V-4820",
  "userID": "60d5ec49f3e4e9001f3b2e75"
}
```

## Response Format

### Success Response (200 OK)

Returns the provisioned device's system virtual ID (`vid`) and a confirmation message.

```json
{
  "vid": "60d5ec49f3e4e9001f3b2e99",
  "message": "Provisioning Successful"
}
```

### Error Responses

#### 400 Bad Request (Missing fields)

Returned if either `serialNumber` or `userID` is missing from the request body.

```json
{
  "message": "Bad Request"
}
```

#### 400 Bad Request (Invalid User ID format)

Returned if `userID` is not a valid 24-character hexadecimal ObjectId.

```json
{
  "message": "Invalid User ID"
}
```

#### 404 Not Found (User Not Found)

Returned if the user with the specified `userID` does not exist in the database.

```json
{
  "message": "User Not Found"
}
```

#### 404 Not Found (Device Not Configured)

Returned if a device with the specified `serialNumber` has not registered or woken up yet.

```json
{
  "message": "Device Not Configured"
}
```

#### 409 Conflict (Device Already Owned)

Returned if the device with the specified `serialNumber` is already provisioned to another owner.

```json
{
  "message": "Device Already Owned"
}
```

#### 500 Internal Server Error (Couldn't Reach Device)

Returned if the service fails to contact the device via MQTT.

```json
{
  "message": "Couldn't Reach Device, Please try restarting it..."
}
```
