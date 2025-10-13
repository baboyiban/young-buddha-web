//! Utilities module for backend
//!
//! This module exposes small utility submodules used across the backend,
//! for example structured logging and simple performance helpers.

pub mod logging;

// Re-export commonly used items from the logging module for easier access.
pub use logging::{
    ServiceInitLog,
    InitStatus,
    ServiceInitializer,
    PerformanceMonitor,
    log_health_check,
    log_db_operation,
    log_external_api_call,
    log_performance_metric,
};
