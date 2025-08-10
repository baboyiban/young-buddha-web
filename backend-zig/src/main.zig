const std = @import("std");
const Launcher = @import("core/launcher.zig").Launcher;

/// 애플리케이션 진입점
/// 메모리 관리와 애플리케이션 생명주기만 담당합니다.
pub fn main() !void {
    // 메모리 할당자 초기화
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // 애플리케이션 런처 초기화 및 실행
    var launcher = Launcher.init(allocator);
    defer launcher.deinit();

    try launcher.run();
}
