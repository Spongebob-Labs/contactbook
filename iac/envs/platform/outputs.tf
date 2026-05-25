output "terraform_state_bucket" {
  value = module.platform.terraform_state_bucket
}

output "artifact_registry_repository" {
  value = module.platform.artifact_registry_repository
}

output "artifact_registry_repository_id" {
  value = module.platform.artifact_registry_repository_id
}

output "github_actions_workload_identity_provider" {
  value = module.platform.github_actions_workload_identity_provider
}

output "github_actions_service_account_email" {
  value = module.platform.github_actions_service_account_email
}
