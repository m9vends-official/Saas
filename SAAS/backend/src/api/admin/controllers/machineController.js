import {
  getMachines,
  getMachine,
  provisionMachine,
  sendCommand,
  getTelemetry,
  getAssignments,
  assignMachine,
  removeAssignment,
} from "../../../services/machineService.js";
import ApiError from "../../../utils/ApiError.js";

// â”€â”€â”€ listMachines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/machines
export const listMachines = async (req, res, next) => {
  try {
    const machines = await getMachines(req.user);
    res.json({ success: true, data: machines });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ getMachineDetail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/machines/:machine_id
export const getMachineDetail = async (req, res, next) => {
  try {
    const machine = await getMachine(req.params.machine_id, req.user);
    res.json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ provision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/admin/machines/provision
// Body: { serialNumber: string }
export const provision = async (req, res, next) => {
  try {
    const { serialNumber, company_id } = req.body;
    if (!serialNumber) {
      return next(ApiError.badRequest("serialNumber is required"));
    }
    
    let provisionUser = req.user;
    if (req.user.role === 'SUPER_ADMIN') {
        if (!company_id) return next(ApiError.badRequest("company_id is required for super admin"));
        // Find an admin for this company to act as the device owner in IoT backend
        const { default: User } = await import('../../../models/User.js');
        const companyAdmin = await User.findOne({ company_id, role: 'ADMIN' });
        if (!companyAdmin) return next(ApiError.badRequest("No admin found for this company to own the device. Please create a user first."));
        
        provisionUser = { user_id: companyAdmin._id, role: 'ADMIN', company_id: companyAdmin.company_id };
    }

    const result = await provisionMachine({ serialNumber }, provisionUser);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ dispatchCommand â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/admin/machines/:machine_id/commands
// Body: { message: string }
export const dispatchCommand = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return next(ApiError.badRequest("message is required"));
    }
    const result = await sendCommand(req.params.machine_id, { message }, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ getMachineTelemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/machines/:machine_id/telemetry
export const getMachineTelemetry = async (req, res, next) => {
  try {
    const telemetry = await getTelemetry(req.params.machine_id, req.user);
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ listAssignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/assignments
export const listAssignments = async (req, res, next) => {
  try {
    const assignments = await getAssignments(req.company_id, req.query.machine_id);
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ createAssignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/admin/assignments
// Body: { machine_id: string, technician_id: string }
export const createAssignment = async (req, res, next) => {
  try {
    const { machine_id, technician_id } = req.body;
    if (!machine_id || !technician_id) {
      return next(ApiError.badRequest("machine_id and technician_id are required"));
    }
    const assignment = await assignMachine({ machine_id, technician_id }, req.user);
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ deleteAssignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DELETE /api/admin/assignments/:id
export const deleteAssignment = async (req, res, next) => {
  try {
    const deleted = await removeAssignment(req.params.id, req.company_id);
    res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
};

