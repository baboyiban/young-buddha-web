const zap = @import("zap");
const Router = @import("../web/router.zig").Router;
const DatabaseController = @import("controller.zig").DatabaseController;

// 전역 컨트롤러 포인터 (main.zig에서 할당)
pub var database_controller: ?*DatabaseController = null;

pub fn setupRoutes(router: *Router, controller: *DatabaseController) !void {
    database_controller = controller;
    try router.post("/api/database", handleCreate);
    try router.get("/api/database", handleList);
}

fn handleCreate(r: zap.Request) anyerror!void {
    try database_controller.?.create(r);
}

fn handleList(r: zap.Request) anyerror!void {
    try database_controller.?.list(r);
}
