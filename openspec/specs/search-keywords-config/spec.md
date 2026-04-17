# Search Keywords Config Specification

## Purpose

Per-project configuration of search keywords used by step-1 script runs, stored in Postgres and managed via the admin UI.

## Requirements

### Requirement: Project stores an ordered list of search keywords
The `projects` table SHALL have a `search_keywords` JSONB column (default `[]`) storing an ordered array of keyword strings. The existing PATCH endpoint for project config SHALL be extended (or a new endpoint added) to allow replacing the keywords array.

#### Scenario: Keywords are saved via API
- **WHEN** a PATCH request is sent to `/api/projects/:id/keywords` with body `{ "searchKeywords": ["школа", "лицей"] }`
- **THEN** the project's `search_keywords` is updated to `["школа", "лицей"]` and the response includes the updated list

#### Scenario: Empty keywords array is valid
- **WHEN** a PATCH request sets `searchKeywords` to `[]`
- **THEN** the update succeeds and subsequent step-1 runs are skipped with a clear log message

### Requirement: Admin UI shows keyword management panel
The project dashboard SHALL include a "Search Keywords" panel with a list of editable rows, an "Add" button that appends a new empty row, and a "Delete" button on each row. Changes are saved via a "Save" button that calls the keywords PATCH endpoint.

#### Scenario: Admin adds a keyword
- **WHEN** the admin clicks "Add", types "детский сад", and clicks "Save"
- **THEN** the keyword is persisted and appears in the list on next page load

#### Scenario: Admin deletes a keyword
- **WHEN** the admin clicks the delete icon on an existing keyword row and clicks "Save"
- **THEN** the keyword is removed from the project's list

#### Scenario: No keywords configured — run is blocked
- **WHEN** the admin triggers step-1 and `search_keywords` is empty
- **THEN** the UI displays a warning that no search keywords are configured and no run is started
