variable "project_id" { type = string }
variable "name_prefix" { type = string }
variable "vm_name" { type = string }
variable "alert_email" { type = string }
variable "enable_alerts" {
  type        = bool
  description = "Set false in staging so it does not page anyone."
  default     = true
}

variable "uptime_host" {
  type        = string
  description = "Bare hostname for the uptime check, e.g. api.getcontactbook.com."
  default     = ""
}
