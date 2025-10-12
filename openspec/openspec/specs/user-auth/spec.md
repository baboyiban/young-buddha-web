# User Authentication

## Requirements

### Requirement: Google OAuth Login
Users MUST be able to authenticate using Google OAuth.

#### Scenario: Successful Google login
- **WHEN** user clicks "Google로 로그인" button
- **THEN** system redirects to Google OAuth page
- **WHEN** user completes Google authentication
- **THEN** system creates JWT tokens and redirects to home page

#### Scenario: Failed Google login
- **WHEN** Google authentication fails
- **THEN** system shows appropriate error message

### Requirement: JWT Token Management
The system SHALL securely manage JWT tokens.

#### Scenario: Token validation
- **WHEN** user makes authenticated request
- **THEN** system validates JWT token from headers

#### Scenario: Token expiration
- **WHEN** JWT token expires
- **THEN** user is redirected to login page

### Requirement: Authentication Guard
Protected pages SHALL require authentication.

#### Scenario: Access protected page
- **WHEN** unauthenticated user accesses protected page
- **THEN** system redirects to login page

#### Scenario: Access with valid token
- **WHEN** authenticated user accesses protected page
- **THEN** system grants access to page content