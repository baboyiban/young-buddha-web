const std = @import("std");
const zap = @import("zap");
const User = @import("../model/user.zig").User;
const jwt = @import("../util/jwt.zig");
const globals = @import("../config/globals.zig");

pub fn getUserFromRequest(r: anytype) ?User {
    r.parseCookies(false);

    const jwt_cookie = r.getCookieStr(globals.allocator, "jwt") catch null;
    if (jwt_cookie) |token| {
        const payload = jwt.verifyJwt(globals.allocator, token, globals.jwt_secret) catch {
            return null;
        };
        defer globals.allocator.free(payload);

        return User{
            .id = extractJsonString(payload, "\"sub\":\"") orelse "",
            .name = extractJsonString(payload, "\"name\":\"") orelse "",
            .email = extractJsonString(payload, "\"email\":\"") orelse "",
            .picture = null,
            .role = extractJsonString(payload, "\"role\":\"") orelse "",
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

fn extractJsonString(json: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, json, key)) |start| {
        const val_start = start + key.len;
        if (val_start >= json.len) return null;
        var val_end = val_start;
        while (val_end < json.len and json[val_end] != '"') : (val_end += 1) {}
        return json[val_start..val_end];
    }
    return null;
}
