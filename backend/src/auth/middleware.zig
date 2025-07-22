const std = @import("std");
const zap = @import("zap");
const User = @import("../model/user.zig").User;
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");
const json_util = @import("../util/json.zig");

pub fn getUserFromRequest(r: anytype) ?User {
    r.parseCookies(false);

    const jwt_cookie = r.getCookieStr(globals.allocator, "jwt") catch null;
    if (jwt_cookie) |token| {
        const payload = jwt.verifyJwt(globals.allocator, token, globals.jwt_secret) catch {
            return null;
        };
        defer globals.allocator.free(payload);

        // 변경: std.json 기반으로 값 추출
        return User{
            .id = json_util.extractJsonString(globals.allocator, payload, "sub") catch null orelse "",
            .name = json_util.extractJsonString(globals.allocator, payload, "name") catch null orelse "",
            .email = json_util.extractJsonString(globals.allocator, payload, "email") catch null orelse "",
            .picture = null,
            .role = json_util.extractJsonString(globals.allocator, payload, "role") catch null orelse "",
        };
    }
    return null;
}

pub fn requireLogin(r: anytype) !User {
    return getUserFromRequest(r) orelse error.NotLoggedIn;
}

pub fn requireRole(r: anytype, roles: []const []const u8) !User {
    const user = try requireLogin(r);
    for (roles) |role| {
        if (std.mem.eql(u8, user.role, role)) return user;
    }
    return error.Forbidden;
}

pub fn AuthRequired(
    comptime roles: []const []const u8,
    comptime handler: anytype,
) @TypeOf(handler) {
    const Handler = struct {
        fn thunk(r: zap.Request) anyerror!void {
            _ = requireRole(r, roles) catch {
                r.setStatusNumeric(403);
                try r.sendBody("{\"error\":true,\"message\":\"권한이 필요합니다.\"}");
                return;
            };
            return try handler(r);
        }
    };
    return Handler.thunk;
}
