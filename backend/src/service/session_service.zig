const std = @import("std");

pub const SessionService = struct {
    allocator: std.mem.Allocator,
    sessions: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator) SessionService {
        return .{
            .allocator = allocator,
            .sessions = std.StringHashMap([]const u8).init(allocator),
        };
    }

    pub fn deinit(self: *SessionService) void {
        var it = self.sessions.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.value_ptr.*);
        }
        self.sessions.deinit();
    }

    pub fn createSession(self: *SessionService, user_info: []const u8) ![]const u8 {
        var session_id_bytes: [32]u8 = undefined;
        std.crypto.random.bytes(&session_id_bytes);
        const session_id = try std.fmt.allocPrint(self.allocator, "{s}", .{std.fmt.fmtSliceHexLower(&session_id_bytes)});
        try self.sessions.put(session_id, try self.allocator.dupe(u8, user_info));
        return session_id;
    }

    pub fn getUserInfo(self: *SessionService, session_id: []const u8) ?[]const u8 {
        return self.sessions.get(session_id);
    }

    pub fn destroySession(self: *SessionService, session_id: []const u8) void {
        if (self.sessions.get(session_id)) |user_info| {
            self.allocator.free(user_info);
        }
        _ = self.sessions.remove(session_id);
    }
};
