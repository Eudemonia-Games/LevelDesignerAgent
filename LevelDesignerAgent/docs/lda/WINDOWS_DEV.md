# Windows Development Guide

## PowerShell Script Execution Policy
If you encounter `SecurityError` or `cannot be loaded because running scripts is disabled` when running `npm` or `pnpm` commands, it is likely due to PowerShell's restricted execution policy.

**Fix:**
Run this command in your PowerShell terminal to allow scripts for the current session:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## Environment Setup
Ensure you have the following installed:
1.  **Node.js**: [Download LTS](https://nodejs.org/) (Ensure "Add to PATH" is checked).
2.  **pnpm**: Install globally via `npm install -g pnpm`.

## Recommended Terminal
We recommend using **PowerShell (with the fix above)** or **Git Bash** for the best experience.
