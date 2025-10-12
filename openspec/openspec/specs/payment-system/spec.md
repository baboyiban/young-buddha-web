# Payment System

## Requirements

### Requirement: Payment Application
Users MUST be able to apply for payments.

#### Scenario: Submit payment application
- **WHEN** user fills payment form with type, absent date, schedule, and reason
- **THEN** system validates form data
- **WHEN** validation passes
- **THEN** payment is submitted to backend and stored in Google Sheets

#### Scenario: Payment type filtering
- **WHEN** user selects payment type filter (전체/정기/비정기)
- **THEN** system shows only payments matching selected type

### Requirement: Payment Management
Users MUST be able to manage their payment applications.

#### Scenario: Edit payment
- **WHEN** user clicks edit button on payment
- **THEN** system shows editable form for that payment
- **WHEN** user saves changes
- **THEN** payment is updated in backend

#### Scenario: Delete payment
- **WHEN** user clicks delete button on payment
- **THEN** system confirms deletion
- **WHEN** user confirms
- **THEN** payment is removed from backend

### Requirement: Approval Management (Admin)
Admins MUST be able to approve/reject payments.

#### Scenario: Single approval
- **WHEN** admin clicks approve/reject button on payment
- **THEN** payment status is updated

#### Scenario: Batch approval
- **WHEN** admin selects multiple payments
- **THEN** system allows batch approval/rejection
- **WHEN** admin performs batch action
- **THEN** all selected payments are updated