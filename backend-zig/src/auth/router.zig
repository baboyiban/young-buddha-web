const zap = @import("zap");
const Router = @import("../web/router.zig").Router;
const globals = @import("../config/globals.zig");

fn handleGoogleAuth(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.googleAuth(r);
}
fn handleGoogleCallback(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.googleCallback(r);
}
fn handleMe(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.me(r);
}
fn handleLogout(r: zap.Request) anyerror!void {
    try globals.auth_controller.?.logout(r);
}

pub fn setupRoutes(router: *Router, _: *const anyopaque) !void {
    try router.post("/api/auth/google", handleGoogleAuth);
    try router.get("/api/auth/google/callback", handleGoogleCallback);
    try router.get("/api/auth/me", handleMe);
    try router.delete("/api/auth/logout", handleLogout);
}
