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

pub fn create_server_socket() !c_int {
    const sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return error.SocketCreateFailed;
    return sock;
}

pub fn bind_server_socket(sock: c_int) !void {
    var addr = sockaddr_in{
        .sin_family = AF_INET,
        .sin_port = std.mem.nativeToBig(u16, PORT),
        .sin_addr = 0, // 0.0.0.0
        .sin_zero = [_]u8{0} ** 8,
    };
    if (bind(sock, @ptrCast(&addr), @intCast(@sizeOf(sockaddr_in))) < 0)
        return error.BindFailed;
}

pub fn listen_server_socket(sock: c_int) !void {
    if (listen(sock, 128) < 0)
        return error.ListenFailed;
}

pub fn accept_client(server_socket: c_int) c_int {
    var client_addr: sockaddr_in = undefined;
    var client_len: u32 = @intCast(@sizeOf(sockaddr_in));
    return accept(server_socket, @ptrCast(&client_addr), &client_len);
}

pub fn close_socket(sock: c_int) void {
    _ = close(sock);
}
