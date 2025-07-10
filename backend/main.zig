const std = @import("std");

const AF_INET = 2;
const SOCK_STREAM = 1;
const PORT = 8080;

const sockaddr_in = extern struct {
    sin_family: u16,
    sin_port: u16,
    sin_addr: u32,
    sin_zero: [8]u8,
};

extern fn socket(domain: c_int, typ: c_int, protocol: c_int) c_int;
extern fn bind(sockfd: c_int, addr: *const anyopaque, addrlen: u32) c_int;
extern fn listen(sockfd: c_int, backlog: c_int) c_int;
extern fn accept(sockfd: c_int, addr: *anyopaque, addrlen: *u32) c_int;
extern fn close(fd: c_int) c_int;

const ServerError = error{
    SocketCreateFailed,
    BindFailed,
    ListenFailed,
};

fn create_server_socket() ServerError!c_int {
    const sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return ServerError.SocketCreateFailed;
    return sock;
}

fn bind_server_socket(sock: c_int, addr: *sockaddr_in) ServerError!void {
    if (bind(sock, @ptrCast(addr), @intCast(@sizeOf(sockaddr_in))) < 0)
        return ServerError.BindFailed;
}

fn listen_server_socket(sock: c_int) ServerError!void {
    if (listen(sock, 128) < 0)
        return ServerError.ListenFailed;
}

fn send_response(client_socket: c_int, status: []const u8, content_type: []const u8, body: []const u8) void {
    var buf: [2048]u8 = undefined;
    const response = std.fmt.bufPrint(
        &buf,
        "HTTP/1.1 {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\n\r\n{s}",
        .{ status, content_type, body.len, body },
    ) catch return;
    _ = std.c.write(client_socket, response.ptr, response.len);
}

fn handle_client(client_socket: c_int) void {
    var buf: [1024]u8 = undefined;
    const n = std.c.read(client_socket, &buf, buf.len);
    if (n <= 0) return;
    const request = buf[0..@intCast(n)];

    if (std.mem.startsWith(u8, request, "GET / ")) {
        send_response(client_socket, "200 OK", "text/html", "<h1>Hello Zig!</h1>");
    } else {
        send_response(client_socket, "404 Not Found", "text/plain", "Not Found");
    }
}

pub fn main() !void {
    var addr = sockaddr_in{
        .sin_family = AF_INET,
        .sin_port = std.mem.nativeToBig(u16, PORT),
        .sin_addr = 0, // 0.0.0.0
        .sin_zero = [_]u8{0} ** 8,
    };

    const server_socket = try create_server_socket();
    defer _ = close(server_socket);

    try bind_server_socket(server_socket, &addr);
    try listen_server_socket(server_socket);

    std.debug.print("Listening on 0.0.0.0:{d}\n", .{PORT});

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

        handle_client(client_socket);
    }
}
