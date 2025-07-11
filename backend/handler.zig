const zap = @import("zap");
const std = @import("std");
const oauth = @import("oauth.zig");
const static = @import("static.zig");

pub fn on_request(r: zap.Request) !void {
    if (r.path) |the_path| {
        if (std.mem.eql(u8, the_path, "/auth/google")) {
            return try oauth.handle_oauth_google(r);
        }
        if (std.mem.eql(u8, the_path, "/auth/google/callback")) {
            return try oauth.handle_oauth_google_callback(r);
        }
        // 정적 파일 서빙
        return try static.serve_static(r);
    }
    // fallback
    r.setStatus(zap.http.StatusCode.not_found);
    try r.sendBody("Not Found");
}
