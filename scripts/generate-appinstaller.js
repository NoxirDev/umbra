#!/usr/bin/env node
/**
 * Script to generate AppInstaller file for UMBRA MSIX package
 * Usage: node scripts/generate-appinstaller.js [version] [msixUrl]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  appName: 'UMBRA',
  publisher: 'CN=Noxir',
  version: process.argv[2] || '2.1.1.0',
  msixUrl: process.argv[3] || 'https://example.com/umbra/UMBRA.msix',
  outputDir: 'dist',
  outputFile: 'UMBRA.appinstaller'
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// AppInstaller XML template
const appInstallerXml = `<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
    xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
    Version="${config.version}"
    Uri="${config.msixUrl}"
    >
    <MainPackage
        Name="${config.appName}"
        Publisher="${config.publisher}"
        Version="${config.version}"
        ProcessorArchitecture="x64"
        Uri="${config.msixUrl}"
    />
    <UpdateSettings>
        <OnLaunch HoursBetweenUpdateChecks="0"/>
        <AutomaticBackgroundTask/>
    </UpdateSettings>
    <Properties>
        <DisplayName>UMBRA Stream Overlay</DisplayName>
        <PublisherDisplayName>Noxir</PublisherDisplayName>
        <Logo>assets\\icon-256.png</Logo>
        <Description>Professional stream overlay for Twitch, YouTube, Kick with real-time alerts and statistics</Description>
    </Properties>
</AppInstaller>`;

// Write to file
const outputPath = path.join(config.outputDir, config.outputFile);
fs.writeFileSync(outputPath, appInstallerXml, 'utf8');

console.log(`AppInstaller file generated: ${outputPath}`);
console.log(`Version: ${config.version}`);
console.log(`MSIX URL: ${config.msixUrl}`);
console.log('\nTo use locally:');
console.log('1. Place the .msix file in the same directory as the .appinstaller file');
console.log('2. Update the Uri to use a file:/// URL or local web server');
console.log('3. Double-click the .appinstaller file to install');

// Also generate a simple HTML page for web installation
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install UMBRA Stream Overlay</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background: #1a1a2e; color: #fff; }
        .container { max-width: 800px; margin: 0 auto; background: #2d2d44; padding: 30px; border-radius: 10px; }
        h1 { color: #6c63ff; }
        .button { display: inline-block; background: #6c63ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
        .button:hover { background: #5753d4; }
        .note { background: #3a3a5a; padding: 15px; border-left: 4px solid #6c63ff; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Install UMBRA Stream Overlay</h1>
        <p>UMBRA is a professional stream overlay for Twitch, YouTube, and Kick with real-time alerts and statistics.</p>
        
        <div class="note">
            <strong>System Requirements:</strong> Windows 10/11 (x64) with App Installer enabled.
        </div>
        
        <h2>Installation Methods</h2>
        
        <h3>Method 1: Modern Install (Recommended)</h3>
        <p>Uses Windows App Installer with automatic updates:</p>
        <a href="UMBRA.appinstaller" class="button">Install via AppInstaller</a>
        
        <h3>Method 2: Direct MSIX Package</h3>
        <p>Download and install the MSIX package directly:</p>
        <a href="UMBRA.msix" class="button">Download MSIX Package</a>
        
        <h3>Method 3: Traditional Installer</h3>
        <p>Classic NSIS installer with directory selection:</p>
        <a href="UMBRA-Setup-${config.version.split('.')[0]}.${config.version.split('.')[1]}.exe" class="button">Download NSIS Installer</a>
        
        <h2>Installation Instructions</h2>
        <ol>
            <li>Click the installation method above</li>
            <li>Windows may show a security warning - click "Install anyway" (for self-signed certificate)</li>
            <li>Wait for installation to complete</li>
            <li>Launch UMBRA from Start Menu or Desktop shortcut</li>
        </ol>
        
        <div class="note">
            <strong>Note:</strong> If you see "Windows protected your PC", click "More info" then "Run anyway". 
            This is because the app is signed with a self-signed certificate for testing.
            For production, use a certificate from a trusted Certificate Authority.
        </div>
        
        <h2>Need Help?</h2>
        <p>Check the <a href="https://github.com/Noxir/umbra" style="color: #6c63ff;">GitHub repository</a> for documentation and support.</p>
    </div>
</body>
</html>`;

const htmlPath = path.join(config.outputDir, 'install.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log(`\nInstallation HTML page generated: ${htmlPath}`);