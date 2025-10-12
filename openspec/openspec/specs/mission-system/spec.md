# Mission System

## Requirements

### Requirement: Daily Mission Display
The system SHALL display daily missions for users.

#### Scenario: View daily missions
- **WHEN** user visits mission page
- **THEN** system fetches mission data from backend
- **WHEN** mission data is available
- **THEN** system displays date, day of week, and mission assignments

#### Scenario: Mission data not available
- **WHEN** mission data is not available
- **THEN** system shows "미션 데이터가 아직 준비되지 않았습니다" message

### Requirement: Mission Types
The system SHALL support different types of missions.

#### Scenario: Morning meal mission
- **WHEN** morning meal mission exists
- **THEN** system displays "🍚 발우공양 당번" with assigned members

#### Scenario: Morning dishes mission
- **WHEN** morning dishes mission exists
- **THEN** system displays "🧼 아침 설거지" with assigned members

#### Scenario: Evening meal mission
- **WHEN** evening meal mission exists
- **THEN** system displays "🍛 저녁공양 당번" with assigned members

#### Scenario: Evening meeting mission
- **WHEN** evening meeting mission exists
- **THEN** system displays "🌙 닫는 모임 진행" with assigned member