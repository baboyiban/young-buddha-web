const std = @import("std");
const response = @import("response.zig");

const GOOGLE_CLIENT_ID = "574665261370-kijb3qoqaq6ka9vem42hvobqu0gmq9aj.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "http://localhost:8080/auth/google/callback";
const GOOGLE_SCOPE = "openid%20email%20profile";

pub fn handle_oauth_google(client_socket: c_int, _allocator: std.mem.Allocator) void {
    _ = _allocator;
    const url = build_google_auth_url() catch {
        response.send_500(client_socket);
        return;
    };
    send_redirect(client_socket, url);
}

fn build_google_auth_url() ![]u8 {
    return std.fmt.allocPrint(std.heap.page_allocator, "https://accounts.google.com/o/oauth2/v2/auth?client_id={s}&redirect_uri={s}&response_type=code&scope={s}&state={s}", .{ GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_SCOPE, "random_state" });
}

pub fn handle_oauth_google_callback(client_socket: c_int, _allocator: std.mem.Allocator, _query: []const u8) void {
    _ = _allocator;
    _ = _query;
    send_redirect(client_socket, "/");
}

fn send_redirect(client_socket: c_int, url: []const u8) void {
    var buf: [1024]u8 = undefined;
    const response_str = std.fmt.bufPrint(
        &buf,
        "HTTP/1.1 302 Found\r\nLocation: {s}\r\nContent-Length: 0\r\n\r\n",
        .{url},
    ) catch return;
    _ = std.c.write(client_socket, response_str.ptr, response_str.len);
}
