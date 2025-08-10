const std = @import("std");

pub const QueryRequest = struct {
    spreadsheet_id: []const u8,
    query: []const u8,
};
