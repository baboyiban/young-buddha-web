const std = @import("std");
const Env = @import("../config/env.zig").Env;

pub const Service = @import("service.zig").AuthService;
pub const Controller = @import("controller.zig").AuthController;
pub const Middleware = @import("middleware.zig");

/// Auth 모듈의 메인 애플리케이션 구조체
/// Google OAuth2 인증과 JWT 토큰 관리를 담당합니다.
pub const AuthApp = struct {
    service: Service,
    controller: Controller,

    /// AuthApp을 초기화합니다.
    /// allocator: 메모리 할당자
    pub fn init(self: *AuthApp, allocator: std.mem.Allocator) !void {
        self.service = try Service.init(allocator);
        self.controller = Controller.init(&self.service);

        std.log.info("Auth module initialized successfully", .{});
    }

    /// AuthApp을 정리합니다.
    pub fn deinit(self: *AuthApp) void {
        // 필요시 리소스 정리 로직 추가
        _ = self;
    }
};
