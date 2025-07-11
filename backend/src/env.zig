const std = @import("std");

pub const Env = struct {
    allocator: std.mem.Allocator,
    vars: std.StringHashMap([]const u8),

    // 서버 시작 시 .env 파일을 한 번만 읽어 해시맵에 저장합니다.
    pub fn init(allocator: std.mem.Allocator) !Env {
        var self = Env{
            .allocator = allocator,
            .vars = std.StringHashMap([]const u8).init(allocator),
        };

        const env_path = "../.env";
        const content = std.fs.cwd().readFileAlloc(allocator, env_path, 1 * 1024 * 1024) catch |err| {
            std.log.err("Failed to open or read .env file at '{s}': {s}", .{ env_path, @errorName(err) });
            return error.EnvFileReadFailed;
        };
        // deinit에서 content 전체를 한 번에 해제합니다.
        // 개별 값들은 content의 슬라이스이므로 별도 해제가 필요 없습니다.

        var lines = std.mem.splitSequence(u8, content, "\n");
        while (lines.next()) |line| {
            // 주석이나 빈 줄은 건너뜁니다.
            const trimmed_line = std.mem.trim(u8, line, " \r");
            if (trimmed_line.len == 0 or std.mem.startsWith(u8, trimmed_line, "#")) {
                continue;
            }

            if (std.mem.indexOfScalar(u8, trimmed_line, '=')) |idx| {
                const key = trimmed_line[0..idx];
                const value = trimmed_line[idx + 1 ..];
                try self.vars.put(key, value);
            }
        }

        // 해시맵이 content를 참조하므로, 해시맵이 살아있는 동안 content도 유지되어야 합니다.
        // deinit에서 둘 다 해제합니다.
        try self.vars.put("__full_content__", content); // content를 소유하기 위한 트릭

        return self;
    }

    pub fn deinit(self: *Env) void {
        const content = self.vars.get("__full_content__").?;
        self.allocator.free(content);
        self.vars.deinit();
    }

    // 해시맵에서 값을 즉시 조회합니다.
    pub fn get(self: Env, key: []const u8) ?[]const u8 {
        return self.vars.get(key);
    }
};
