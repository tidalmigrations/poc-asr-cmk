# Azure Site Recovery with Customer-Managed Keys (CMK) - POC

This project demonstrates Azure Site Recovery (ASR) implementation with Customer-Managed Key (CMK) encryption using Pulumi and TypeScript. It provides a complete proof-of-concept for disaster recovery scenarios where virtual machines with CMK-encrypted disks need to be replicated across Azure regions.

## 🎯 Project Overview

This POC provides the foundation for implementing:
- **Azure Site Recovery (ASR)** for cross-region VM replication
- **Customer-Managed Key (CMK) encryption** for enhanced security
- **Automated infrastructure deployment** using Pulumi
- **Comprehensive testing framework** for disaster recovery scenarios

## 📋 Prerequisites

### Required Tools
- **Azure CLI** installed and configured (`az login`)
- **Node.js** (LTS version) installed
- **Pulumi CLI** installed and configured
- **PowerShell** (for validation scripts)

### Azure Requirements
- Active Azure subscription with appropriate permissions
- Ability to create resources in two Azure regions
- **Key Vault Administrator** role or equivalent permissions
- **Storage Blob Data Contributor** role for Pulumi state backend

## 🚀 Getting Started

### Setup Pulumi Backend

```bash
# Clone and navigate to project
cd poc-asr-cmk

# Setup automated Pulumi backend with Azure Blob Storage
./setup-pulumi-backend.sh

# Validate setup and CMK prerequisites
./validate-backend.sh
```

### What the Backend Setup Provides

The automated backend setup creates:

- **Resource Group**: `pulumi-state-cmk-rg` in `eastus`
- **Storage Account**: `pulumistatecmk<unique_suffix>` with Standard_LRS
- **Blob Container**: `pulumi-backend-cmk` with private access
- **RBAC Permissions**: Storage Blob Data Contributor role assignment
- **Pulumi Login**: Automatic login to `azblob://pulumi-backend-cmk`

### Validation Features

The validation script checks:

- ✅ **Key Vault Service Access**: Validates user can access Azure Key Vault service
- ✅ **Disk Encryption Set Service Access**: Validates user can access DES service  
- ✅ **Key Vault RBAC Permissions**: Checks for Key Vault Administrator or equivalent roles
- ✅ **VM Size Availability**: Verifies Standard_DS2_v2 VM size is available in target region
- ✅ **Azure CLI Extensions**: Validates Key Vault CLI commands are available
- ✅ **Cross-Region Validation**: Ensures both source and target regions are accessible
