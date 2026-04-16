# Script Docs Specification

## Purpose

In-dashboard documentation panel describing each project's scripts and surfacing their most recent run status.

## Requirements

### Requirement: Script documentation panel
The system SHALL display a documentation panel in each project's dashboard listing all scripts/steps for that project. Each entry MUST show the script name, a short description, and its current run status.

#### Scenario: Admin views script docs for Project 1
- **WHEN** admin opens the Project 1 dashboard and scrolls to the Scripts section
- **THEN** a list shows two entries: "Step 1 – Сбор ID объявлений" and "Step 2 – Сбор деталей объявления", each with their description text

#### Scenario: Script description content
- **WHEN** the scripts panel renders
- **THEN** each entry shows: script file name, human-readable title, multi-line description explaining what the script does, and the timestamp of the last successful run

### Requirement: Last run status per script
The system SHALL show the outcome of the most recent run for each script in the documentation panel.

#### Scenario: Step 1 last run succeeded
- **WHEN** the most recent `script_runs` row for Step 1 has `status = 'success'`
- **THEN** the Step 1 entry shows a green badge with "Последний запуск: <timestamp>"

#### Scenario: Step 1 last run failed
- **WHEN** the most recent `script_runs` row for Step 1 has `status = 'error'`
- **THEN** the Step 1 entry shows a red badge and the captured error summary
