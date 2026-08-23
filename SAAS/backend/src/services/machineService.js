import axios from "axios";
import MachineAssignment from "../models/MachineAssignment.js";
import ApiError from "../utils/ApiError.js";
import { telemetryCache } from "./mqttService.js";

// ─── IoT REST Client ──────────────────────────────────────────────────────────
// All calls to the IoT backend are made from here (server-side only).
// Do not create this client at module-load time. With ES modules, dependency
// imports are evaluated before server.js gets to call dotenv.config(), which
// would leave baseURL undefined and make relative requests fail as "Invalid URL".
const getIotClient = () => {
  const baseURL = process.env.IOT_API_BASE_URL?.trim();

  if (!baseURL) {
    throw ApiError.internal("IOT_API_BASE_URL is not configured");
  }

  try {
    new URL(baseURL);
  } catch {
    throw ApiError.internal("IOT_API_BASE_URL must be a valid absolute URL");
  }

  return axios.create({ baseURL, timeout: 8000 });
};

// ─── getMachines ─────────────────────────────────────────────────────────────
// GET /api/admin/machines
// Fetches all devices owned by the given userId from the IoT backend.
// SUPER_ADMIN and ADMIN: userId = company owner's ID stored in JWT company_id.
// TECHNICIAN: returns only assigned machines.
export const getMachines = async (user) => {
  try {
    const iotClient = getIotClient();
    if (user.role === "TECHNICIAN") {
      // Technicians only see their assigned machines
      const assignments = await MachineAssignment.find({
        company_id:    user.company_id,
        technician_id: user.user_id,
      }).lean();

      const machine_ids = assignments.map((a) => a.machine_id);
      if (machine_ids.length === 0) return [];

      // Fetch each assigned machine individually: GET /api/device/getDevice/:deviceVID
      const results = await Promise.allSettled(
        machine_ids.map((id) =>
          iotClient.get(`/api/device/getDevice/${id}`).then((r) => r.data)
        )
      );

      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => enrichWithTelemetry(r.value));
    }

    // SUPER_ADMIN / ADMIN: fetch all machines for this company
    // GET /api/device/getDevices/:ownerID
    const response = await iotClient.get(`/api/device/getDevices/${user.user_id}`);
    // The IoT backend returns { device: [...], message: "..." }
    const machines = response.data.device || [];
    return machines.map(enrichWithTelemetry);
  } catch (err) {
    handleIotError(err, "Failed to fetch machines from IoT backend");
  }
};

// ─── getMachine ──────────────────────────────────────────────────────────────
// GET /api/admin/machines/:machine_id
// Returns a single device's full detail including components[].
// NOTE: The IoT backend's GET /api/device/getDevice/:id is broken — it expects
// an ownerID, not a deviceID. Workaround: call getDevices/:ownerID and filter.
export const getMachine = async (machine_id, user) => {
  try {
    const iotClient = getIotClient();
    await assertMachineAccess(machine_id, user);

    // Fetch all machines for this owner, then find the specific one by _id
    const response = await iotClient.get(`/api/device/getDevices/${user.user_id}`);
    const machines = response.data.device || [];
    const machine = machines.find((m) => m._id === machine_id);

    if (!machine) {
      throw ApiError.notFound(`Machine ${machine_id} not found`);
    }

    return enrichWithTelemetry(machine);
  } catch (err) {
    handleIotError(err, `Failed to fetch machine ${machine_id} from IoT backend`);
  }
};

// ─── provisionMachine ────────────────────────────────────────────────────────
// POST /api/admin/machines/provision
// Calls the IoT backend to register and provision a machine under this company.
export const provisionMachine = async ({ serialNumber }, user) => {
  try {
    const iotClient = getIotClient();
    // POST /api/device/provision  { serialNumber, userID }
    // IoT backend links device → userID (the company owner's ID)
    const response = await iotClient.post(`/api/device/provision`, {
      serialNumber,
      userID: user.user_id,
    });
    return response.data;
  } catch (err) {
    handleIotError(err, "Failed to provision machine via IoT backend");
  }
};

// ─── sendCommand ─────────────────────────────────────────────────────────────
// POST /api/admin/machines/:machine_id/commands
// Publishes a command to the machine via IoT backend REST endpoint.
// TECHNICIAN is blocked by route-level RBAC.
export const sendCommand = async (machine_id, { message }, user) => {
  try {
    const iotClient = getIotClient();
    await assertMachineAccess(machine_id, user);

    const response = await iotClient.post(`/api/device/${machine_id}/commands`, {
      message,
    });
    return response.data;
  } catch (err) {
    handleIotError(err, `Failed to send command to machine ${machine_id}`);
  }
};

// ─── getTelemetry ────────────────────────────────────────────────────────────
// GET /api/admin/machines/:machine_id/telemetry
// Returns latest cached telemetry snapshot for the requested machine.
export const getTelemetry = async (machine_id, user) => {
  await assertMachineAccess(machine_id, user);

  const cached = telemetryCache.get(machine_id);
  if (!cached) {
    throw ApiError.notFound(`No telemetry data available yet for machine ${machine_id}`);
  }
  return cached;
};

// ─── getAssignments ──────────────────────────────────────────────────────────
// GET /api/admin/assignments
export const getAssignments = async (company_id) => {
  return MachineAssignment.find({ company_id })
    .populate("technician_id", "name email role")
    .lean();
};

// ─── assignMachine ───────────────────────────────────────────────────────────
// POST /api/admin/assignments
export const assignMachine = async ({ machine_id, technician_id }, assignedBy) => {
  const existing = await MachineAssignment.findOne({
    machine_id,
    technician_id,
  });

  if (existing) {
    throw ApiError.conflict("Technician is already assigned to this machine");
  }

  return MachineAssignment.create({
    company_id:    assignedBy.company_id,
    machine_id,
    technician_id,
    assigned_by:   assignedBy.user_id,
  });
};

// ─── removeAssignment ────────────────────────────────────────────────────────
// DELETE /api/admin/assignments/:id
export const removeAssignment = async (assignmentId, company_id) => {
  const result = await MachineAssignment.findOneAndDelete({
    _id:        assignmentId,
    company_id, // ensures you can only delete your own company's assignments
  });

  if (!result) {
    throw ApiError.notFound("Assignment not found");
  }
  return result;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Merge IoT device data with latest cached telemetry (if any)
const enrichWithTelemetry = (device) => {
  const machine_id = device._id ?? device.deviceVID;
  const cached = telemetryCache.get(String(machine_id));
  return {
    ...device,
    latestTelemetry: cached?.data    ?? null,
    telemetryAt:     cached?.updatedAt ?? null,
  };
};

// Verify that this user is allowed to access the given machine.
// SUPER_ADMIN and ADMIN can access all company machines.
// TECHNICIAN must have an active MachineAssignment record.
const assertMachineAccess = async (machine_id, user) => {
  if (user.role !== "TECHNICIAN") return; // SA/Admin always allowed

  const assignment = await MachineAssignment.findOne({
    machine_id,
    technician_id: user.user_id,
    company_id:    user.company_id,
  });

  if (!assignment) {
    throw ApiError.forbidden("You are not assigned to this machine");
  }
};

// Normalize IoT backend errors into meaningful API errors
const handleIotError = (err, fallback) => {
  if (err instanceof ApiError) throw err;

  if (err.response) {
    // IoT backend returned an HTTP error
    const status  = err.response.status;
    const message = err.response.data?.message ?? fallback;
    throw new ApiError(status, message);
  }
  // Network / timeout error
  throw ApiError.internal(`IoT backend unreachable: ${err.message}`);
};
