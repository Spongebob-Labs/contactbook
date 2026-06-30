variable "project_id" {
  description = "GCP project id."
  type        = string
}

variable "region" {
  description = "Region used for the reserved external IP."
  type        = string
}

variable "zone" {
  description = "Zone for the OpenWA VM and data disk."
  type        = string
}

variable "name" {
  description = "Base name for OpenWA resources."
  type        = string
  default     = "contactbook-openwa"
}

variable "machine_type" {
  description = "Compute Engine machine type."
  type        = string
  default     = "e2-small"
}

variable "boot_disk_size_gb" {
  description = "VM boot disk size in GiB."
  type        = number
  default     = 20
}

variable "data_disk_size_gb" {
  description = "Persistent OpenWA data disk size in GiB."
  type        = number
  default     = 30
}

variable "snapshot_retention_days" {
  description = "Number of days to retain daily OpenWA data-disk snapshots."
  type        = number
  default     = 14
}

variable "network" {
  description = "VPC network self-link or name."
  type        = string
  default     = "default"
}

variable "subnetwork" {
  description = "Optional subnetwork self-link or name."
  type        = string
  default     = null
}

variable "labels" {
  description = "Additional labels for OpenWA resources."
  type        = map(string)
  default     = {}
}
