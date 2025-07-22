const std = @import("std");
const sqlite = @import("sqlite");
const PaymentRequest = @import("model.zig").PaymentRequest;

pub const PaymentService = struct {
    allocator: std.mem.Allocator,
    db: *sqlite.Db,

    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) PaymentService {
        return .{ .allocator = allocator, .db = db };
    }

    pub fn createTable(self: *PaymentService) !void {
        try self.db.exec(
            \\CREATE TABLE IF NOT EXISTS payment_request (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    name TEXT NOT NULL,
            \\    type TEXT NOT NULL,
            \\    request_date TEXT NOT NULL,
            \\    absent_date TEXT,
            \\    partial_schedule TEXT,
            \\    reason TEXT
            \\);
        , .{}, .{});
    }

    pub fn addRequest(self: *PaymentService, req: PaymentRequest) !void {
        try self.db.exec("INSERT INTO payment_request (name, type, request_date, absent_date, partial_schedule, reason) VALUES (?, ?, ?, ?, ?, ?)", .{}, .{
            req.name,
            req.type,
            req.request_date,
            req.absent_date orelse null,
            req.partial_schedule orelse null,
            req.reason orelse null,
        });
    }

    pub fn listRequests(self: *PaymentService) ![]PaymentRequest {
        const allocator = self.allocator;
        const Row = PaymentRequest;
        var stmt = try self.db.prepare("SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM payment_request");
        defer stmt.deinit();
        return try stmt.all(Row, allocator, .{}, .{});
    }
};
