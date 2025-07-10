const std = @import("std");

pub fn send_response(client_socket: c_int, status: []const u8, content_type: []const u8, body: []const u8) void {
    var buf: [2048]u8 = undefined;
    const response = std.fmt.bufPrint(
        &buf,
        "HTTP/1.1 {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\n\r\n",
        .{ status, content_type, body.len },
    ) catch return;
    _ = std.c.write(client_socket, response.ptr, response.len);
    _ = std.c.write(client_socket, body.ptr, body.len);
}

pub fn send_404(client_socket: c_int) void {
    send_response(client_socket, "404 Not Found", "text/plain", "Not Found");
}

pub fn send_400(client_socket: c_int) void {
    send_response(client_socket, "400 Bad Request", "text/plain", "Bad Request");
}

pub fn send_500(client_socket: c_int) void {
    send_response(client_socket, "500 Internal Server Error", "text/plain", "Internal Server Error");
}
