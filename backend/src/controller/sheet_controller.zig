const std = @import("std");
const zap = @import("zap");
const SheetService = @import("../service/sheet_service.zig").SheetService;
const sendErrorJson = @import("../handler/error_handler.zig").sendErrorJson;
const jwt_util = @import("../util/jwt.zig");

pub const SheetController = struct {
    sheet_service: *SheetService,
    jwt_secret: []const u8,

    pub fn init(sheet_service: *SheetService, jwt_secret: []const u8) SheetController {
        return .{
            .sheet_service = sheet_service,
            .jwt_secret = jwt_secret,
        };
    }

    pub fn readSheet(self: *SheetController, r: zap.Request) !void {
        const jwt = r.getCookieStr(self.sheet_service.allocator, "jwt") catch null;
        if (jwt) |token| {
            const payload = jwt_util.verifyJwt(self.sheet_service.allocator, token, self.jwt_secret) catch null;
            if (payload) |pl| {
                const access_token = extractJsonString(pl, "\"access_token\":\"") orelse {
                    return sendErrorJson(self.sheet_service.allocator, r, 401, "No access_token in JWT");
                };
                const spreadsheet_id = try self.getQueryParam(r, "spreadsheet_id");
                const range = try self.getQueryParam(r, "range");
                const values_json = try self.sheet_service.getSpreadsheetValues(access_token, spreadsheet_id, range);

                r.setStatusNumeric(200);
                try r.setHeader("Content-Type", "application/json; charset=utf-8");
                try r.sendBody(values_json);
                return;
            }
        }
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
    }

    pub fn writeSheet(self: *SheetController, r: zap.Request) !void {
        const jwt = r.getCookieStr(self.sheet_service.allocator, "jwt") catch null;
        if (jwt) |token| {
            const payload = jwt_util.verifyJwt(self.sheet_service.allocator, token, self.jwt_secret) catch null;
            if (payload) |pl| {
                const access_token = extractJsonString(pl, "\"access_token\":\"") orelse {
                    return sendErrorJson(self.sheet_service.allocator, r, 401, "No access_token in JWT");
                };

                // POST body에서 JSON 데이터 읽기
                const body = r.body orelse {
                    return sendErrorJson(self.sheet_service.allocator, r, 400, "Missing request body");
                };

                const response_json = try self.sheet_service.writeSpreadsheetValues(access_token, body);
                defer self.sheet_service.allocator.free(response_json);

                r.setStatusNumeric(200);
                try r.setHeader("Content-Type", "application/json; charset=utf-8");
                try r.sendBody(response_json);
                return;
            }
        }
        r.setStatusNumeric(401);
        try r.sendBody("{\"error\":true,\"message\":\"Not logged in\"}");
    }

    fn getQueryParam(_: *SheetController, r: zap.Request, param: []const u8) ![]const u8 {
        const query = r.query orelse return error.MissingQuery;
        var params = @import("../util/query.zig").QueryIterator.init(query);
        while (params.next()) |p| {
            if (std.mem.eql(u8, p.key, param)) return p.value;
        }
        return error.ParamNotFound;
    }
};

fn extractJsonString(json: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, json, key)) |start| {
        const val_start = start + key.len;
        if (val_start >= json.len) return null;
        var val_end = val_start;
        while (val_end < json.len and json[val_end] != '"') : (val_end += 1) {}
        return json[val_start..val_end];
    }
    return null;
}
