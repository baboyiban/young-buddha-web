pub const PaymentRequest = struct {
    id: i64,
    name: []const u8,
    type: []const u8,
    request_date: []const u8,
    absent_date: ?[]const u8,
    partial_schedule: ?[]const u8,
    reason: ?[]const u8,
};
