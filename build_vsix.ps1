Param(
  [string]$Version
)

$ErrorActionPreference = 'Stop'

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  if(-not $Version){
    $json = Get-Content package.json -Raw | ConvertFrom-Json
    $Version = $json.version
  }
  Write-Host "Building VSIX for version $Version"
  # Make sure package-lock.json reflects the same top-level version
  $lockPath = "package-lock.json"
  if(Test-Path $lockPath){
    try{
      Write-Host "Refreshing package-lock.json to match current package.json version"
      npm install --package-lock-only | Out-Null
    } catch {
      Write-Warning ("npm package-lock-only failed: " + $_.ToString())
    }
  }
  npm run build | Out-Null
  $pkgName = "copilot-catalog-manager-$Version"
  if(Test-Path "$pkgName.vsix"){ Remove-Item "$pkgName.vsix" -Force }
  if(Test-Path vsix_build){ Remove-Item vsix_build -Recurse -Force }
  New-Item -ItemType Directory -Path vsix_build/extension | Out-Null
  # Copy filtered content
  Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\vsix_build\\' -and $_.FullName -notmatch '\\.git\\' -and $_.Name -notmatch '\.vsix$' } | ForEach-Object {
    $rel = $_.FullName.Substring((Get-Location).Path.Length+1)
    $dest = Join-Path vsix_build/extension $rel
    $destDir = Split-Path $dest -Parent
    if(-not (Test-Path $destDir)){ New-Item -ItemType Directory -Path $destDir | Out-Null }
    Copy-Item $_.FullName $dest
  }
  Copy-Item vsix/extension.vsixmanifest vsix_build/extension.vsixmanifest
  Copy-Item vsix/[Content_Types].xml vsix_build/[Content_Types].xml
  if(Test-Path vsix/_rels){
    Copy-Item vsix/_rels -Destination vsix_build/_rels -Recurse
  }
  # Inject updated version, publisher, and id into vsix manifest from package.json
  $manifestPath = "vsix_build/extension.vsixmanifest"
  $manifestContent = Get-Content $manifestPath -Raw
  $manifestContent = $manifestContent -replace 'Version="[0-9.]+'+'"', ('Version="' + $Version + '"')
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  if($pkg.publisher){
    $pub = [string]$pkg.publisher
    if($pub -notmatch '^[a-z0-9][a-z0-9-]*$'){
      Write-Error "Invalid publisher id '$pub'. Publisher must be the Marketplace publisher identifier (lowercase letters, digits, dashes) – e.g. 'mycompany'. Update package.json 'publisher' and try again."
    }
    $manifestContent = $manifestContent -replace 'Publisher="[^"]+"', ('Publisher="' + $pub + '"')
  }
  if($pkg.name){
    $id = [string]$pkg.name
    if($id -notmatch '^[a-z0-9][a-z0-9-]*$'){
      Write-Error "Invalid extension name '$id'. Name must be lowercase letters, digits, dashes. Update package.json 'name' and try again."
    }
    $manifestContent = $manifestContent -replace 'Id="[^"]+"', ('Id="' + $id + '"')
  }
  Set-Content -Path $manifestPath -Value $manifestContent -NoNewline
  # Also update the packaged copy of package.json so VS Code reads the correct version/publisher
  $pkgCopyPath = "vsix_build/extension/package.json"
  if(Test-Path $pkgCopyPath){
    try{
      $pkgCopyRaw = Get-Content $pkgCopyPath -Raw
      $pkgCopy = $pkgCopyRaw | ConvertFrom-Json
      $pkgCopy.version = $Version
      if($pkg.publisher){ $pkgCopy.publisher = $pkg.publisher }
      if($pkg.label){ $pkgCopy.label = $pkg.label }
      $json = $pkgCopy | ConvertTo-Json -Depth 10
      # write pretty JSON (preserve newline at EOF)
      Set-Content -Path $pkgCopyPath -Value $json -NoNewline
      Write-Host "Updated $pkgCopyPath to version $Version"
    } catch {
      Write-Warning ("Failed to update " + $pkgCopyPath + ": " + $_.ToString())
    }
  }
    # Repack preserving folder structure (need extension/package.json path)
    if(Test-Path "$pkgName.vsix"){ Remove-Item "$pkgName.vsix" -Force }
    $current = Get-Location
    Push-Location vsix_build
    try {
      if(Test-Path _rels){
        Compress-Archive -Path extension, extension.vsixmanifest, '[Content_Types].xml', '_rels' -DestinationPath "$current/$pkgName.vsix" -Force
      } else {
        Compress-Archive -Path extension, extension.vsixmanifest, '[Content_Types].xml' -DestinationPath "$current/$pkgName.vsix" -Force
      }
    } finally { Pop-Location }
  Write-Host "Created $pkgName.vsix"
  Write-Host "Install with: code --install-extension .\$pkgName.vsix"
  
  # Cleanup the staging folder so stale copies are not left around
  try {
    if(Test-Path 'vsix_build'){
      Remove-Item -Recurse -Force 'vsix_build'
      Write-Host "Removed staging folder 'vsix_build'"
    }
  } catch {
    Write-Warning ("Failed to remove vsix_build: " + $_.ToString())
  }
}
finally {
  Pop-Location
}
