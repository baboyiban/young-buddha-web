const zap = @import("zap");
const Router = @import("../web/router.zig").Router;
const globals = @import("../config/globals.zig");

fn handleRead(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.readSheet(r);
}
fn handleWrite(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.writeSheet(r);
}
fn handleQuery(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.querySheet(r);
}
fn handleQueryGet(r: zap.Request) anyerror!void {
    try globals.sheets_controller.?.querySheetGet(r);
}

pub fn setupRoutes(router: *Router, _: *const anyopaque) !void {
    try router.get("/api/sheets/read", handleRead);
    try router.post("/api/sheets/write", handleWrite);
    try router.post("/api/sheets/query", handleQuery);
    try router.get("/api/sheets/query", handleQueryGet);
}
