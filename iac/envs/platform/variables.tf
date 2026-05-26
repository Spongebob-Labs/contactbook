variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "create_terraform_state_bucket" {
  type    = bool
  default = false
}

variable "terraform_state_bucket" {
  type    = string
  default = ""
}

variable "artifact_registry_repo_id" {
  type = string
}

variable "artifact_registry_description" {
  type = string
}

variable "enable_apis" {
  type = bool
}

variable "apis" {
  type = list(string)
}

variable "enable_github_actions_wif" {
  type    = bool
  default = false
}

variable "github_repository" {
  type    = string
  default = ""
}

variable "github_actions_service_account_id" {
  type    = string
  default = "contactbook-github-actions"
}

variable "github_actions_wif_pool_id" {
  type    = string
  default = "contactbook-github"
}

variable "github_actions_wif_provider_id" {
  type    = string
  default = "github-oidc"
}

variable "cloud_run_service_account_email" {
  type    = string
  default = null
}
