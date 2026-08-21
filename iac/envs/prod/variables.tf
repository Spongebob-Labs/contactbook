variable "env" { type = string }
variable "project_id" { type = string }
variable "project_number" {
  type        = string
  description = "Not consumed yet; kept because default-SA member strings need it."
}
variable "region" {
  type        = string
  description = "Cloud Tasks region."
}
variable "zone" {
  type        = string
  description = "Zone the existing VM lives in."
}
variable "vm_name" { type = string }

variable "api_base_url" {
  type        = string
  description = "Public HTTPS origin of the API on the VM. Cloud Tasks pushes here and this is the OIDC audience."
}

variable "alert_email" { type = string }
variable "enable_alerts" { type = bool }
variable "outbound_dispatches_per_second" { type = number }
