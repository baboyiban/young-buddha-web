const std = @import("std");
const zap = @import("zap");
const AppContext = @import("context.zig").AppContext;
const Router = @import("../web/router.zig").Router;
const setupRoutes = @import("../web/router.zig").setupRoutes;
const globals = @import("../config/globals.zig");
const Logger = @import("../util/logger.zig").Logger;

const logger = Logger.init("Server");

/// 전역 라우터 (zap 라이브러리 요구사항)
pub var global_router: ?Router = null;

/// HTTP 요청 콜백 함수
fn requestCallback(r: zap.Request) anyerror!void {
    const router = &global_router.?;
    router.route(r) catch {
        r.setStatusNumeric(500);
        try r.sendBody("Internal Server Error");
    };
}

/// 서버 관리를 위한 구조체
pub const Server = struct {
    ctx: *AppContext,
    router: Router,

    /// 서버를 초기화합니다.
    pub fn init(ctx: *AppContext) !Server {
        // 전역 컨트롤러 등록
        globals.setControllers(
            &ctx.auth_app.controller,
            &ctx.sheets_app.controller,
            ctx.static_handler,
            &ctx.database_app.controller,
            &ctx.payment_app.controller,
        );

        // 라우터 초기화
        var router = Router.init(ctx.allocator);
        setupRoutes(&router) catch |err| {
            router.deinit();
            return err;
        };

        global_router = router;

        return Server{
            .ctx = ctx,
            .router = router,
        };
    }

    /// 서버를 정리합니다.
    pub fn deinit(self: *Server) void {
        self.router.deinit();
        global_router = null;
    }

    /// HTTP 서버를 시작합니다.
    pub fn start(self: *Server) !void {
        const port = self.ctx.getPort();

        var listener = zap.HttpListener.init(.{
            .port = port,
            .on_request = requestCallback,
            .log = self.ctx.isDevelopment(),
        });

        listener.listen() catch |err| {
            self.logPortTroubleshooting(port);
            return err;
        };

        logger.info("Server is ready to accept connections", .{});

        // 서버 시작 (블로킹)
        zap.start(.{ .threads = 1, .workers = 1 });
    }

    /// 포트 관련 문제 해결 가이드를 로그에 출력합니다.
    fn logPortTroubleshooting(self: *Server, port: u16) void {
        _ = self;
        logger.err("Port {d} binding failed. Possible causes:", .{port});
        logger.err("1. Port {d} is already in use by another process", .{port});
        logger.err("2. Insufficient permissions to bind to port {d}", .{port});
        logger.err("3. Invalid port number {d}", .{port});
        logger.err("Check if another process is using the port: lsof -i :{d}", .{port});
        logger.err("Or try running with a different port using PORT environment variable", .{});
    }
};
