export const testingPrompts = [
    "Configure access points with specific frequency and power settings for the corporate building's third floor.",
    "Bulk configure 50 access points with dynamic channel assignment to minimize interference across the campus.",

    "Encrypt the SNMP community string and store it in the Ansible Vault.",
    "Add a new API token to the Ansible Vault for secure storage.",

    "Remove an obsolete variable from the Ansible Vault.",
    "Delete the old SSH key from the Ansible Vault file.",

    "Create an application policy for video conferencing traffic with high priority queuing.",
    "Deploy application policies to prioritize business-critical applications over guest network traffic.",

    "Remove the outdated application policy that was blocking social media applications.",
    "Delete all application queuing profiles associated with the legacy network segment.",

    "Configure health score thresholds to exclude CPU utilization KPIs for access switches.",
    "Update device-specific health score parameters for core routers to use conservative monitoring.",

    "Deploy an ICAP session to capture wireless client onboarding packets for troubleshooting connection issues.",
    "Create an intelligent capture for RF statistics on the 5GHz band to analyze interference patterns.",

    "Stop and remove the ICAP session that was monitoring the guest network wireless clients.",
    "Delete all completed packet capture sessions older than 30 days.",

    "Create a custom assurance issue to monitor when switch port utilization exceeds 80%.",
    "Execute suggested commands to automatically resolve connectivity issues detected by Catalyst Center.",

    "Remove the custom assurance issue for monitoring temperature thresholds on legacy devices.",
    "Delete all ignored assurance issues that were marked as false positives.",

    "Initiate a path trace between a wireless client and the data center server using TCP protocol.",
    "Trace the network path from the branch office router to the headquarters firewall.",

    "Remove all completed path trace sessions from the previous troubleshooting effort.",
    "Delete the path trace analysis for the decommissioned network segment.",

    "Back up device configurations for all switches in the San Francisco site.",
    "Create configuration backups for critical infrastructure devices using their hostnames.",

    "Configure SNMPv3 credentials for all access switches in the manufacturing floor.",
    "Apply SSH credentials to newly discovered devices for secure management access.",

    "Remove the outdated SNMP community strings from all network devices.",
    "Delete HTTP credentials that are no longer needed for legacy device management.",

    "Discover network devices using CDP protocol starting from the core switch IP address.",
    "Scan the 192.168.10.0/24 network range to identify and add new devices to inventory.",

    "Remove failed discovery jobs that couldn't complete due to credential issues.",
    "Delete discovery results for devices that were incorrectly identified as network equipment.",

    "Replace a failed access switch with a new device while preserving configuration and licenses.",
    "Execute RMA workflow for a faulty wireless access point, maintaining site and RF profile settings.",

    "Cancel the pending RMA request for the switch that was repaired instead of replaced.",
    "Remove the RMA workflow entry for the device that was replaced outside of the system.",

    "Create a configuration template for branch office routers with standardized security settings.",
    "Deploy the updated VLAN template to all access switches in the campus network.",

    "Remove the obsolete template that was designed for legacy switching equipment.",
    "Delete all template versions except the latest approved configuration template.",

    "Upgrade the IOS XE software on all distribution switches to the latest stable version.",
    "Perform a staged software upgrade on core routers with automated rollback on failure.",

    "Design and provision a complete network topology for the new branch office location.",
    "Create an end-to-end network design with proper device placement and connectivity mapping.",

    "Configure webhook notifications to alert the NOC when any device goes offline.",
    "Set up email notifications for critical network events and security violations.",

    "Remove the SNMP trap destination that's no longer monitored by the management system.",
    "Delete all email notification subscriptions for the decommissioned network segment.",

    "Add newly discovered switches to the inventory and assign them to appropriate sites.",
    "Update device management IP addresses and modify polling intervals for monitoring.",

    "Remove decommissioned devices from the network inventory and clean up site assignments.",
    "Delete all user-defined fields from devices that are being replaced.",

    "Integrate ISE with Catalyst Center and configure RADIUS authentication for wireless clients.",
    "Add external AAA servers to support authentication for network device management.",

    "Remove the ISE integration that's being replaced with a new authentication server.",
    "Delete RADIUS server configurations for the legacy authentication infrastructure.",

    "Create security group tags and access contracts for separating guest and corporate traffic.",
    "Configure SGT policies to allow marketing users access to shared file servers.",

    "Initiate LAN automation to discover and configure new switches in the data center expansion.",
    "Start automated device onboarding for the new building's network infrastructure.",

    "Stop the LAN automation session that has completed discovering all expected devices.",
    "Halt the automated discovery process due to network maintenance requirements.",

    "Perform compliance checks on all devices in the headquarters site to ensure configuration standards.",
    "Sync device configurations between running and startup configs for critical infrastructure.",

    "Create a switch network profile for access layer devices with standardized port configurations.",
    "Assign the campus switching profile to all buildings within the university site.",

    "Remove the deprecated switching profile that's no longer compliant with security policies.",
    "Delete network profiles associated with the legacy network design.",

    "Create a wireless network profile with guest and corporate SSIDs for the retail locations.",
    "Configure RF profiles and AP zones for optimal wireless coverage in the warehouse facility.",

    "Remove the wireless profile that was configured for the temporary conference setup.",
    "Delete AP zone configurations for the floor that's being renovated.",

    "Configure global network settings including DNS, NTP, and DHCP servers for all sites.",
    "Reserve IP address pools for the new branch office and configure VLAN assignments.",

    "Remove network settings for the closed branch office location.",
    "Delete IP pool reservations that are no longer needed after network redesign.",

    "Configure PnP settings to automatically provision new switches with the standard branch template.",
    "Set up zero-touch provisioning for wireless access points in the retail deployment.",

    "Remove PnP configurations for devices that will be manually configured instead.",
    "Delete the PnP workflow for the pilot project that has been completed.",

    "Provision newly added switches to their designated sites and apply appropriate configurations.",
    "Assign wireless controllers to sites and provision them with the correct wireless profiles.",

    "Un-provision devices that are being moved to a different site location.",
    "Remove provisioning for devices that are being decommissioned from the network.",

    "Assign control plane and border node roles to devices in the SD-Access fabric.",
    "Configure edge device roles for access switches connecting to user endpoints.",

    "Remove fabric device role assignments for switches being taken out of the SDA fabric.",
    "Delete border node configurations for devices that no longer connect to external networks.",

    "Use Jinja templates to dynamically assign fabric roles based on device location and type.",
    "Apply templated fabric configurations to standardize device roles across multiple sites.",

    "Create an extranet policy to allow guest network access to shared DNS and DHCP services.",
    "Configure extranet policies for branch offices to access centralized data center resources.",

    "Remove extranet policies for the partner network that's no longer connected.",
    "Delete route leak configurations between virtual networks that are being consolidated.",

    "Configure multicast routing within the SD-Access fabric for video streaming applications.",
    "Enable multicast support for IP phones and collaboration tools in the fabric network.",

    "Remove multicast configurations for applications that no longer require multicast traffic.",
    "Delete fabric multicast settings for the network segment that's being redesigned.",

    "Create SD-Access fabric sites for the new campus with appropriate authentication zones.",
    "Configure fabric zones with different security policies for employee and guest access.",

    "Remove fabric site configurations for the location that's being decommissioned.",
    "Delete authentication zones that are no longer needed after security policy changes.",

    "Configure IP transit to connect the SD-Access fabric to the external data center.",
    "Set up SDA transit between multiple fabric sites for seamless connectivity.",

    "Remove transit configurations for the connection that's being replaced with direct links.",
    "Delete SDA transit settings for sites that are being merged into a single fabric.",

    "Onboard servers to the SD-Access fabric with appropriate VLAN and security group assignments.",
    "Configure port channels for host connections requiring link aggregation and redundancy.",

    "Remove host onboarding configurations for servers that have been migrated to the cloud.",
    "Delete port channel configurations for devices that no longer require link aggregation.",

    "Create Layer 3 virtual networks with anycast gateways for user and server VLANs.",
    "Configure fabric VLANs and virtual networks for the new department's network segmentation.",

    "Remove virtual networks and gateways for the department that has been reorganized.",
    "Delete Layer 2 fabric VLANs that are no longer needed after network consolidation.",

    "Create a site hierarchy structure for the global organization with areas, sites, and buildings.",
    "Add new floors to existing buildings and assign appropriate network design settings.",

    "Remove the site hierarchy entries for facilities that have been closed or sold.",
    "Delete building and floor configurations for the location undergoing major renovation.",

    "Upgrade IOS software on campus switches to the latest version using SWIM automation.",
    "Import and activate new firmware images for access points across multiple sites.",

    "Create and assign tags to network devices for better organization and policy application.",
    "Apply location-based tags to devices for automated configuration and monitoring.",

    "Remove obsolete tags from devices that have been recategorized or relocated.",
    "Delete all tags associated with the legacy naming convention.",

    "Create network administrator accounts with appropriate role-based access permissions.",
    "Configure custom roles for contractors with limited access to specific network functions.",

    "Remove user accounts for employees who have left the organization.",
    "Delete custom roles that are no longer needed after organizational restructuring.",

    "Design wireless network settings including SSIDs, RF profiles, and AP configurations for the office.",
    "Configure guest and corporate wireless networks with appropriate security and access policies.",

    "Remove wireless design configurations for the temporary event network setup.",
    "Delete RF profiles and AP configurations for the area that's switching to wired connections.",
];

