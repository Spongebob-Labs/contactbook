output "terraform_state_bucket" {
  description = "GCS bucket for OpenTofu remote state (when create_terraform_state_bucket is true)."
  value       = var.create_terraform_state_bucket ? google_storage_bucket.terraform_state[0].name : null
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name (resource name)."
  value       = google_artifact_registry_repository.docker.name
}

output "artifact_registry_repository_id" {
  description = "Artifact Registry repository id."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name for GitHub secret GCP_WORKLOAD_IDENTITY_PROVIDER."
  value       = var.enable_github_actions_wif ? google_iam_workload_identity_pool_provider.github[0].name : ""
}

output "github_actions_service_account_email" {
  description = "Email for GitHub secret GCP_SERVICE_ACCOUNT."
  value       = var.enable_github_actions_wif ? google_service_account.github_actions[0].email : ""
}
