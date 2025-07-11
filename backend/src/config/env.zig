const std = @import("std");

pub const Env = struct {
    allocator: std.mem.Allocator,
    vars: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator) !Env {
        var self = Env{
            .allocator = allocator,
            .vars = std.StringHashMap([]const u8).init(allocator),
        };

        const env_path = "../.env";
        const content = std.fs.cwd().readFileAlloc(allocator, env_path, 1 * 1024 * 1024) catch |err| {
            std.log.err("Failed to read .env: {s}", .{@errorName(err)});
            return error.EnvFileReadFailed;
        };

        var lines = std.mem.splitSequence(u8, content, "\n");
        while (lines.next()) |line| {
            const trimmed = std.mem.trim(u8, line, " \r");
            if (trimmed.len == 0 or std.mem.startsWith(u8, trimmed, "#")) continue;
            if (std.mem.indexOfScalar(u8, trimmed, '=')) |idx| {
                const key = trimmed[0..idx];
                const value = trimmed[idx + 1 ..];
                try self.vars.put(key, value);
            }
        }
        try self.vars.put("__full_content__", content);
        return self;
    }

    pub fn deinit(self: *Env) void {
        if (self.vars.get("__full_content__")) |content| {
            self.allocator.free(content);
        }
        self.vars.deinit();
    }

    pub fn get(self: Env, key: []const u8) ?[]const u8 {
        return self.vars.get(key);
    }
};
