param(
  [string]$Input = ".\sample_inputs.json",
  [string]$Schema = ".\roadmap_schema.json",
  [string]$Out = ".\runs",
  [switch]$Strict
)

$ErrorActionPreference = 'Stop'

$args = @('--input', $Input, '--schema', $Schema, '--out', $Out)
if ($Strict) {
  $args += '--strict'
}

python .\roadmap_eval.py @args
