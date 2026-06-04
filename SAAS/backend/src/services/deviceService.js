import Device from "../models/Device.js"
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";


export const registerDevice = async ({ company_id, device_id, machine_name, location }) => {

    const existing = await Device.findOne({ device_id });
    if (existing) {
        throw ApiError.conflict(`Device '${device_id}' is already registered`);
    }

    const device = await Device.create({ company_id, device_id, machine_name, location });

    logger.info({ device_id: device.device_id, company_id }, "Device registered");

    return device;
}

export const getCompanyDevices = async (company_id) => {

    return Device.find({ company_id, }).sort({ createdAt: -1 });
}

export const getDeviceById = async (company_id, id) => {

    const device = await Device.findOne({
        _id: id,
        company_id,
    })

    if (!device) {
        throw ApiError.notFound("Device not Found");
    }

    return device;
}

export const updateDeviceStatus = async (company_id, id, status) => {

    const device = await Device.findOneAndUpdate(
        {
            _id: id,
            company_id,
        },
        {
            status, ...(status === "ACTIVE" && { last_seen_at: new Date() }),
        },
        {
            new: true,
            runValidators: true,
        }
    )

    if (!device) {
        throw ApiError.notFound("Device not found");
    }

    logger.info({ device_id: device.device_id, status }, "Device status updated");

    return device;
};