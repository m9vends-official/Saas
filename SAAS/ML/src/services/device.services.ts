import mongoose from "mongoose";
import type { device, deviceInfo, mqttCredentials, mqttDeviceCredentials } from "../types/device.type.js";
import 'dotenv/config'
import { AppError } from "../config/error.config.js";
import jwt from 'jsonwebtoken'
import { Devices } from "../models/device.model.js";
import { User } from "../models/user.model.js";
import type { StringValue } from 'ms'
import { topicsForDevice } from "../config/topics.config.js";
import mqttClient from "../config/mqttBroker.config.js";

const getMqttDeviceCredentials = (): mqttDeviceCredentials => {
    try {
        return {
            url: process.env.MQTT_BROKER_URL as string,
            port: parseInt(process.env.MQTT_BROKER_PORT as string),
            username: process.env.MQTT_BROKER_Device_USERNAME as string,
            password: process.env.MQTT_BROKER_Device_PASSWORD as string
        }
    } catch (e) {
        throw new Error("Env variables Not Configured")
    }
}

export const wakeUpDevice = async (device: Omit<device, "owner">): Promise<deviceInfo> => {
    try {
        const alreadyDevice = await Devices.findOne({ serialNumber: device.serialNumber })
        if (alreadyDevice) {
            const isProvisioned = alreadyDevice.owner ? true : false
            const kioskBrowserURL = (process.env.KIOSK_BASE_URL as string) + alreadyDevice.owner
            if (alreadyDevice.ip !== device.ip) {
                const info = await Devices.updateOne({ serialNumber: device.serialNumber }, { ip: device.ip })
            }
            return {
                message: "Wakeup Existing Device",
                deviceVID: alreadyDevice._id,
                mqtt: getMqttDeviceCredentials(),
                topics: topicsForDevice,
                isProvisioned,
                kioskBrowserURL,
            }
        }
        const { _id } = await Devices.create(device)
        return {
            message: "Created New Device",
            deviceVID: _id,
            mqtt: getMqttDeviceCredentials(),
            topics: topicsForDevice,
            isProvisioned: false
        }
    } catch (e) {
        throw e
    }
}

export const provisionDevice = async (serialNumber: string, userID: string) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userID)) {
            throw new AppError("Invalid User ID", 400)
        }
        const id = new mongoose.Types.ObjectId(userID)
        const user = await User.findById(userID)
        if (!user) {
            throw new AppError("User Not Found", 404)
        }
        const device = await Devices.findOne({ serialNumber })
        if (!device) {
            throw new AppError('Device Not Configured', 404)
        }
        if (device.owner) {
            throw new AppError('Device Already Owned', 409)
        }
        await Promise.all([
            Devices.updateOne({ serialNumber }, { owner: id }),
            User.updateOne({ _id: userID }, { $push: { devices: device._id } })
        ])
        async function publish(id: string) {
            return new Promise((resolve, reject) => {
                const kioskBrowserURL = (process.env.KIOSK_BASE_URL as string) + userID
                mqttClient.publish(
                    `device/${id}/commands`,
                    JSON.stringify({ message: "Provisioning Complete", kioskBrowserURL }),
                    { qos: 2 },
                    (error) => {
                        if (error) {
                            reject(new AppError(`Couldn't Reach Device, Please try restarting it...`, 500))
                        } else {
                            resolve("")
                        }
                    }
                )
            })
        }
        await publish(device.id)
        return device._id
    } catch (e) {
        throw e
    }
}

export const getDevice = async (deviceID: string): Promise<device> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(deviceID)) {
            throw new AppError("Invalid Device ID", 400)
        }
        const _id = new mongoose.Types.ObjectId(deviceID)
        const device = await Devices.findById(_id)
        if (!device) {
            throw new AppError('Device Not Exists', 404)
        }
        return device
    } catch {
        throw new AppError("Invalid Device ID", 400)
    }
}

export const getDevices = async (owner: string): Promise<device[]> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(owner)) {
            throw new AppError("Invalid User ID", 400)
        }
        const _id = new mongoose.Types.ObjectId(owner)
        const user = await User.findById(_id).select("devices").populate("devices")
        if (!user) {
            throw new AppError("User Not Exists", 404)
        }

        const devices = user.devices as unknown as device[]
        if (!devices || devices.length < 1) {
            throw new AppError("No Devices Found", 404)
        }
        return devices
    } catch (e) {
        throw e
    }
}

export const removeDevice = async (deviceID: string, command?: "remove") => {
    try {
        if (!mongoose.Types.ObjectId.isValid(deviceID)) {
            throw new AppError("Invalid User ID", 400)
        }
        const _id = new mongoose.Types.ObjectId(deviceID)
        const device = await Devices.findById(_id)
        if (!device) {
            throw new AppError("No Device Exists")
        }
        const owner = device?.owner
        if (owner) {
            await User.updateOne({ _id: owner }, { $pull: { devices: _id } })
        }
        async function publish(id: string) {
            return new Promise((resolve, reject) => {
                mqttClient.publish(
                    `device/${id}/commands`,
                    JSON.stringify({ message: "Unlink" }),
                    { qos: 2 },
                    (error) => {
                        if (error) {
                            reject(new AppError(`Couldn't Reach Device, Please try restarting it...`, 500))
                        } else {
                            resolve("")
                        }
                    }
                )
            })
        }
        await publish(deviceID)
        if (command === "remove") {
            const deleteInfo = await Devices.deleteOne({ _id })
            if (deleteInfo.deletedCount < 1) {
                if (owner) {
                    await User.updateOne({ _id: owner }, { $push: { devices: _id } })
                }
                throw new AppError("Device Remove Failed")
            }
            return "Device Removed Successfully"
        } else {
            const updateInfo = await Devices.updateOne({ _id }, { $unset: { owner: "" } })
            if (updateInfo.matchedCount < 1) {
                if (owner) {
                    await User.updateOne({ _id: owner }, { $push: { devices: _id } })
                }
                throw new AppError("Device Unlink Failed")
            }
            return "Device Unlinked Successfully"
        }
    } catch (e) {
        throw e
    }
}

export const updateDeviceStatus = async (deviceID: string, status: string) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(deviceID)) {
            throw new AppError("Invalid User ID", 400)
        }
        const _id = new mongoose.Types.ObjectId(deviceID)
        if (status !== "online" && status !== "offline") {
            throw new AppError("Invalid Status", 400)
        }
        await Devices.updateOne({ _id }, { status })
    } catch (e) {
        throw e
    }
}

export const isDeviceOnline = async (deviceID: mongoose.Types.ObjectId): Promise<boolean> => {
    try {
        const device = await Devices.findById(deviceID);
        if (!device) {
            throw new AppError("Device not exists", 404)
        }
        if (device.status === "online") {
            return true
        } else {
            return false
        }
    } catch (e) {
        throw e
    }

}

export const generateMqttCredentials = async (deviceVID: string, expiresIn: StringValue | number = '25m'): Promise<mqttCredentials> => {
    try {
        if (!mongoose.Types.ObjectId.isValid(deviceVID)) {
            throw new AppError("Invalid Device ID", 400)
        }
        const _id = new mongoose.Types.ObjectId(deviceVID)
        const device = await Devices.findById(_id)
        if (!device || !device.owner) {
            throw new AppError("Device doesn't exist, Invalid Id", 400)
        }
        const secret = process.env.MQTT_JWT_SECRET as string
        const token = jwt.sign({ client_attrs: { deviceVID } }, secret, { expiresIn })
        return { token, expiresIn }
    } catch (e) {
        throw e
    }
} 