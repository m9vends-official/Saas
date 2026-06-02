import * as deviceService from "../../../services/deviceService.js";

export const createDevice = async (req, res, next) => {
    try {
        const device = await deviceService.registerDevice({company_id:req.company_id, ...req.body});

        res.status(201).json({
            success: true,
            data: device,
        })
    } catch (error) {
        next(error);
    }
}

export const listDevices = async (req, res, next) => {
    try {
        const device = await deviceService.getCompanyDevices(req.company_id);

        res.json({
            success: true,
            data: device,
        })
    } catch (error) {
        next(error);
    }
}

export const getDevice = async (req, res, next) => {
    try {
        const device = await deviceService.getDeviceById(req.company_id, req.params.id);

        res.json({
            success: true,
            data: device,
        })
    } catch (error) {
        next(error);
    }
}

export const updateDevice = async (req, res, next) => {
    try {
        const device = await deviceService.updateDeviceStatus(req.company_id, req.params.id, req.body.status);
        res.json({
            success: true,
            data: device,
        })
    } catch (error) {
        next(error);
    }
}