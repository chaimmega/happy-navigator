$stop                = (Get-Date).AddHours(8)
$log                 = "soak-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$consecutiveFailures = 0
$totalRuns           = 0
$totalPasses         = 0
$totalFailures       = 0
$totalFixes          = 0

function LogMsg($msg) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  ($ts + '  ' + $msg) | Tee-Object -FilePath $log -Append
}

LogMsg ('Soak started until ' + $stop.ToString('yyyy-MM-dd HH:mm:ss'))

while ((Get-Date) -lt $stop) {
  $totalRuns++
  LogMsg ('--- Run #' + $totalRuns + ' ---')

  npm run test:e2e 2>&1 | Tee-Object -FilePath $log -Append
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    $totalPasses++
    $consecutiveFailures = 0
    LogMsg ('PASS  (passes: ' + $totalPasses + ')')
    continue
  }

  $totalFailures++
  $consecutiveFailures++
  LogMsg ('FAIL  exit=' + $exitCode + '  failures: ' + $totalFailures + '  consecutive: ' + $consecutiveFailures)

  if (Test-Path 'playwright-report/results.json') {
    node scripts/soak-autofix.js playwright-report/results.json 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -eq 0) {
      $totalFixes++
      $consecutiveFailures = 0
      LogMsg ('Autofix applied (' + $totalFixes + ' total). Re-running soak...')
      npm run test:e2e:soak 2>&1 | Tee-Object -FilePath $log -Append
      if ($LASTEXITCODE -eq 0) {
        $totalPasses++
        LogMsg 'Re-run PASSED after fix.'
      } else {
        $consecutiveFailures++
        LogMsg 'Re-run FAILED after fix.'
      }
    } else {
      LogMsg ('Nothing fixable. Consecutive: ' + $consecutiveFailures)
    }
  } else {
    LogMsg ('No results.json found. Consecutive: ' + $consecutiveFailures)
  }

  if ($consecutiveFailures -ge 3) {
    LogMsg 'STOP — 3 consecutive unfixed failures.'
    break
  }
}

$reason = if ($consecutiveFailures -ge 3) { '3 consecutive unfixed failures' } else { '8-hour limit reached' }
$end = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$summary = 'Ended: ' + $end + ' | Runs: ' + $totalRuns + ' | Passes: ' + $totalPasses + ' | Failures: ' + $totalFailures + ' | Fixes: ' + $totalFixes + ' | Reason: ' + $reason
$summary | Set-Content soak-summary.md -Encoding UTF8
LogMsg ('Done. ' + $summary)
