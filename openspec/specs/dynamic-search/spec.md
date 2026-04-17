# Dynamic Search Specification

## Purpose

Step-1 script accepts a dynamic keyword argument, fills the goszakup search form, and proceeds with ID collection on the filtered result set.

## Requirements

### Requirement: Script navigates to search page and fills form dynamically
The step-1 script SHALL accept a `--keyword <text>` CLI argument. When provided, the script SHALL navigate to `https://goszakup.gov.kz/ru/search/announce`, fill the "Наименование объявления" input with the keyword value, select all three status options ("Опубликовано", "Опубликовано (прием заявок)", "Опубликовано (прием ценовых предложений)"), click the "Найти" button, and wait for the results to load before proceeding with ID collection.

#### Scenario: Keyword is provided and search succeeds
- **WHEN** the script is launched with `--keyword "школа"`
- **THEN** it navigates to the search page, sets "Наименование объявления" to "школа", selects the three status checkboxes, clicks "Найти", and waits for result rows to appear before collecting IDs

#### Scenario: No keyword argument provided
- **WHEN** the script is launched without `--keyword`
- **THEN** the script exits with a non-zero code and logs an error message stating that `--keyword` is required

### Requirement: Script extracts "Название" from the correct DOM element
The step-1 script SHALL extract the announcement title from the same table cell as "Организатор", reading the text that appears before the "Организатор:" label within that cell.

#### Scenario: Cell contains both title and organizer
- **WHEN** a result row's organizer cell contains text in the format `"Название школы\nОрганизатор: ..."`,
- **THEN** the script extracts "Название школы" as the `title` value

#### Scenario: Cell contains only organizer (no title prefix)
- **WHEN** the organizer cell starts directly with "Организатор:"
- **THEN** the script sets `title` to `null` or empty string

### Requirement: Script proceeds with existing ID collection after search
After the search results are loaded the script SHALL continue its existing announcement-ID collection loop across all result pages without modification to the pagination logic.

#### Scenario: Search returns multiple pages
- **WHEN** the search results span multiple pages
- **THEN** the script collects IDs from all pages using existing pagination handling
