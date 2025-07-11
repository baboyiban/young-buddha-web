const std = @import("std");
const zap = @import("zap");
const Env = @import("env.zig").Env;
const OAuthHandler = @import("oauth.zig").OAuthHandler;
const StaticHandler = @import("static.zig").StaticHandler;

// 전역 서버 인스턴스
var global_server: ?Server = null;

// 애플리케이션의 모든 상태를 관리하는 중앙 구조체
const Server = struct {
    allocator: std.mem.Allocator,
    env: Env,
    oauth_handler: OAuthHandler,
    static_handler: StaticHandler,

    pub fn init(allocator: std.mem.Allocator) !Server {
        const env = try Env.init(allocator);
        return .{
            .allocator = allocator,
            .env = env,
            .oauth_handler = try OAuthHandler.init(allocator, env),
            .static_handler = try StaticHandler.init(allocator, env),
        };
    }

    pub fn deinit(self: *Server) void {
        self.oauth_handler.deinit();
        self.static_handler.deinit();
        self.env.deinit();
    }

    // 모든 요청을 처리하는 메인 라우터
    pub fn onRequest(self: *Server, r: zap.Request) !void {
        if (r.path) |path| {
            if (std.mem.eql(u8, path, "/auth/google")) {
                return try self.oauth_handler.handleGoogleAuth(r);
            }
            if (std.mem.eql(u8, path, "/auth/google/callback")) {
                return try self.oauth_handler.handleGoogleCallback(r);
            }
            // 다른 모든 경로는 정적 파일로 처리
            return try self.static_handler.serve(r);
        }

        // 경로가 없는 경우 (이론상 발생하기 어려움)
        r.setStatusNumeric(404);
        try r.sendBody("Not Found");
    }
};

// zap 콜백 함수
fn requestCallback(r: zap.Request) anyerror!void {
    const server = &global_server.?;
    try server.onRequest(r);
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    global_server = try Server.init(allocator);
    defer global_server.?.deinit();

    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = requestCallback,
        .log = true,
    });
    try listener.listen();

    std.log.info("Server running on http://localhost:8080", .{});
    zap.start(.{ .threads = 1, .workers = 1 });
}
