const std = @import("std");
const Logger = @import("logger.zig").Logger;

/// 에러 처리를 위한 매크로들
pub fn logAndReturn(comptime logger_instance: Logger, comptime message: []const u8, args: anytype, comptime return_error: anyerror) anyerror {
    logger_instance.err(message, args);
    return return_error;
}

/// HTTP 요청 에러를 처리하는 매크로
pub fn handleHttpError(comptime logger_instance: Logger, err: anyerror, comptime operation: []const u8) anyerror {
    return switch (err) {
        error.InvalidUrl => logAndReturn(logger_instance, "Invalid URL for " ++ operation, .{}, error.InvalidUrl),
        error.OutOfMemory => logAndReturn(logger_instance, "Out of memory during " ++ operation, .{}, error.OutOfMemory),
        else => logAndReturn(logger_instance, "HTTP error during " ++ operation ++ ": {any}", .{err}, error.HttpRequestFailed),
    };
}

/// 일반적인 try-catch 패턴을 간소화하는 매크로
pub fn tryOrLog(comptime logger_instance: Logger, operation: anytype, comptime error_message: []const u8, comptime return_error: anyerror) !@TypeOf(operation) {
    return operation catch |err| {
        logger_instance.err(error_message ++ ": {any}", .{err});
        return return_error;
    };
}
