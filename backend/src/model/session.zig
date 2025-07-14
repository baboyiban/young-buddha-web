// 세션 관련 모델 정의 (필요시 추가)
pub const Session = struct {
    id: []const u8,
    user: @import("user.zig").User,
};
