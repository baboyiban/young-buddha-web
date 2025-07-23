pub const PaymentRequest = struct {
    id: i64,
    name: []const u8,
    type: []const u8,
    request_date: []const u8,
    absent_date: []const u8,
    time_slot: ?[]const u8,
    reason: ?[]const u8,
    status: []const u8,
    approver: ?[]const u8,
    approved_at: ?[]const u8,
    comment: ?[]const u8,
};
