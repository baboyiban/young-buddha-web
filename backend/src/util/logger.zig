const std = @import("std");

/// 로그 레벨 정의
pub const LogLevel = enum {
    debug,
    info,
    warn,
    err,

    pub fn toString(self: LogLevel) []const u8 {
        return switch (self) {
            .debug => "DEBUG",
            .info => "INFO",
            .warn => "WARN",
            .err => "ERROR",
        };
    }
};

/// 구조화된 로깅을 위한 헬퍼 함수들
pub const Logger = struct {
    module: []const u8,

    pub fn init(module: []const u8) Logger {
        return .{ .module = module };
    }

    pub fn debug(self: Logger, comptime fmt: []const u8, args: anytype) void {
        self.log(.debug, fmt, args);
    }

    pub fn info(self: Logger, comptime fmt: []const u8, args: anytype) void {
        self.log(.info, fmt, args);
    }

    pub fn warn(self: Logger, comptime fmt: []const u8, args: anytype) void {
        self.log(.warn, fmt, args);
    }

    pub fn err(self: Logger, comptime fmt: []const u8, args: anytype) void {
        self.log(.err, fmt, args);
    }

    fn log(self: Logger, level: LogLevel, comptime fmt: []const u8, args: anytype) void {
        const timestamp = std.time.timestamp();
        const log_fmt = "[{d}] {s} [{s}] " ++ fmt;

        switch (level) {
            .debug => std.log.debug(log_fmt, .{ timestamp, level.toString(), self.module } ++ args),
            .info => std.log.info(log_fmt, .{ timestamp, level.toString(), self.module } ++ args),
            .warn => std.log.warn(log_fmt, .{ timestamp, level.toString(), self.module } ++ args),
            .err => std.log.err(log_fmt, .{ timestamp, level.toString(), self.module } ++ args),
        }
    }
};
