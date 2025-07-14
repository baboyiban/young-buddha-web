const std = @import("std");
const main = @import("../main.zig");
const access_control = @import("access_control.zig");
const zap = @import("zap");
const HandlerFn = @import("../router/router.zig").HandlerFn;

pub fn requireRole(r: zap.Request, roles: []const []const u8) !void {
    const user = try access_control.requireLogin(main.global_session_service.?, r);
    for (roles) |role| {
        if (std.mem.eql(u8, user.role, role)) return;
    }
    return error.Forbidden;
}

pub fn AuthRequired(
    comptime roles: []const []const u8,
    comptime handler: HandlerFn,
) HandlerFn {
    const Handler = struct {
        fn thunk(r: zap.Request) anyerror!void {
            requireRole(r, roles) catch {
                r.setStatusNumeric(403);
                try r.sendBody("{\"error\":true,\"message\":\"권한이 필요합니다.\"}");
                return;
            };
            return try handler(r);
        }
    };

    return Handler.thunk;
}
