use serde::Serialize;
use std::time::Instant;
use tracing::{info, warn, error};

#[derive(Debug, Clone, Serialize)]
pub struct ServiceInitLog {
    pub service: String,
    pub status: InitStatus,
    pub duration_ms: u64,
    pub details: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum InitStatus {
    Started,
    Success,
    Failed,
    Skipped,
}

pub struct ServiceInitializer {
    service_name: String,
    start_time: Instant,
}

impl ServiceInitializer {
    pub fn new(service_name: impl Into<String>) -> Self {
        let service_name = service_name.into();
        let start_time = Instant::now();

        info!(
            service = %service_name,
            status = "started",
            "Service initialization started"
        );

        Self { service_name, start_time }
    }

    pub fn success(self, details: Option<String>) {
        let duration = self.start_time.elapsed().as_millis() as u64;

        info!(
            service = %self.service_name,
            status = "success",
            duration_ms = duration,
            details = ?details,
            "Service initialized successfully"
        );
    }

    pub fn failed(self, error: &str) {
        let duration = self.start_time.elapsed().as_millis() as u64;

        error!(
            service = %self.service_name,
            status = "failed",
            duration_ms = duration,
            error = %error,
            "Service initialization failed"
        );
    }

    pub fn skipped(self, reason: &str) {
        warn!(
            service = %self.service_name,
            status = "skipped",
            reason = %reason,
            "Service initialization skipped"
        );
    }
}

// 헬스 체크 로깅 구조화
pub fn log_health_check(component: &str, status: bool, latency_ms: Option<u64>) {
    if status {
        info!(
            component = %component,
            healthy = true,
            latency_ms = ?latency_ms,
            "Health check passed"
        );
    } else {
        error!(
            component = %component,
            healthy = false,
            latency_ms = ?latency_ms,
            "Health check failed"
        );
    }
}

// 데이터베이스 연산 로깅 구조화
pub fn log_db_operation(operation: &str, table: &str, success: bool, duration_ms: u64, rows_affected: Option<usize>) {
    if success {
        info!(
            db_operation = %operation,
            table = %table,
            success = true,
            duration_ms = duration_ms,
            rows_affected = ?rows_affected,
            "Database operation completed"
        );
    } else {
        error!(
            db_operation = %operation,
            table = %table,
            success = false,
            duration_ms = duration_ms,
            "Database operation failed"
        );
    }
}

// 외부 API 호출 로깅 구조화
pub fn log_external_api_call(endpoint: &str, method: &str, status_code: u16, duration_ms: u64) {
    let level = if status_code >= 200 && status_code < 400 {
        "info"
    } else if status_code >= 400 && status_code < 500 {
        "warn"
    } else {
        "error"
    };

    if level == "error" {
        error!(
            api_endpoint = %endpoint,
            http_method = %method,
            status_code = status_code,
            duration_ms = duration_ms,
            "External API call failed"
        );
    } else if level == "warn" {
        warn!(
            api_endpoint = %endpoint,
            http_method = %method,
            status_code = status_code,
            duration_ms = duration_ms,
            "External API call returned client error"
        );
    } else {
        info!(
            api_endpoint = %endpoint,
            http_method = %method,
            status_code = status_code,
            duration_ms = duration_ms,
            "External API call completed"
        );
    }
}

// 성능 메트릭 로깅
pub fn log_performance_metric(metric_name: &str, value: f64, unit: &str, tags: Option<Vec<(&str, &str)>>) {
    info!(
        metric_name = %metric_name,
        metric_value = value,
        unit = %unit,
        tags = ?tags,
        "Performance metric recorded"
    );
}

// 성능 모니터링 구조체
pub struct PerformanceMonitor {
    operation: String,
    start_time: Instant,
}

impl PerformanceMonitor {
    pub fn new(operation: impl Into<String>) -> Self {
        Self {
            operation: operation.into(),
            start_time: Instant::now(),
        }
    }

    pub fn complete(self, success: bool) {
        let duration_ms = self.start_time.elapsed().as_millis() as u64;

        if success {
            info!(
                operation = %self.operation,
                duration_ms = duration_ms,
                status = "completed",
                "Operation completed successfully"
            );
        } else {
            warn!(
                operation = %self.operation,
                duration_ms = duration_ms,
                status = "failed",
                "Operation failed"
            );
        }
    }
}
