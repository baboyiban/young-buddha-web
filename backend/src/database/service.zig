const std = @import("std");
const sqlite = @import("sqlite");
const DatabaseRequest = @import("model.zig").DatabaseRequest;
const globals = @import("../config/globals.zig");

pub const DatabaseService = struct {
    allocator: std.mem.Allocator,
    db: *sqlite.Db,

    pub fn init(allocator: std.mem.Allocator, db: *sqlite.Db) DatabaseService {
        return .{ .allocator = allocator, .db = db };
    }

    pub fn deinit(self: *DatabaseService) void {
        _ = self;
    }

    pub fn createTable(self: *DatabaseService) !void {
        try self.db.exec(
            \\CREATE TABLE IF NOT EXISTS database_request (
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

    pub fn addRequest(self: *DatabaseService, req: DatabaseRequest) !void {
        try self.db.exec("INSERT INTO database_request (name, type, request_date, absent_date, partial_schedule, reason) VALUES (?, ?, ?, ?, ?, ?)", .{}, .{
            req.name,
            req.type,
            req.request_date,
            req.absent_date orelse null,
            req.partial_schedule orelse null,
            req.reason orelse null,
        });
    }

    pub fn listRequests(self: *DatabaseService) ![]DatabaseRequest {
        const allocator = self.allocator;
        const Row = DatabaseRequest;
        var stmt = try self.db.prepare("SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM database_request");
        defer stmt.deinit();
        return try stmt.all(Row, allocator, .{}, .{});
    }
};
