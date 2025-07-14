const std = @import("std");
const constants = @import("../config/constants.zig");
const User = @import("../model/user.zig").User;
const jwt_util = @import("../util/jwt.zig");
const main = @import("../main.zig");

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

pub fn getUserFromRequest(r: anytype) ?User {
    r.parseCookies(false); // 여기서만 호출
    const jwt = r.getCookieStr(std.heap.page_allocator, "jwt") catch null;
    if (jwt) |token| {
        const payload = jwt_util.verifyJwt(std.heap.page_allocator, token, main.global_jwt_secret) catch |err| {
            std.debug.print("JWT 검증 실패: {s}\n", .{@errorName(err)});
            return null;
        };

        const role = extractJsonString(payload, "\"role\":\"") orelse "";
        return User{
            .id = extractJsonString(payload, "\"sub\":\"") orelse "",
            .name = extractJsonString(payload, "\"name\":\"") orelse "",
            .email = extractJsonString(payload, "\"email\":\"") orelse "",
            .picture = null,
            .role = role,
        };
    }
    return null;
}

pub fn requireLogin(r: anytype) !User {
    if (getUserFromRequest(r)) |user| {
        return user;
    }
    return error.NotLoggedIn;
}
