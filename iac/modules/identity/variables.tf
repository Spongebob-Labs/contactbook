variable "project_id" { type = string }
variable "name_prefix" { type = string }

variable "vm_service_account" {
  type        = string
  description = "Email of the service account already attached to the GCE VM. The app runs as this identity and needs to create Cloud Tasks."
}
