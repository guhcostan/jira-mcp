# Changelog

## [2.5.0] - 2025-10-16

### Added
- **`jira_get_issue_types`**: New tool to list all available issue types in the Jira instance
- **`jira_search_projects`**: New tool to search projects by name or key pattern (case-insensitive)
- **`jira_get_metrics_summary`**: New tool to get consolidated metrics summary across multiple projects
- **`jira_get_metrics_by_project`**: New tool to get detailed metrics breakdown by project

### Features
- Support for filtering issues by creation date (`createdSince` parameter)
- Automatic percentage calculations in metrics summaries
- Project-level metrics aggregation
- Pattern-based project search functionality

### Improvements
- Enhanced error handling in metrics collection (continues even if individual project query fails)
- Better structured responses with totals and breakdowns
- Sorted results by total count (descending order)

### Use Cases
These new tools enable:
- Generating comprehensive project metrics reports
- Analyzing issue distribution across multiple projects
- Tracking issue types with date filters
- Creating dashboards and analytics from Jira data

## [2.4.0] - Previous Version
- Base Jira MCP functionality
- CRUD operations for issues
- Project and sprint management
- Agile board operations

