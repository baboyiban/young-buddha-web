const std = @import("std");

pub const QueryIterator = struct {
    it: std.mem.SplitIterator(u8, .scalar),

    pub fn init(query: []const u8) QueryIterator {
        return .{ .it = std.mem.splitScalar(u8, query, '&') };
    }

    pub fn next(self: *QueryIterator) ?struct { key: []const u8, value: []const u8 } {
        while (self.it.next()) |pair| {
            if (std.mem.indexOfScalar(u8, pair, '=')) |eq| {
                return .{
                    .key = pair[0..eq],
                    .value = pair[eq + 1 ..],
                };
            }
        }
        return null;
    }
};
