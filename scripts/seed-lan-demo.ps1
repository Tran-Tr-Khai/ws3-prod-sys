[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost'
)

$ErrorActionPreference = 'Stop'
$now = Get-Date
$recordedAt = $now.ToUniversalTime().ToString('o')
$checkDate = $now.ToString('yyyy-MM-dd')

function Invoke-Ws3Api {
    param(
        [Parameter(Mandatory)] [string]$Method,
        [Parameter(Mandatory)] [string]$Path,
        [object]$Body
    )

    $params = @{
        Method = $Method
        Uri = "$BaseUrl$Path"
        ContentType = 'application/json'
    }
    if ($null -ne $Body) {
        $params.Body = $Body | ConvertTo-Json -Depth 4
    }
    Invoke-RestMethod @params
}

try {
    $existingBuffing = Invoke-Ws3Api -Method Get -Path "/api/buffing/checks?machine_id=BU-01&check_date=$checkDate"
    $hasBuffingSample = @($existingBuffing | Where-Object {
        $_.operator_name -eq 'TNTKhai' -and $_.remark -eq 'TEST DATA - LAN DEPLOYMENT CHECK'
    }).Count -gt 0

    if (-not $hasBuffingSample) {
        Invoke-Ws3Api -Method Post -Path '/api/buffing/checks' -Body @{
            machine_id = 'BU-01'
            check_date = $checkDate
            checked_at = $recordedAt
            operator_name = 'TNTKhai'
            check_1 = $true
            check_2 = $true
            check_3 = $true
            check_4 = $true
            check_5 = $true
            remark = 'TEST DATA - LAN DEPLOYMENT CHECK'
        } | Out-Null
        Write-Host 'Created Buffing demo record.' -ForegroundColor Green
    } else {
        Write-Host 'Buffing demo record already exists.' -ForegroundColor Yellow
    }

    $existingScouring = Invoke-Ws3Api -Method Get -Path '/api/scouring/records?limit=100'
    $hasScouringSample = @($existingScouring | Where-Object { $_.order_number -eq 'TEST-LAN-001' }).Count -gt 0

    if (-not $hasScouringSample) {
        Invoke-Ws3Api -Method Post -Path '/api/scouring/records' -Body @{
            machine_id = 'SC-01'
            recorded_at = $recordedAt
            order_number = 'TEST-LAN-001'
            item = 'LAN TEST SAMPLE'
            lot_yarn = 'TEST-1800A'
            lot_number = 'TEST-90060'
            operator_name = 'TNTKhai'
            naoh = 44
            soap = 10
            desizer = 5
            h2o2 = 8
            chelate = 3
            speed = 44
            temperature = 94
            cylinder_temperature = 95
            input_fabric_meters = 44
            output_fabric_meters = 44
            production_quantity_meters = 44
        } | Out-Null
        Write-Host 'Created Scouring demo record.' -ForegroundColor Green
    } else {
        Write-Host 'Scouring demo record already exists.' -ForegroundColor Yellow
    }
} catch {
    Write-Error "Could not create demo data. Confirm WS3 is available at $BaseUrl. $($_.Exception.Message)"
    exit 1
}
