const std = @import("std");

pub const Env = struct {
    allocator: std.mem.Allocator,
    vars: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator) !Env {
        var self = Env{
            .allocator = allocator,
            .vars = std.StringHashMap([]const u8).init(allocator),
        };

        // 1. 먼저 루트 .env 로드 (공통 설정)
        const root_env_path = "../.env";
        if (std.fs.cwd().readFileAlloc(allocator, root_env_path, 1 * 1024 * 1024)) |root_content| {
            try self.parseEnvContent(root_content);
            allocator.free(root_content);
            std.log.info("Loaded root .env file", .{});
        } else |_| {
            std.log.warn("Root .env file not found, skipping", .{});
        }

        // 2. 백엔드 전용 .env 로드 (덮어쓰기)
        const env_path = ".env";
        const content = std.fs.cwd().readFileAlloc(allocator, env_path, 1 * 1024 * 1024) catch |err| {
            std.log.err("Failed to read backend .env: {s}", .{@errorName(err)});
            return error.EnvFileReadFailed;
        };

        try self.parseEnvContent(content);
        try self.vars.put("__full_content__", content);
        std.log.info("Loaded backend .env file", .{});
        return self;
    }

    fn parseEnvContent(self: *Env, content: []const u8) !void {
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

    pub fn getBool(self: Env, key: []const u8, default: bool) bool {
        const value = self.get(key) orelse return default;
        return std.mem.eql(u8, value, "true") or std.mem.eql(u8, value, "1");
    }

    pub fn getInt(self: Env, key: []const u8, comptime T: type, default: T) T {
        const value = self.get(key) orelse return default;
        return std.fmt.parseInt(T, value, 10) catch default;
    }

    pub fn isProduction(self: Env) bool {
        const node_env = self.get("NODE_ENV") orelse "development";
        return std.mem.eql(u8, node_env, "production");
    }

    pub fn isDevelopment(self: Env) bool {
        return !self.isProduction();
    }
};
