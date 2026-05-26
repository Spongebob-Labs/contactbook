module "platform" {
  source = "../../modules/platform"

  project_id = var.project_id
  region     = var.region

  create_terraform_state_bucket = var.create_terraform_state_bucket
  terraform_state_bucket          = var.terraform_state_bucket

  artifact_registry_repo_id     = var.artifact_registry_repo_id
  artifact_registry_description = var.artifact_registry_description

  enable_apis = var.enable_apis
  apis        = var.apis

  enable_github_actions_wif         = var.enable_github_actions_wif
  github_repository                 = var.github_repository
  github_actions_service_account_id = var.github_actions_service_account_id
  github_actions_wif_pool_id        = var.github_actions_wif_pool_id
  github_actions_wif_provider_id    = var.github_actions_wif_provider_id
  cloud_run_service_account_email   = var.cloud_run_service_account_email
}
