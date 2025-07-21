pub const Errors = struct {
    // 인증 관련 에러
    pub const MissingAuthCode: []const u8 = "Missing authorization code";
    pub const MissingState: []const u8 = "Missing state parameter";
    pub const InvalidSession: []const u8 = "Invalid session: no state cookie";
    pub const StateMismatch: []const u8 = "State mismatch";
    pub const ExchangeFailed: []const u8 = "Failed to exchange authorization code";
    pub const UserInfoFailed: []const u8 = "Failed to get user info";
    pub const TokenExpired: []const u8 = "Token expired";
    pub const InvalidToken: []const u8 = "Invalid token";
    pub const NoToken: []const u8 = "Not logged in";
    pub const NoAccessToken: []const u8 = "No access token in JWT";

    // Google Sheets 관련 에러
    pub const MissingSpreadsheetId: []const u8 = "Missing spreadsheet_id parameter";
    pub const MissingRange: []const u8 = "Missing range parameter";
    pub const ReadFailed: []const u8 = "Failed to read spreadsheet data";
    pub const WriteFailed: []const u8 = "Failed to write spreadsheet data";

    // 일반 에러
    pub const NotFound: []const u8 = "Not found";
    pub const InvalidPath: []const u8 = "Invalid path";
};
