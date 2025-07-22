const zap = @import("zap");
const Router = @import("../web/router.zig").Router;
const PaymentController = @import("controller.zig").PaymentController;

// 전역 컨트롤러 포인터 (main.zig에서 할당)
pub var payment_controller: ?*PaymentController = null;

pub fn setupRoutes(router: *Router, controller: *PaymentController) !void {
    payment_controller = controller;
    try router.post("/api/payment", handleCreate);
    try router.get("/api/payment", handleList);
}

fn handleCreate(r: zap.Request) anyerror!void {
    try payment_controller.?.create(r);
}

fn handleList(r: zap.Request) anyerror!void {
    try payment_controller.?.list(r);
}
