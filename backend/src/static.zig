const std = @import("std");
const zap = @import("zap");
const Env = @import("env.zig").Env;

pub const StaticHandler = struct {
    allocator: std.mem.Allocator,
    base_path: []const u8,

    pub fn init(allocator: std.mem.Allocator, env: Env) !StaticHandler {
        return .{
            .allocator = allocator,
            .base_path = env.get("STATIC_FILES_PATH") orelse "../frontend/src",
        };
    }

    pub fn deinit(_: *StaticHandler) void {}

    pub fn serve(self: *StaticHandler, r: zap.Request) !void {
        const path = r.path orelse "/";
        const file_path = try self.resolvePath(path);
        defer self.allocator.free(file_path);

        var file = std.fs.cwd().openFile(file_path, .{}) catch |err| {
            std.log.warn("Static file not found: {s}", .{file_path});
            if (err == error.FileNotFound) {
                return r.setStatus(.not_found);
            }
            return err;
        };
        defer file.close();

        const content = try file.readToEndAlloc(self.allocator, 10 * 1024 * 1024);
        defer self.allocator.free(content);

        r.setStatus(.ok);
        try r.setHeader("Content-Type", self.getContentType(file_path));
        try r.sendBody(content);
    }

    fn resolvePath(self: *StaticHandler, path: []const u8) ![]u8 {
        var final_path: []const u8 = undefined;
        if (std.mem.eql(u8, path, "/")) {
            final_path = "index.html";
        } else {
            final_path = path[1..];
        }
        return std.fs.path.join(self.allocator, &.{ self.base_path, final_path });
    }

    fn getContentType(_: *StaticHandler, path: []const u8) []const u8 {
        if (std.mem.endsWith(u8, path, ".html")) return "text/html; charset=utf-8";
        if (std.mem.endsWith(u8, path, ".js")) return "application/javascript; charset=utf-8";
        if (std.mem.endsWith(u8, path, ".css")) return "text/css; charset=utf-8";
        if (std.mem.endsWith(u8, path, ".png")) return "image/png";
        if (std.mem.endsWith(u8, path, ".jpg")) return "image/jpeg";
        if (std.mem.endsWith(u8, path, ".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
};
