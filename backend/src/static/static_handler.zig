const std = @import("std");
const zap = @import("zap");
const Env = @import("../config/env.zig").Env;
const constants = @import("../config/constants.zig");
const globals = @import("../config/globals.zig");

pub const StaticHandler = struct {
    allocator: std.mem.Allocator,
    base_path: []const u8,

    pub fn init(allocator: std.mem.Allocator) !StaticHandler {
        const env = globals.getEnv();
        return .{
            .allocator = allocator,
            .base_path = env.get(constants.STATIC_FILES_PATH_KEY) orelse "../frontend/dist",
        };
    }

    pub fn deinit(self: *StaticHandler, allocator: std.mem.Allocator) void {
        // base_path는 Env에서 관리하므로 여기서 해제하지 않습니다.
        _ = self;
        _ = allocator;
    }

    pub fn serve(self: *StaticHandler, r: zap.Request) !void {
        const path = r.path orelse "/";
        var file_path: []const u8 = undefined;

        if (std.mem.eql(u8, path, "/api/")) {
            r.setStatusNumeric(404);
            try r.sendBody("Not Found");
            return;
        }

        if (std.mem.eql(u8, path, "/api/auth/google/callback")) {
            file_path = try std.fs.path.join(self.allocator, &.{ self.base_path, "index.html" });
        } else {
            file_path = try self.resolvePath(path);
        }
        defer self.allocator.free(file_path);

        var file = std.fs.cwd().openFile(file_path, .{}) catch |err| {
            if (err == error.FileNotFound) {
                r.setStatusNumeric(404);
                try r.sendBody("Not Found");
                return;
            }
            return err;
        };
        defer file.close();

        const content = try file.readToEndAlloc(self.allocator, 10 * 1024 * 1024);
        defer self.allocator.free(content);

        r.setStatusNumeric(200);
        try r.setHeader("Content-Type", self.getContentType(file_path));
        try r.sendBody(content);
    }

    fn resolvePath(self: *StaticHandler, path: []const u8) ![]u8 {
        const final_path = if (std.mem.eql(u8, path, "/")) "index.html" else path[1..];
        // Path traversal 방지
        if (std.mem.indexOf(u8, final_path, "..")) |_| {
            return error.InvalidPath;
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
