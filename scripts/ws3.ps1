param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Position = 1)]
    [ValidateSet('up', 'down', 'logs', 'status', 'config')]
    [string]$Action = 'up',

    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rootEnv = Join-Path $root '.env'
$expectedEnv = @{ dev = 'development'; staging = 'staging'; prod = 'production' }[$Environment]
$project = @{ dev = 'ws3-dev'; staging = 'ws3-staging'; prod = 'ws3' }[$Environment]

if (-not $EnvFile) {
    $EnvFile = $rootEnv
    if ($Environment -eq 'dev' -and -not (Test-Path -LiteralPath $rootEnv)) {
        Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $rootEnv
    }
}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Missing env file for $Environment. See docs/deployment/environments.md."
}
$EnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
if ($Environment -eq 'dev' -and $EnvFile -ne $rootEnv) {
    throw 'Dev uses the repository root .env for both the backend and Compose.'
}

$envText = [IO.File]::ReadAllText($EnvFile)
$appEnvEntries = [regex]::Matches($envText, '(?m)^[ \t]*(?:export[ \t]+)?APP_ENV[ \t]*=[^\r\n]*')
$appEnvPattern = '^[ \t]*(?:export[ \t]+)?APP_ENV[ \t]*=[ \t]*(?<quote>[''"]?){0}\k<quote>(?:[ \t]+#.*)?[ \t]*$' -f $expectedEnv
if ($appEnvEntries.Count -ne 1 -or $appEnvEntries[0].Value -cnotmatch $appEnvPattern) {
    throw "Set APP_ENV=$expectedEnv exactly once in $EnvFile."
}
if ($env:APP_ENV -and $env:APP_ENV -cne $expectedEnv) {
    throw "The current shell overrides APP_ENV. Clear it or set it to $expectedEnv."
}

$files = if ($Environment -eq 'dev') {
    @('-f', 'infra/compose/docker-compose.yml')
} else {
    @('-f', 'infra/compose/docker-compose.production.yml', '-f', 'infra/compose/docker-compose.https.yml')
}
$compose = @('compose', '--project-directory', $root, '-p', $project, '--env-file', $EnvFile) + $files

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE."
    }
}

function Assert-DeploymentCredentials {
    $config = Invoke-Checked docker ($compose + @('config', '--format', 'json')) |
        Out-String | ConvertFrom-Json
    foreach ($value in @(
        $config.services.postgres.environment.POSTGRES_PASSWORD,
        $config.services.backend.environment.AUTH_SECRET_KEY
    )) {
        if ([string]::IsNullOrWhiteSpace($value) -or
            $value -match '^(REPLACE_WITH_|ws3_password$|change-me-before-production$)') {
            throw 'Set deployment-specific POSTGRES_PASSWORD and AUTH_SECRET_KEY in the env file.'
        }
    }
}

Push-Location -LiteralPath $root
try {
    switch ($Action) {
        'up' {
            if ($Environment -eq 'dev') {
                $windows = $env:OS -eq 'Windows_NT'
                $npm = if ($windows) { 'npm.cmd' } else { 'npm' }
                if (-not (Test-Path -LiteralPath 'frontend/node_modules/vite/package.json')) {
                    Invoke-Checked $npm @('--prefix', 'frontend', 'ci')
                }
                Invoke-Checked uv @('sync', '--project', 'backend', '--locked', '--group', 'dev')
                Invoke-Checked docker ($compose + @('up', '-d', '--wait', 'postgres'))
                Invoke-Checked uv @('run', '--directory', 'backend', '--locked', 'alembic', 'upgrade', 'head')

                if ($windows) {
                    Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
                        '-NoProfile', '-NoExit', '-Command', 'uv run --directory backend --locked python run.py'
                    )
                    Start-Process powershell.exe -WorkingDirectory (Join-Path $root 'frontend') -ArgumentList @(
                        '-NoProfile', '-NoExit', '-Command', 'npm.cmd run dev'
                    )
                    Write-Output 'Started dev terminals. Default web URL: http://localhost:5173'
                } else {
                    Write-Output 'Run npm --prefix frontend run dev in a second terminal.'
                    Invoke-Checked uv @('run', '--directory', 'backend', '--locked', 'python', 'run.py')
                }
            } else {
                Assert-DeploymentCredentials
                Invoke-Checked docker ($compose + @('up', '-d', '--build', '--wait'))
            }
        }
        'config' {
            if ($Environment -ne 'dev') { Assert-DeploymentCredentials }
            Invoke-Checked docker ($compose + @('config', '--quiet'))
            Write-Output "Valid configuration for $Environment (Compose project: $project)."
        }
        'down' { Invoke-Checked docker ($compose + @('down')) }
        'logs' { Invoke-Checked docker ($compose + @('logs', '--tail=100', '-f')) }
        'status' { Invoke-Checked docker ($compose + @('ps')) }
    }
} finally {
    Pop-Location
}
