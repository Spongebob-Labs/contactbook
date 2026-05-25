variable "opentofu_impersonate_service_account" {
  description = "Service account email for OpenTofu to impersonate (ADC required)."
  type        = string
  default     = "contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"
}

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
