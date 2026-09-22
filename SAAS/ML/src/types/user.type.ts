import type mongoose from "mongoose";

export interface user {
    _id?: mongoose.Types.ObjectId;
    email: string;
    devices: mongoose.Types.ObjectId[];
}