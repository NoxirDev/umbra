# PowerShell script to create a self-signed certificate for MSIX package signing
# Run this script as Administrator

$ErrorActionPreference = "Stop"

Write-Host "=== Creating Self-Signed Certificate for UMBRA MSIX ===" -ForegroundColor Cyan

# Certificate parameters
$certName = "CN=Noxir"
$certFriendlyName = "UMBRA Code Signing Certificate"
$certOutputPath = ".\umbra-signing-cert.pfx"
$certPassword = "umbra123"  # Change this in production!

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Create certificate
Write-Host "Creating self-signed certificate..." -ForegroundColor Green
$cert = New-SelfSignedCertificate `
    -Type CodeSigning `
    -Subject $certName `
    -FriendlyName $certFriendlyName `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5) `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -KeySpec Signature

if ($cert) {
    Write-Host "Certificate created successfully!" -ForegroundColor Green
    Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow
    Write-Host "Subject: $($cert.Subject)" -ForegroundColor Yellow
    Write-Host "Expires: $($cert.NotAfter)" -ForegroundColor Yellow
    
    # Export certificate to PFX file
    Write-Host "Exporting certificate to PFX file..." -ForegroundColor Green
    $securePassword = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $certOutputPath -Password $securePassword | Out-Null
    
    # Also export public key (CER) for verification
    Export-Certificate -Cert $cert -FilePath ".\umbra-signing-cert.cer" | Out-Null
    
    Write-Host "Certificate exported to:" -ForegroundColor Green
    Write-Host "  - PFX (private key): $certOutputPath" -ForegroundColor Yellow
    Write-Host "  - CER (public key): .\umbra-signing-cert.cer" -ForegroundColor Yellow
    Write-Host "  - Password: $certPassword" -ForegroundColor Yellow
    
    # Install certificate to Trusted Root Certification Authorities (optional)
    Write-Host "`n=== Optional: Install certificate to Trusted Root ===" -ForegroundColor Cyan
    $installToTrustedRoot = Read-Host "Install certificate to Trusted Root Certification Authorities? (Y/N)"
    if ($installToTrustedRoot -eq 'Y' -or $installToTrustedRoot -eq 'y') {
        Write-Host "Installing certificate to Trusted Root..." -ForegroundColor Green
        $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
        $rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $rootStore.Add($cert)
        $rootStore.Close()
        Write-Host "Certificate installed to Trusted Root store." -ForegroundColor Green
    }
    
    # Instructions for electron-builder
    Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
    Write-Host "1. Update package.json with certificate info:" -ForegroundColor Yellow
    Write-Host '   "win": {' -ForegroundColor Gray
    Write-Host '     "certificateFile": "./certs/umbra-signing-cert.pfx",' -ForegroundColor Gray
    Write-Host '     "certificatePassword": "umbra123",' -ForegroundColor Gray
    Write-Host '     "sign": true' -ForegroundColor Gray
    Write-Host '   }' -ForegroundColor Gray
    Write-Host "2. Build MSIX package: npm run build:msix" -ForegroundColor Yellow
    Write-Host "3. Test installation: double-click the .msix file" -ForegroundColor Yellow
    
} else {
    Write-Host "Failed to create certificate!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Done! ===" -ForegroundColor Green