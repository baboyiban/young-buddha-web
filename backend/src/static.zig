const std = @import("std");
const zap = @import("zap");

fn get_content_type(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html")) return "text/html";
    if (std.mem.endsWith(u8, path, ".js")) return "application/javascript";
    if (std.mem.endsWith(u8, path, ".css")) return "text/css";
    return "application/octet-stream";
}

pub fn serve_static(r: zap.Request) !void {
    const path = r.path orelse "/";
    var file_path_buf: [128]u8 = undefined;
    var file_path: []u8 = undefined;
    if (std.mem.eql(u8, path, "/") or std.mem.eql(u8, path, "/index.html")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/src/index.html", .{}) catch return try send_404(r);
    } else if (std.mem.eql(u8, path, "/script.js")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/src/script.js", .{}) catch return try send_404(r);
    } else if (std.mem.eql(u8, path, "/style.css")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/src/style.css", .{}) catch return try send_404(r);
    } else {
        return try send_404(r);
    }

    const file = std.fs.cwd().openFile(file_path, .{}) catch return try send_404(r);
    defer file.close();

    const stat = file.stat() catch return try send_404(r);

    const allocator = std.heap.page_allocator;
    const file_buf = allocator.alloc(u8, stat.size) catch return try send_404(r);
    defer allocator.free(file_buf);

    const read_n = file.readAll(file_buf) catch return try send_404(r);

    r.setStatus(zap.http.StatusCode.ok);
    try r.setHeader("Content-Type", get_content_type(file_path));
    try r.sendBody(file_buf[0..read_n]);
}

fn send_404(r: zap.Request) !void {
    r.setStatus(zap.http.StatusCode.not_found);
    try r.sendBody("Not Found");
}
