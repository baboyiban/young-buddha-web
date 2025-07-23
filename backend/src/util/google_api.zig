const std = @import("std");
const AuthService = @import("../auth/service.zig").AuthService;

/// Google API 호출을 래핑하여 access_token 만료(401) 시 refresh_token으로 재발급 후 재시도
pub fn callGoogleApiWithRefresh(
    allocator: std.mem.Allocator,
    auth_service: *AuthService,
    access_token: []const u8,
    refresh_token: []const u8,
    ctx: anytype,
    call_fn: fn (ctx: anytype, token: []const u8) anyerror![]u8,
) ![]u8 {
    var result = try call_fn(ctx, access_token);

    if (std.mem.indexOf(u8, result, "\"error\":") != null and
        std.mem.indexOf(u8, result, "401") != null and
        refresh_token.len > 0)
    {
        const new_access_token = try auth_service.refreshAccessToken(refresh_token);
        defer allocator.free(new_access_token);
        result = try call_fn(ctx, new_access_token);
    }
    return result;
}