export const testingLabels = [
    "accesspoints_config_playbook.yml",
    "accesspoints_config_playbook.yml",

    "ansible_vault_update_playbook.yml",
    "ansible_vault_update_playbook.yml",

    "delete_ansible_vault_update_playbook.yml",
    "delete_ansible_vault_update_playbook.yml",

    "application_policy_playbook.yml",
    "application_policy_playbook.yml",

    "delete_application_policy_playbook.yml",
    "delete_application_policy_playbook.yml",

    "assurance_health_score_settings_playbook.yml",
    "assurance_health_score_settings_playbook.yml",

    "assurance_intelligent_capture_playbook.yml",
    "assurance_intelligent_capture_playbook.yml",

    "delete_assurance_intelligent_capture_playbook.yml",
    "delete_assurance_intelligent_capture_playbook.yml",

    "assurance_issues_management_playbook.yml",
    "assurance_issues_management_playbook.yml",

    "delete_assurance_issues_management_playbook.yml",
    "delete_assurance_issues_management_playbook.yml",

    "assurance_pathtrace_playbook.yml",
    "assurance_pathtrace_playbook.yml",

    "delete_assurance_pathtrace_playbook.yml",
    "delete_assurance_pathtrace_playbook.yml",

    "device_config_backup_workflow_playbook.yml",
    "device_config_backup_workflow_playbook.yml",

    "device_credentials_playbook.yml",
    "device_credentials_playbook.yml",

    "delete_device_credentials_playbook.yml",
    "delete_device_credentials_playbook.yml",

    "device_discovery_playbook.yml",
    "device_discovery_playbook.yml",

    "delete_device_discovery.yml",
    "delete_device_discovery.yml",

    "device_replacement_rma_playbook.yml",
    "device_replacement_rma_playbook.yml",

    "delete_device_replacement_rma_playbook.yml",
    "delete_device_replacement_rma_playbook.yml",

    "template_workflow_playbook.yml",
    "template_workflow_playbook.yml",

    "delete_template_workflow_playbook.yml",
    "delete_template_workflow_playbook.yml",

    "e2e_network_device_sw_upgrade_playbook.yml",
    "e2e_network_device_sw_upgrade_playbook.yml",

    "e2e_network_inventory_playbook.yml",
    "e2e_network_inventory_playbook.yml",

    "events_and_notifications_playbook.yml",
    "events_and_notifications_playbook.yml",

    "delete_events_and_notifications_playbook.yml",
    "delete_events_and_notifications_playbook.yml",

    "inventory_playbook.yml",
    "inventory_playbook.yml",

    "delete_inventory_playbook.yml",
    "delete_inventory_playbook.yml",

    "ise_radius_integration_workflow_playbook.yml",
    "ise_radius_integration_workflow_playbook.yml",

    "delete_ise_radius_integration_workflow_playbook.yml",
    "delete_ise_radius_integration_workflow_playbook.yml",

    "ise_sg_contracts_policies_playbook.yml",
    "ise_sg_contracts_policies_playbook.yml",

    "lan_automation_workflow_playbook.yml",
    "lan_automation_workflow_playbook.yml",

    "stop_lan_automation_workflow_playbook.yml",
    "stop_lan_automation_workflow_playbook.yml",

    "network_compliance_workflow_playbook.yml",
    "network_compliance_workflow_playbook.yml",

    "network_profile_switching_playbook.yml",
    "network_profile_switching_playbook.yml",

    "delete_network_profile_switching_playbook.yml",
    "delete_network_profile_switching_playbook.yml",

    "network_profile_wireless_playbook.yml",
    "network_profile_wireless_playbook.yml",

    "delete_network_profile_wireless_playbook.yml",
    "delete_network_profile_wireless_playbook.yml",

    "network_settings_playbook.yml",
    "network_settings_playbook.yml",

    "delete_network_settings_playbook.yml",
    "delete_network_settings_playbook.yml",

    "catalyst_center_pnp_playbook.yml",
    "catalyst_center_pnp_playbook.yml",

    "delete_catalyst_center_pnp_playbook.yml",
    "delete_catalyst_center_pnp_playbook.yml",

    "provision_workflow_playbook.yml",
    "provision_workflow_playbook.yml",

    "delete_provision_workflow_playbook.yml",
    "delete_provision_workflow_playbook.yml",

    "sda_fabric_device_roles_playbook.yml",
    "sda_fabric_device_roles_playbook.yml",

    "delete_sda_fabric_device_roles_playbook.yml",
    "delete_sda_fabric_device_roles_playbook.yml",

    "sda_fabric_device_roles_playbook_jinja.yml",
    "sda_fabric_device_roles_playbook_jinja.yml",

    "fabric_extranet_policy_playbook.yml",
    "fabric_extranet_policy_playbook.yml",

    "delete_fabric_extranet_policy_playbook.yml",
    "delete_fabric_extranet_policy_playbook.yml",

    "sda_fabric_multicast_playbook.yml",
    "sda_fabric_multicast_playbook.yml",

    "delete_sda_fabric_multicast_playbook.yml",
    "delete_sda_fabric_multicast_playbook.yml",

    "sda_fabric_sites_zones_playbook.yml",
    "sda_fabric_sites_zones_playbook.yml",

    "delete_sda_fabric_sites_zones_playbook.yml",
    "delete_sda_fabric_sites_zones_playbook.yml",

    "delete_sda_fabric_transits_workflow_playbook.yml",
    "delete_sda_fabric_transits_workflow_playbook.yml",

    "sda_host_onboarding_playbook.yml",
    "sda_host_onboarding_playbook.yml",

    "delete_sda_host_onboarding_playbook.yml",
    "delete_sda_host_onboarding_playbook.yml",

    "sda_virtual_networks_l2_l3_gateways_playbook.yml",
    "sda_virtual_networks_l2_l3_gateways_playbook.yml",

    "delete_sda_virtual_networks_l2_l3_gateways_playbook.yml",
    "delete_sda_virtual_networks_l2_l3_gateways_playbook.yml",

    "site_hierarchy_playbook.yml",
    "site_hierarchy_playbook.yml",

    "delete_site_hierarchy_playbook.yml",
    "delete_site_hierarchy_playbook.yml",

    "swim_workflow_playbook.yml",
    "swim_workflow_playbook.yml",

    "tags_manager_playbook.yml",
    "tags_manager_playbook.yml",

    "delete_tags_manager_playbook.yml",
    "delete_tags_manager_playbook.yml",

    "users_and_roles_workflow_playbook.yml",
    "users_and_roles_workflow_playbook.yml",

    "delete_users_and_roles_workflow_playbook.yml",
    "delete_users_and_roles_workflow_playbook.yml",

    "wireless_design_playbook.yml",
    "wireless_design_playbook.yml",

    "delete_wireless_design_playbook.yml",
    "delete_wireless_design_playbook.yml",
];      