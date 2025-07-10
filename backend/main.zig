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

fn get_content_type(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html")) return "text/html";
    if (std.mem.endsWith(u8, path, ".js")) return "application/javascript";
    if (std.mem.endsWith(u8, path, ".css")) return "text/css";
    return "application/octet-stream";
}

fn send_response(client_socket: c_int, status: []const u8, content_type: []const u8, body: []const u8) void {
    var buf: [2048]u8 = undefined;
    const response = std.fmt.bufPrint(
        &buf,
        "HTTP/1.1 {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\n\r\n",
        .{ status, content_type, body.len },
    ) catch return;
    _ = std.c.write(client_socket, response.ptr, response.len);
    _ = std.c.write(client_socket, body.ptr, body.len);
}

fn send_404(client_socket: c_int) void {
    send_response(client_socket, "404 Not Found", "text/plain", "Not Found");
}

fn handle_client(client_socket: c_int, allocator: std.mem.Allocator) void {
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
        send_404(client_socket);
        return;
    }

    // 경로 매핑
    var file_path_buf: [128]u8 = undefined;
    var file_path: []u8 = undefined;
    if (std.mem.eql(u8, path, "/") or std.mem.eql(u8, path, "/index.html")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/index.html", .{}) catch return;
    } else if (std.mem.eql(u8, path, "/script.js")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/script.js", .{}) catch return;
    } else if (std.mem.eql(u8, path, "/style.css")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/style.css", .{}) catch return;
    } else {
        send_404(client_socket);
        return;
    }

    // 파일 읽기
    const file = std.fs.cwd().openFile(file_path, .{}) catch {
        send_404(client_socket);
        return;
    };
    defer file.close();

    const stat = file.stat() catch {
        send_404(client_socket);
        return;
    };

    const file_buf = allocator.alloc(u8, stat.size) catch {
        send_404(client_socket);
        return;
    };
    defer allocator.free(file_buf);

    const read_n = file.readAll(file_buf) catch {
        send_404(client_socket);
        return;
    };
    send_response(client_socket, "200 OK", get_content_type(file_path), file_buf[0..read_n]);
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

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

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

        handle_client(client_socket, allocator);
    }
}
