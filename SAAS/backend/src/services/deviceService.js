import Device from "../models/Device.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// ─── Register Device ───────────────────────────────────────────────────────────
export const registerDevice = async ({ company_id, device_id, machine_name, location }) => {

  // device_id must be globally unique (one physical machine = one ID)
  const existing = await Device.findOne({ device_id });
  if (existing) {
    throw ApiError.conflict(`Device '${device_id}' is already registered`);
  }

  const device = await Device.create({
    company_id,
    device_id,
    machine_name,
    location,
  });

  logger.info({ device_id: device.device_id, company_id }, "Device registered");

  return device;
};

// ─── List Company Devices ──────────────────────────────────────────────────────
export const getCompanyDevices = async (company_id) => {
  // company_id filter enforces tenant isolation — never skip this
  return Device.find({ company_id }).sort({ createdAt: -1 });
};

// ─── Get Single Device ─────────────────────────────────────────────────────────
export const getDeviceById = async (company_id, id) => {
  const device = await Device.findOne({
    _id: id,
    company_id, // ensures tenant can only access their own devices
  });

  if (!device) {
    throw ApiError.notFound("Device not found");
  }

  return device;
};

// ─── Update Device Status ──────────────────────────────────────────────────────
export const updateDeviceStatus = async (company_id, id, status) => {
  const device = await Device.findOneAndUpdate(
    {
      _id: id,
      company_id, // tenant isolation
    },
    { status },
    {
      new: true,          // return updated doc
      runValidators: true, // enforce enum validation from schema
    }
  );

  if (!device) {
    throw ApiError.notFound("Device not found");
  }

  logger.info({ device_id: device.device_id, status }, "Device status updated");

  return device;
};