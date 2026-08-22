import mongoose from "mongoose";

// ─── MachineAssignment Model ──────────────────────────────────────────────────
// Links a Technician (User) to a specific machine (deviceVID / machine_id).
// SUPER_ADMIN and ADMIN can see all company machines without an assignment record.
// TECHNICIAN can only access machines they are explicitly assigned to.
//
// Relationship:
//   company_id  → which company this assignment belongs to (for tenant isolation)
//   machine_id  → the deviceVID from IoT backend / machine_id in Order model
//   technician_id → User with role TECHNICIAN

const machineAssignmentSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    // machine_id = deviceVID from IoT backend (same string stored in Order.machine_id)
    machine_id: {
      type: String,
      required: true,
      trim: true,
    },
    technician_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One technician cannot be assigned to the same machine twice
machineAssignmentSchema.index(
  { machine_id: 1, technician_id: 1 },
  { unique: true }
);

export default mongoose.model("MachineAssignment", machineAssignmentSchema);
