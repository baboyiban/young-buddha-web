const std = @import("std");
const server = @import("server.zig");
const handler = @import("handler.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    const server_socket = try server.create_server_socket();
    defer server.close_socket(server_socket);

    try server.bind_server_socket(server_socket);
    try server.listen_server_socket(server_socket);

    std.debug.print("Listening on 0.0.0.0:8080\n", .{});

    while (true) {
        const client_socket = server.accept_client(server_socket);
        if (client_socket < 0) continue;
        defer server.close_socket(client_socket);

        handler.handle_client(client_socket, allocator);
    }
}
