const std = @import("std");
const static = @import("static.zig");
const response = @import("response.zig");
const oauth = @import("oauth.zig");

pub fn handle_client(client_socket: c_int, allocator: std.mem.Allocator) void {
    var buf: [1024]u8 = undefined;
    const n = std.c.read(client_socket, &buf, buf.len);
    if (n <= 0) return;
    const request = buf[0..@intCast(n)];

    // 요청 라인 파싱 (예: "GET /main.js HTTP/1.1\r\n...")
    const first_line_end = std.mem.indexOf(u8, request, "\r\n") orelse return;
    const first_line = request[0..first_line_end];
    var it = std.mem.tokenizeScalar(u8, first_line, ' ');
    const method = it.next() orelse return;
    const path = it.next() orelse return;

    if (!std.mem.eql(u8, method, "GET")) {
        response.send_404(client_socket);
        return;
    }

    // OAuth 라우팅
    if (std.mem.eql(u8, path, "/auth/google")) {
        oauth.handle_oauth_google(client_socket, allocator);
        return;
    }
    if (std.mem.startsWith(u8, path, "/auth/google/callback")) {
        // 쿼리스트링 파싱 (간단히 "?" 이후 전체를 넘김)
        const qmark = std.mem.indexOf(u8, path, "?");
        const query = if (qmark) |i| path[(i + 1)..] else "";
        oauth.handle_oauth_google_callback(client_socket, allocator, query);
        return;
    }

    // 정적 파일 서빙
    static.serve_static(client_socket, allocator, path);
}
