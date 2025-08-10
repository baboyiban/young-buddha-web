const std = @import("std");

/// 모든 App 구조체의 기본 인터페이스
pub fn BaseApp(comptime ServiceType: type, comptime ControllerType: type) type {
    return struct {
        const Self = @This();

        service: ServiceType,
        controller: ControllerType,

        /// 기본 초기화 패턴
        pub fn initServiceController(self: *Self, service: ServiceType) void {
            self.service = service;
            self.controller = ControllerType.init(&self.service);
        }

        /// 기본 정리 패턴
        pub fn deinit(self: *Self) void {
            // 기본적으로는 아무것도 하지 않음
            // 필요한 경우 각 App에서 오버라이드
            _ = self;
        }
    };
}
