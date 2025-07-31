const std = @import("std");
const AppContext = @import("context.zig").AppContext;
const Server = @import("server.zig").Server;
const Logger = @import("../util/logger.zig").Logger;

const logger = Logger.init("Launcher");

/// 애플리케이션 런처
/// 전체 애플리케이션의 생명주기를 관리합니다.
pub const Launcher = struct {
    allocator: std.mem.Allocator,
    ctx: ?AppContext = null,
    server: ?Server = null,

    /// 런처를 초기화합니다.
    pub fn init(allocator: std.mem.Allocator) Launcher {
        return .{ .allocator = allocator };
    }

    /// 애플리케이션을 시작합니다.
    pub fn run(self: *Launcher) !void {
        logger.info("Starting Young Buddha Web Server...", .{});

        // 애플리케이션 컨텍스트 초기화
        self.ctx = AppContext.init(self.allocator) catch |err| {
            logger.err("Failed to initialize application context: {any}", .{err});
            return err;
        };

        // 서버 초기화
        self.server = Server.init(&self.ctx.?) catch |err| {
            logger.err("Failed to initialize server: {any}", .{err});
            return err;
        };

        // 서버 시작 (블로킹)
        self.server.?.start() catch |err| {
            logger.err("Failed to start server: {any}", .{err});
            return err;
        };
    }

    /// 애플리케이션을 정리합니다.
    pub fn deinit(self: *Launcher) void {
        logger.info("Shutting down application...", .{});

        if (self.server) |*server| {
            server.deinit();
        }

        if (self.ctx) |*ctx| {
            ctx.deinit();
        }

        logger.info("Application shutdown complete", .{});
    }
};
