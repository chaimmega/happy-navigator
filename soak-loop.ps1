# soak-loop.ps1 — overnight regression hunter
#
# Runs the full e2e suite repeatedly for 8 hours.
# On failure: attempts autofix via soak-autofix.js, re-runs the failed file.
# Stops after 3 consecutive unfixed failures.
# Writes a summary to soak-summary.md at the end.

$stop               = (Get-Date).AddHours(8)
$log                = "soak-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$consecutiveFailures = 0
$totalRuns           = 0
$totalPasses         = 0
$totalFailures       = 0
$totalFixes          = 0

function Log($msg) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  "$ts  $msg" | Tee-Object -FilePath $log -Append
}

Log "=== Soak loop started — runs until $stop ==="
Log "    Full suite: npm run test:e2e"
Log "    Autofix:    node scripts/soak-autofix.js playwright-report/results.json"
Log ""

while ((Get-Date) -lt $stop) {
  $totalRuns++
  Log "--- Run #$totalRuns ---"

  # 1. Run full suite
  npm run test:e2e 2>&1 | Tee-Object -FilePath $log -Append
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    $totalPasses++
    $consecutiveFailures = 0
    Log "PASS  (total passes: $totalPasses)"
    continue
  }

  # 2. Suite failed — try autofix
  $totalFailures++
  Log "FAIL  exit=$exitCode  (total failures: $totalFailures, consecutive: $($consecutiveFailures + 1))"

  if (Test-Path "playwright-report/results.json") {
    Log "      Running autofix..."
    node scripts/soak-autofix.js playwright-report/results.json 2>&1 |
      Tee-Object -FilePath $log -Append
    $autofixExit = $LASTEXITCODE

    if ($autofixExit -eq 0) {
      # Fixes were applied — re-run the soak suite specifically
      $totalFixes++
      $consecutiveFailures = 0
      Log "      Autofix applied (total fixes: $totalFixes). Re-running soak suite..."
      npm run test:e2e:soak 2>&1 | Tee-Object -FilePath $log -Append
      $rerunExit = $LASTEXITCODE
      if ($rerunExit -eq 0) {
        Log "      Re-run PASSED after autofix."
        $totalPasses++
      } else {
        Log "      Re-run FAILED after autofix — counting as unfixed failure."
        $consecutiveFailures++
      }
    } else {
      # Nothing fixable
      $consecutiveFailures++
      Log "      Autofix found nothing to fix. Consecutive unfixed failures: $consecutiveFailures"
    }
  } else {
    $consecutiveFailures++
    Log "      No results.json found — cannot autofix. Consecutive: $consecutiveFailures"
  }

  # 3. Stop after 3 consecutive unfixed failures
  if ($consecutiveFailures -ge 3) {
    Log "STOP  3 consecutive unfixed failures — halting loop."
    break
  }
}

# Write soak-summary.md
$endTime  = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$stopReason = if ($consecutiveFailures -ge 3) { "3 consecutive unfixed failures" } else { "8-hour time limit reached" }

$summaryLines = @(
  "# Soak Loop Summary",
  "",
  "**Ended:** $endTime",
  "**Log file:** $log",
  "",
  "## Stats",
  "",
  "- Total runs:              $totalRuns",
  "- Passes:                  $totalPasses",
  "- Failures:                $totalFailures",
  "- Fixes applied:           $totalFixes",
  "- Consecutive failures:    $consecutiveFailures",
  "",
  "## Stop reason",
  "",
  $stopReason
)

$summary = $summaryLines -join "`n"
$summary | Set-Content "soak-summary.md" -Encoding UTF8
$summary | Tee-Object -FilePath $log -Append

Log "=== Soak loop finished ==="
