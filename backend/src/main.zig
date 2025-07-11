const std = @import("std");
const zap = @import("zap");
const handler = @import("handler.zig");

pub fn main() !void {
    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = handler.on_request,
        .log = true,
        .max_clients = 100000,
    });
    try listener.listen();

    std.debug.print("Listening on 0.0.0.0:8080\n", .{});

    zap.start(.{
        .threads = 2,
        .workers = 2,
    });
}
