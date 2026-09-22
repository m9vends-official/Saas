import mongoose from "mongoose";
import type { StringValue } from 'ms'
export interface device {
    _id: mongoose.Types.ObjectId
    serialNumber: string;
    model: string;
    owner?: mongoose.Types.ObjectId;
    ip: string;
    status: "online" | "offline";
    firmware?: {
        name: string;
        version: string;
        lastUpdated: Date;
    };
    components: {
        catagory: string;
        name: string;
        type: "sensor" | "accutator";
    }[],
}

export interface mqttCredentials {
    token: string;
    expiresIn: StringValue | number
}

export interface mqttDeviceCredentials {
    url: string;
    port: number;
    username: string;
    password: string;
}

export interface deviceInfo {
    message: string;
    deviceVID: string | mongoose.Types.ObjectId;
    mqtt: mqttDeviceCredentials;
    topics?: {
        pub: string[],
        sub: string[],
    };
    isProvisioned: boolean;
    kioskBrowserURL?: string | undefined;
}