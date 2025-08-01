const std = @import("std");
const SheetsService = @import("../sheets/service.zig").SheetsService;
const PaymentRequest = @import("model.zig").PaymentRequest;
const json_util = @import("../util/json.zig");
const google_api = @import("../util/google_api.zig");
const globals = @import("../config/globals.zig");

pub const PaymentService = struct {
    allocator: std.mem.Allocator,
    sheets_service: *SheetsService,
    spreadsheet_id: []const u8,

    pub fn init(
        allocator: std.mem.Allocator,
        sheets_service: *SheetsService,
        spreadsheet_id: []const u8,
    ) PaymentService {
        return .{
            .allocator = allocator,
            .sheets_service = sheets_service,
            .spreadsheet_id = spreadsheet_id,
        };
    }

    pub fn deinit(self: *PaymentService) void {
        _ = self;
    }

    pub fn getRowCount(self: *PaymentService, access_token: []const u8) !usize {
        const range = "데이터베이스_일정결재불참시트!A2:A";
        const response = try self.sheets_service.callSheetsApi(access_token, self.spreadsheet_id, range);
        const values_json = try json_util.extractJsonArray(self.allocator, response, "values") orelse return 0;
        return values_json.len;
    }

    pub fn listRequests(self: *PaymentService, access_token: []const u8, last_n: usize) ![]PaymentRequest {
        // Google Visualization API Query Language를 사용한 쿼리
        const query = try std.fmt.allocPrint(self.allocator, "SELECT * ORDER BY D DESC LIMIT {d}", .{last_n});
        defer self.allocator.free(query);

        const response = try self.sheets_service.callSheetsQueryApi(access_token, self.spreadsheet_id, query);

        // 디버그 로그 추가
        std.log.info("Payment Service Query Response: {s}", .{response});

        // gviz 응답 파싱 - /*O_o*/google.visualization.Query.setResponse() 형식에서 JSON 부분만 추출
        // "setResponse(" 이후의 JSON 부분을 추출
        const set_response_start = std.mem.indexOf(u8, response, "setResponse(") orelse {
            std.log.err("Invalid gviz response format - no setResponse found", .{});
            return &[_]PaymentRequest{};
        };

        const json_start = set_response_start + "setResponse(".len;
        var json_end = response.len;
        var brace_count: i32 = 1;

        // JSON 객체의 끝을 찾기 (괄호 짝 맞추기)
        for (response[json_start..], json_start..) |char, i| {
            if (char == '{') {
                brace_count += 1;
            } else if (char == '}') {
                brace_count -= 1;
                if (brace_count == 0) {
                    json_end = i + 1;
                    break;
                }
            }
        }

        if (brace_count != 0) {
            std.log.err("Invalid gviz response format - unmatched braces", .{});
            return &[_]PaymentRequest{};
        }

        const json_response = response[json_start..json_end];
        std.log.info("Extracted JSON: {s}", .{json_response});

        // gviz 응답 파싱
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, json_response, .{});
        defer parsed.deinit();

        // table 객체 추출
        const table_obj = if (parsed.value == .object)
            if (parsed.value.object.get("table")) |table_val|
                if (table_val == .object) table_val.object else return &[_]PaymentRequest{}
            else
                return &[_]PaymentRequest{}
        else
            return &[_]PaymentRequest{};

        // rows 배열 추출
        const rows_json = if (table_obj.get("rows")) |rows_val|
            if (rows_val == .array) rows_val.array.items else return &[_]PaymentRequest{}
        else
            return &[_]PaymentRequest{};

        var list = try self.allocator.alloc(PaymentRequest, rows_json.len);
        for (rows_json, 0..) |row, i| {
            if (row == .object) {
                const row_obj = row.object;
                const cells_json = if (row_obj.get("c")) |c_val|
                    if (c_val == .array) c_val.array.items else {
                        list[i] = PaymentRequest{
                            .id = 0,
                            .name = "",
                            .type = "",
                            .request_date = "",
                            .absent_date = "",
                            .time_slot = null,
                            .reason = null,
                            .status = "",
                            .approver = null,
                            .approved_at = null,
                            .comment = null,
                        };
                        continue;
                    }
                else {
                    list[i] = PaymentRequest{
                        .id = 0,
                        .name = "",
                        .type = "",
                        .request_date = "",
                        .absent_date = "",
                        .time_slot = null,
                        .reason = null,
                        .status = "",
                        .approver = null,
                        .approved_at = null,
                        .comment = null,
                    };
                    continue;
                };

                // gviz 응답 형식에 맞게 파싱
                const getCellString = struct {
                    fn get(allocator: std.mem.Allocator, cells: []const std.json.Value, index: usize) ?[]const u8 {
                        if (index >= cells.len) return null;
                        const cell = cells[index];
                        if (cell == .object) {
                            const cell_obj = cell.object;
                            if (cell_obj.get("v")) |value| {
                                if (value == .string) return value.string;
                                if (value == .integer) {
                                    const str = std.fmt.allocPrint(allocator, "{d}", .{value.integer}) catch return null;
                                    return str;
                                }
                                if (value == .float) {
                                    const str = std.fmt.allocPrint(allocator, "{d}", .{value.float}) catch return null;
                                    return str;
                                }
                            }
                        }
                        return null;
                    }
                };

                list[i] = PaymentRequest{
                    .id = if (getCellString.get(self.allocator, cells_json, 0)) |id_str| std.fmt.parseInt(i64, id_str, 10) catch 0 else 0,
                    .name = if (getCellString.get(self.allocator, cells_json, 1)) |v| v else "",
                    .type = if (getCellString.get(self.allocator, cells_json, 2)) |v| v else "",
                    .request_date = if (getCellString.get(self.allocator, cells_json, 3)) |v| v else "",
                    .absent_date = if (getCellString.get(self.allocator, cells_json, 4)) |v| v else "",
                    .time_slot = if (getCellString.get(self.allocator, cells_json, 5)) |v| if (v.len > 0) v else null else null,
                    .reason = if (getCellString.get(self.allocator, cells_json, 6)) |v| if (v.len > 0) v else null else null,
                    .status = if (getCellString.get(self.allocator, cells_json, 7)) |v| v else "",
                    .approver = if (getCellString.get(self.allocator, cells_json, 8)) |v| if (v.len > 0) v else null else null,
                    .approved_at = if (getCellString.get(self.allocator, cells_json, 9)) |v| if (v.len > 0) v else null else null,
                    .comment = if (getCellString.get(self.allocator, cells_json, 10)) |v| if (v.len > 0) v else null else null,
                };
            } else {
                list[i] = PaymentRequest{
                    .id = 0,
                    .name = "",
                    .type = "",
                    .request_date = "",
                    .absent_date = "",
                    .time_slot = null,
                    .reason = null,
                    .status = "",
                    .approver = null,
                    .approved_at = null,
                    .comment = null,
                };
            }
        }
        return list;
    }

    pub fn addRequest(
        self: *PaymentService,
        access_token: []const u8,
        refresh_token: []const u8,
        req: PaymentRequest,
    ) !void {
        const row_count = try self.getRowCount(access_token);
        const id = row_count + 1;

        const range = "데이터베이스_일정불참결재시트";
        var buf = std.ArrayList(u8).init(self.allocator);
        defer buf.deinit();

        try buf.appendSlice("{\"values\":[[");
        try buf.writer().print("{d},", .{id});
        try std.json.encodeJsonString(req.name, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.type, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.request_date, .{}, buf.writer());
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.absent_date, .{}, buf.writer());
        try buf.appendSlice(",");
        if (req.time_slot) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.reason) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        try std.json.encodeJsonString(req.status, .{}, buf.writer());
        try buf.appendSlice(",");
        if (req.approver) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.approved_at) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice(",");
        if (req.comment) |v| {
            try std.json.encodeJsonString(v, .{}, buf.writer());
        } else {
            try buf.appendSlice("null");
        }
        try buf.appendSlice("]]}");

        const values_json = buf.items;

        const context = .{
            .sheets_service = self.sheets_service,
            .spreadsheet_id = self.spreadsheet_id,
            .range = range,
            .values_json = values_json,
        };

        const result = try google_api.callGoogleApiWithRefresh(
            self.allocator,
            self.sheets_service.auth_service,
            access_token,
            refresh_token,
            context,
            (struct {
                pub fn call(ctx: anytype, token: []const u8) anyerror![]u8 {
                    return ctx.sheets_service.appendSheetsApi(token, ctx.spreadsheet_id, ctx.range, ctx.values_json);
                }
            }).call,
        );

        _ = result;
    }
};
