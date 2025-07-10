const std = @import("std");

extern fn socket(domain: c_int, typ: c_int, protocol: c_int) c_int;
extern fn bind(sockfd: c_int, addr: *const anyopaque, addrlen: u32) c_int;
extern fn listen(sockfd: c_int, backlog: c_int) c_int;
extern fn accept(sockfd: c_int, addr: *anyopaque, addrlen: *u32) c_int;
extern fn close(fd: c_int) c_int;

pub fn main() !void {
    const AF_INET = 2;
    const SOCK_STREAM = 1;

    const server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket < 0) return error.SocketCreateFailed;
    defer _ = close(server_socket);

    // sockaddr_in 구조체 정의
    const sockaddr_in = extern struct {
        sin_family: u16,
        sin_port: u16,
        sin_addr: u32,
        sin_zero: [8]u8,
    };

    var addr = sockaddr_in{
        .sin_family = AF_INET,
        .sin_port = std.mem.nativeToBig(u16, 8080),
        .sin_addr = 0, // 0.0.0.0
        .sin_zero = [_]u8{0} ** 8,
    };

    if (bind(server_socket, @ptrCast(&addr), @intCast(@sizeOf(sockaddr_in))) < 0)
        return error.BindFailed;

    if (listen(server_socket, 128) < 0)
        return error.ListenFailed;

    std.debug.print("Listening on 0.0.0.0:8080\n", .{});

    while (true) {
        var client_addr: sockaddr_in = undefined;
        var client_len: u32 = @intCast(@sizeOf(sockaddr_in));
        const client_socket = accept(
            server_socket,
            @ptrCast(&client_addr),
            &client_len,
        );
        if (client_socket < 0) continue;
        defer _ = close(client_socket);

        var buf: [1024]u8 = undefined;
        const n = std.c.read(client_socket, &buf, buf.len);
        if (n <= 0) continue;
        const request = buf[0..@intCast(n)];

        if (std.mem.startsWith(u8, request, "GET / ")) {
            const body = "<h1>Hello Zig!</h1>";
            const response = std.fmt.comptimePrint("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {d}\r\n\r\n{s}", .{ body.len, body });
            _ = std.c.write(client_socket, response, response.len);
        } else {
            const body = "Not Found";
            const response = std.fmt.comptimePrint("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: {d}\r\n\r\n{s}", .{ body.len, body });
            _ = std.c.write(client_socket, response, response.len);
        }
    }
}
