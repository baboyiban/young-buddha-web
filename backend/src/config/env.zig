const std = @import("std");

pub const Env = struct {
    allocator: std.mem.Allocator,
    vars: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator) !Env {
        std.log.info("Starting Env.init", .{});

        var self = Env{
            .allocator = allocator,
            .vars = std.StringHashMap([]const u8).init(allocator),
        };
        std.log.info("Created Env struct", .{});

        // 1. 먼저 루트 .env 로드 (공통 설정)
        const root_env_path = "../.env";
        std.log.info("Attempting to load root .env from: {s}", .{root_env_path});
        if (std.fs.cwd().readFileAlloc(allocator, root_env_path, 1 * 1024 * 1024)) |root_content| {
            std.log.info("Root .env content loaded, parsing...", .{});
            try self.parseEnvContent(root_content);
            allocator.free(root_content);
            std.log.info("Loaded root .env file", .{});
        } else |err| {
            std.log.warn("Root .env file not found: {s}, skipping", .{@errorName(err)});
        }

        // 2. 백엔드 전용 .env 로드 (덮어쓰기)
        const env_path = ".env";
        std.log.info("Attempting to load backend .env from: {s}", .{env_path});
        const content = std.fs.cwd().readFileAlloc(allocator, env_path, 1 * 1024 * 1024) catch |err| {
            std.log.err("Failed to read backend .env: {s}", .{@errorName(err)});
            return error.EnvFileReadFailed;
        };

        std.log.info("Backend .env content loaded, parsing...", .{});
        try self.parseEnvContent(content);
        try self.vars.put("__full_content__", content);
        std.log.info("Loaded backend .env file", .{});
        return self;
    }

    fn parseEnvContent(self: *Env, content: []const u8) !void {
        std.log.info("Parsing env content, length: {}", .{content.len});
        var lines = std.mem.splitSequence(u8, content, "\n");
        var line_count: u32 = 0;
        while (lines.next()) |line| {
            line_count += 1;
            const trimmed = std.mem.trim(u8, line, " \r");
            if (trimmed.len == 0 or std.mem.startsWith(u8, trimmed, "#")) continue;
            if (std.mem.indexOfScalar(u8, trimmed, '=')) |idx| {
                const key = trimmed[0..idx];
                const value = trimmed[idx + 1 ..];
                std.log.info("Setting env var: {s} = {s}", .{ key, value });

                // Duplicate the key and value to ensure they're owned by our allocator
                const owned_key = try self.allocator.dupe(u8, key);
                const owned_value = try self.allocator.dupe(u8, value);
                try self.vars.put(owned_key, owned_value);
            }
        }
        std.log.info("Parsed {} lines from env content", .{line_count});
    }

    pub fn deinit(self: *Env) void {
        // Free all duplicated keys and values
        var iterator = self.vars.iterator();
        while (iterator.next()) |entry| {
            if (!std.mem.eql(u8, entry.key_ptr.*, "__full_content__")) {
                self.allocator.free(entry.key_ptr.*);
                self.allocator.free(entry.value_ptr.*);
            } else {
                // Free the full content
                self.allocator.free(entry.value_ptr.*);
            }
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
