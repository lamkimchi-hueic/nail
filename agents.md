# AI Agent Guidelines for Nail Booking System

To ensure optimal performance, prevent resource waste, and avoid system freezes, all AI agents must follow these guidelines:

## 1. File Handling & Reading
- **Avoid reading large files entirely**: `resources/js/app.jsx` is over 2500 lines. Never read it from start to finish. Always use `view_file` with `StartLine` and `EndLine` to read specific sections.
- **Use targeted searches**: Use `grep_search` or `run_command` with `Select-String` (PowerShell) to find specific functions or components before reading code.
- **Component Separation**: Prioritize refactoring `app.jsx` into smaller, modular components in `resources/js/components/` and `resources/js/pages/`.

## 2. API & Data Handling
- **Defensive Programming**: Always check if data is an array before calling `.map()`.
  - Preferred: `(data || []).map(...)` or `Array.isArray(data) ? data.map(...) : null`
- **Error Handling**: Every `fetch` call must handle non-200 responses and network errors to prevent UI crashes.
- **Loading States**: Always manage loading states to prevent "A.map is not a function" errors when data is still being fetched.

## 3. Resource Optimization
- **Minimal Tool Calls**: Don't call `list_dir` recursively on the whole project. Target specific directories.
- **Batch Edits**: When modifying `app.jsx`, use `multi_replace_file_content` to make multiple changes in one go instead of many small `replace_file_content` calls.
- **Cleanup**: If you find dead code or unused imports, remove them to keep the file size manageable.

## 4. Troubleshooting Workflow
1. Identify the failing API endpoint (e.g., check `routes/api.php`).
2. Verify the Controller logic (e.g., `app/Http/Controllers/`).
3. Check the Frontend fetch logic and state management.
4. Verify that the UI handles both "Empty" and "Error" states gracefully.
