import logger from "../../utils/logger.js";

/**
 * socketHandler(io)
 * ─────────────────────────────────────────────────────────────────────────
 * Registers all Socket.io server-side event handlers.
 * Called once from server.js after the Socket.io server is created.
 *
 * Multi-tenant isolation:
 *   Each company gets its own Socket.io "room": `company:{company_id}`
 *   The mqttService emits ONLY to the room matching the incoming message's
 *   company_id, so Company A can never receive Company B's telemetry.
 *
 * Client-side usage (React / plain JS):
 *   const socket = io("http://localhost:5000");
 *   socket.emit("join:company", "YOUR_COMPANY_OBJECT_ID");
 *   socket.on("telemetry", (data) => { console.log(data); });
 */
export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "🔌 Socket.io client connected");

    // ── join:company ────────────────────────────────────────────────────
    // Client sends its company_id to subscribe to that company's room.
    // TODO (Phase 4): validate company_id against the JWT instead of
    //                 trusting the client-supplied value.
    socket.on("join:company", (company_id) => {
      if (!company_id) {
        logger.warn({ socketId: socket.id }, "join:company called with no company_id");
        return;
      }
      const room = `company:${company_id}`;
      socket.join(room);
      logger.info({ socketId: socket.id, company_id, room }, "Socket joined company room");

      // Acknowledge to the client
      socket.emit("joined", { room });
    });

    // ── disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "🔌 Socket.io client disconnected");
    });
  });
}
