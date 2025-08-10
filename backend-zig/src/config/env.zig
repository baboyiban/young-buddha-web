const std = @import("std");

const EnvVar = struct {
    key: []const u8,
    value: []const u8,
};

pub const Env = struct {
    allocator: std.mem.Allocator,
    vars: std.ArrayList(EnvVar),

    pub fn init(allocator: std.mem.Allocator) !Env {
        var self = Env{
            .allocator = allocator,
            .vars = std.ArrayList(EnvVar).init(allocator),
        };
        errdefer self.deinit(); // 초기화 실패 시 메모리 정리

        // Initialize the ArrayList properly
        try self.vars.ensureTotalCapacity(20);

        // 1. 먼저 루트 .env 로드 (공통 설정)
        const root_env_path = "../.env";
        if (std.fs.cwd().readFileAlloc(allocator, root_env_path, 1 * 1024 * 1024)) |root_content| {
            defer allocator.free(root_content);
            try self.parseEnvContent(root_content);
        } else |err| {
            std.log.warn("Root .env file not found: {s}, skipping", .{@errorName(err)});
        }

        // 2. 백엔드 전용 .env 로드 (덮어쓰기)
        const env_path = ".env";
        if (std.fs.cwd().readFileAlloc(allocator, env_path, 1 * 1024 * 1024)) |content| {
            defer allocator.free(content);
            try self.parseEnvContent(content);
        } else |err| {
            std.log.err("Failed to read backend .env: {s}", .{@errorName(err)});
            return error.EnvFileReadFailed;
        }

        return self;
    }

    fn parseEnvContent(self: *Env, content: []const u8) !void {
        var lines = std.mem.splitSequence(u8, content, "\n");
        var line_count: u32 = 0;
        while (lines.next()) |line| {
            line_count += 1;
            const trimmed = std.mem.trim(u8, line, " \r\t");
            if (trimmed.len == 0 or std.mem.startsWith(u8, trimmed, "#")) continue;
            if (std.mem.indexOfScalar(u8, trimmed, '=')) |idx| {
                const key_slice = trimmed[0..idx];
                const value_slice = trimmed[idx + 1 ..];

                // Trim whitespace from key and value
                const key = std.mem.trim(u8, key_slice, " \t");
                const value = std.mem.trim(u8, value_slice, " \t");

                if (key.len == 0) continue;

                // Duplicate the key and value to ensure they're owned by our allocator
                const owned_key = try self.allocator.dupe(u8, key);
                const owned_value = try self.allocator.dupe(u8, value);

                // Check if key already exists and update it
                var found = false;
                for (self.vars.items) |*env_var| {
                    if (std.mem.eql(u8, env_var.key, owned_key)) {
                        // Free old value and update
                        self.allocator.free(env_var.value);
                        env_var.value = owned_value;
                        self.allocator.free(owned_key); // Free the duplicated key as it's not needed
                        found = true;
                        break;
                    }
                }

                // Key doesn't exist, add new entry
                if (!found) {
                    try self.vars.append(EnvVar{
                        .key = owned_key,
                        .value = owned_value,
                    });
                }
            }
        }
    }

    pub fn deinit(self: *Env) void {
        // Free all duplicated keys and values
        for (self.vars.items) |env_var| {
            self.allocator.free(env_var.key);
            self.allocator.free(env_var.value);
        }
        self.vars.deinit();
    }

    pub fn get(self: Env, key: []const u8) ?[]const u8 {
        for (self.vars.items) |env_var| {
            if (std.mem.eql(u8, env_var.key, key)) {
                return env_var.value;
            }
        }
        return null;
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
