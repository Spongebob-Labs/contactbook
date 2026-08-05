variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "cloud_run_service_name" {
  type = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "1Gi"
}

variable "min_instances" {
  type    = number
  default = 1
}

variable "max_instances" {
  type    = number
  default = 2
}

variable "allow_unauthenticated" {
  type    = bool
  default = true
}

variable "cloud_run_service_account_email" {
  type    = string
  default = null
}

variable "env" {
  type = map(string)
}

variable "create_profile_photos_bucket" {
  type    = bool
  default = true
}

variable "profile_photos_bucket_name" {
  type = string
}

variable "profile_photos_cors_origins" {
  type = list(string)
}

variable "custom_domain" {
  type    = string
  default = null
}

variable "enable_openwa_vm" {
  description = "Create the stateful OpenWA Compute Engine gateway."
  type        = bool
  default     = false
}

variable "openwa_zone" {
  type    = string
  default = "europe-west1-b"
}

variable "openwa_instance_name" {
  type    = string
  default = "contactbook-openwa"
}

variable "openwa_machine_type" {
  type    = string
  default = "e2-small"
}

variable "openwa_boot_disk_size_gb" {
  type    = number
  default = 20
}

variable "openwa_data_disk_size_gb" {
  type    = number
  default = 30
}
