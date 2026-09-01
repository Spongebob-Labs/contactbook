variable "project_id" { type = string }
variable "name_prefix" { type = string }
variable "zone" { type = string }
variable "vm_name" {
  type        = string
  description = "Existing GCE instance, e.g. contactbook-server."
}
variable "network" {
  type    = string
  default = "default"
}

variable "manage_firewall" {
  type        = bool
  description = "Create the 80/443 rule. Requires the VM to carry var.network_tag or it has no effect."
  default     = true
}

variable "network_tag" {
  type    = string
  default = "contactbook-api"
}
