const std = @import("std");
const constants = @import("../config/constants.zig");
const User = @import("../model/user.zig").User;

/// 세션에서 User를 꺼냄 (없으면 null)
pub fn getUserFromRequest(session_service: anytype, r: anytype) ?User {
    r.parseCookies(false);
    if (r.getCookieStr(std.heap.page_allocator, constants.SESSION_COOKIE_NAME) catch null) |sid| {
        return session_service.getUser(sid);
    }
    return null;
}

/// 인증 필요 미들웨어
pub fn requireLogin(session_service: anytype, r: anytype) !User {
    if (getUserFromRequest(session_service, r)) |user| {
        return user;
    }
    return error.NotLoggedIn;
}
