const std = @import("std");
const User = @import("../model/user.zig").User;

pub const SessionService = struct {
    allocator: std.mem.Allocator,
    sessions: std.StringHashMap(User),

    pub fn init(allocator: std.mem.Allocator) SessionService {
        return .{
            .allocator = allocator,
            .sessions = std.StringHashMap(User).init(allocator),
        };
    }

    pub fn deinit(self: *SessionService) void {
        self.sessions.deinit();
    }

    pub fn createSession(self: *SessionService, user: User) ![]const u8 {
        var session_id_bytes: [32]u8 = undefined;
        std.crypto.random.bytes(&session_id_bytes);
        const session_id = try std.fmt.allocPrint(self.allocator, "{s}", .{std.fmt.fmtSliceHexLower(&session_id_bytes)});
        try self.sessions.put(session_id, user);
        return session_id;
    }

    pub fn getUser(self: *SessionService, session_id: []const u8) ?User {
        return self.sessions.get(session_id);
    }

    pub fn destroySession(self: *SessionService, session_id: []const u8) void {
        _ = self.sessions.remove(session_id);
    }
};
