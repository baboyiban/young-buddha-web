const std = @import("std");
const response = @import("response.zig");

fn get_content_type(path: []const u8) []const u8 {
    if (std.mem.endsWith(u8, path, ".html")) return "text/html";
    if (std.mem.endsWith(u8, path, ".js")) return "application/javascript";
    if (std.mem.endsWith(u8, path, ".css")) return "text/css";
    return "application/octet-stream";
}

pub fn serve_static(client_socket: c_int, allocator: std.mem.Allocator, path: []const u8) void {
    var file_path_buf: [128]u8 = undefined;
    var file_path: []u8 = undefined;
    if (std.mem.eql(u8, path, "/") or std.mem.eql(u8, path, "/index.html")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/index.html", .{}) catch return;
    } else if (std.mem.eql(u8, path, "/main.js")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/main.js", .{}) catch return;
    } else if (std.mem.eql(u8, path, "/script.js")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/script.js", .{}) catch return;
    } else if (std.mem.eql(u8, path, "/style.css")) {
        file_path = std.fmt.bufPrint(&file_path_buf, "../frontend/style.css", .{}) catch return;
    } else {
        response.send_404(client_socket);
        return;
    }

    const file = std.fs.cwd().openFile(file_path, .{}) catch {
        response.send_404(client_socket);
        return;
    };
    defer file.close();

    const stat = file.stat() catch {
        response.send_404(client_socket);
        return;
    };

    const file_buf = allocator.alloc(u8, stat.size) catch {
        response.send_404(client_socket);
        return;
    };
    defer allocator.free(file_buf);

    const read_n = file.readAll(file_buf) catch {
        response.send_404(client_socket);
        return;
    };
    response.send_response(client_socket, "200 OK", get_content_type(file_path), file_buf[0..read_n]);
}
