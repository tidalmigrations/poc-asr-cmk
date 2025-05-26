import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import * as keyvault from "@pulumi/azure-native/keyvault";
import * as compute from "@pulumi/azure-native/compute";
import * as recoveryservices from "@pulumi/azure-native/recoveryservices";
import * as storage from "@pulumi/azure-native/storage";
import * as authorization from "@pulumi/azure-native/authorization";

// Azure Site Recovery with Customer-Managed Keys (CMK) POC
// 
// This implementation demonstrates Azure Site Recovery (ASR) with Customer-Managed Key (CMK) encryption
// for both source and target virtual machines and their associated disks.
//
// Key Components:
// - Source and Target Key Vaults with encryption keys
// - Disk Encryption Sets (DES) for both regions
// - Virtual machines with CMK-encrypted disks
// - Azure Site Recovery configuration for cross-region replication
//
// Operating System Support Notes:
// According to https://aka.ms/a2a_supported_linux_os_versions:
// - Ubuntu 20.04 LTS: Supported kernels include 5.4.x, 5.8.x, 5.11.x, 5.13.x series
// - This deployment uses Ubuntu 20.04 LTS for maximum ASR compatibility

// Get current Azure client configuration
const clientConfig = authorization.getClientConfig();

// Get configuration values
const config = new pulumi.Config();
const azureConfig = new pulumi.Config("azure-native");
const location = azureConfig.require("location");
const targetLocation = config.require("targetLocation");
const resourceGroupNamePrefix = config.require("resourceGroupNamePrefix");
const vmAdminUsername = config.require("vmAdminUsername");
const vmAdminPassword = config.requireSecret("vmAdminPassword");
const sourceVmName = config.require("sourceVmName");
const vmSize = config.require("vmSize");
const keyVaultNamePrefix = config.require("keyVaultNamePrefix");
const sourceKeyName = config.require("sourceKeyName");
const targetKeyName = config.require("targetKeyName");

// VM Image Configuration - Using Ubuntu 20.04 LTS for Azure Site Recovery compatibility
const sourceVmImagePublisher = config.get("sourceVmImagePublisher") || "Canonical";
const sourceVmImageOffer = config.get("sourceVmImageOffer") || "0001-com-ubuntu-server-focal";
const sourceVmImageSku = config.get("sourceVmImageSku") || "20_04-lts-gen2";
const sourceVmImageVersion = config.get("sourceVmImageVersion") || "20.04.202109080";

// Generate unique suffixes for globally unique resource names
const uniqueSuffix = pulumi.getStack().toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8);

// =============================================================================
// Phase 1: Core Infrastructure - Resource Groups & Networking
// =============================================================================

// 3. Create Resource Groups

// Source Resource Group
const sourceResourceGroup = new resources.ResourceGroup("sourceResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-source-rg`,
    location: location,
});

// Target Resource Group  
const targetResourceGroup = new resources.ResourceGroup("targetResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-target-rg`,
    location: targetLocation,
});

// Recovery Services Resource Group
const recoveryResourceGroup = new resources.ResourceGroup("recoveryResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-recovery-rg`,
    location: targetLocation,
});

// 4. Setup Source Region Networking

// Source Virtual Network (VNet)
const sourceVNet = new network.VirtualNetwork("sourceVNet", {
    virtualNetworkName: "source-vnet",
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
});

// Source Subnet
const sourceSubnet = new network.Subnet("sourceSubnet", {
    subnetName: "source-subnet", 
    resourceGroupName: sourceResourceGroup.name,
    virtualNetworkName: sourceVNet.name,
    addressPrefix: "10.0.1.0/24",
});

// 5. Setup Target Region Networking (for Failover)

// Target Virtual Network (VNet)
const targetVNet = new network.VirtualNetwork("targetVNet", {
    virtualNetworkName: "target-vnet",
    resourceGroupName: targetResourceGroup.name,
    location: targetLocation,
    addressSpace: {
        addressPrefixes: ["10.1.0.0/16"],
    },
});

// Target Subnet
const targetSubnet = new network.Subnet("targetSubnet", {
    subnetName: "target-subnet",
    resourceGroupName: targetResourceGroup.name,
    virtualNetworkName: targetVNet.name,
    addressPrefix: "10.1.1.0/24",
});

// =============================================================================
// Export Phase 1 Resources
// =============================================================================

export const sourceResourceGroupName = sourceResourceGroup.name;
export const sourceResourceGroupId = sourceResourceGroup.id;
export const targetResourceGroupName = targetResourceGroup.name;
export const targetResourceGroupId = targetResourceGroup.id;
export const recoveryResourceGroupName = recoveryResourceGroup.name;
export const recoveryResourceGroupId = recoveryResourceGroup.id;

export const sourceVNetName = sourceVNet.name;
export const sourceVNetId = sourceVNet.id;
export const sourceSubnetName = sourceSubnet.name;
export const sourceSubnetId = sourceSubnet.id;

export const targetVNetName = targetVNet.name;
export const targetVNetId = targetVNet.id;
export const targetSubnetName = targetSubnet.name;
export const targetSubnetId = targetSubnet.id;

// Configuration exports for reference
export const configSummary = {
    sourceLocation: location,
    targetLocation: targetLocation,
    resourcePrefix: resourceGroupNamePrefix,
    vmName: sourceVmName,
    keyVaultPrefix: keyVaultNamePrefix,
    uniqueSuffix: uniqueSuffix,
};
