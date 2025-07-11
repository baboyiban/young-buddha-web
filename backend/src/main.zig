const std = @import("std");
const zap = @import("zap");
const Server = @import("server.zig").Server;

var global_server: ?Server = null;

fn requestCallback(r: zap.Request) anyerror!void {
    const server = &global_server.?;
    try server.onRequest(r);
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    global_server = try Server.init(allocator);
    defer global_server.?.deinit();

    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = requestCallback,
        .log = true,
    });
    try listener.listen();

    std.log.info("Server running on http://localhost:8080", .{});
    zap.start(.{ .threads = 1, .workers = 1 });
}
