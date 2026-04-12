## ADDED Requirements

### Requirement: Admin-triggered browser authorization
The system SHALL provide a button that opens a visible Playwright browser window on the local machine so the admin can manually log in to the target website. The resulting session (cookies) SHALL be persisted in the Playwright browser profile directory.

#### Scenario: Admin initiates authorization
- **WHEN** admin clicks "Авторизоваться" in the project dashboard
- **THEN** the backend spawns a Playwright browser in headed (visible) mode and navigates to the project's auth URL (e.g., `https://goszakup.gov.kz/ru/user/login`)

#### Scenario: Session persisted after login
- **WHEN** admin completes the login in the browser and the browser is closed (or a signal is received)
- **THEN** the Playwright persistent browser profile (stored under `data/browser-profile/`) retains the session cookies for future script runs

#### Scenario: Auth status indicator
- **WHEN** a valid session cookie exists in the browser profile
- **THEN** the dashboard shows a green "Авторизован" badge next to the project name

#### Scenario: Auth in progress
- **WHEN** the authorization browser window is open
- **THEN** the dashboard shows a "Авторизация в процессе…" indicator and the "Авторизоваться" button is disabled until the process completes or is cancelled
