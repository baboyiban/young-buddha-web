const zap = @import("zap");
const Router = @import("../web/router.zig").Router;
const PaymentController = @import("controller.zig").PaymentController;

pub var payment_controller: ?*PaymentController = null;

pub fn setupRoutes(router: *Router, controller: *PaymentController) !void {
    payment_controller = controller;
    try router.get("/api/payment", handleList);
    try router.post("/api/payment", handleCreate);
}

fn handleList(r: zap.Request) anyerror!void {
    try payment_controller.?.list(r);
}

fn handleCreate(r: zap.Request) anyerror!void {
    try payment_controller.?.create(r);
}
