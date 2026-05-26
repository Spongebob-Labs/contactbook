# State migration from retired single-root layout (historical moved blocks).
# Copy terraform.tfstate here first, then: tofu init && tofu plan
# Expect no destroys on GAR, WIF, or enabled APIs.

moved {
  from = google_artifact_registry_repository.docker
  to   = module.platform.google_artifact_registry_repository.docker
}

moved {
  from = google_artifact_registry_repository_iam_member.cloud_run_pull
  to   = module.platform.google_artifact_registry_repository_iam_member.cloud_run_pull
}

moved {
  from = google_service_account.github_actions[0]
  to   = module.platform.google_service_account.github_actions[0]
}

moved {
  from = google_iam_workload_identity_pool.github_actions[0]
  to   = module.platform.google_iam_workload_identity_pool.github_actions[0]
}

moved {
  from = google_iam_workload_identity_pool_provider.github[0]
  to   = module.platform.google_iam_workload_identity_pool_provider.github[0]
}

moved {
  from = google_service_account_iam_member.github_actions_wif_user[0]
  to   = module.platform.google_service_account_iam_member.github_actions_wif_user[0]
}

moved {
  from = google_artifact_registry_repository_iam_member.github_actions_gar_writer[0]
  to   = module.platform.google_artifact_registry_repository_iam_member.github_actions_gar_writer[0]
}

moved {
  from = google_project_iam_member.github_actions_run_developer[0]
  to   = module.platform.google_project_iam_member.github_actions_run_developer[0]
}

moved {
  from = google_service_account_iam_member.github_actions_runtime_sa_user[0]
  to   = module.platform.google_service_account_iam_member.github_actions_runtime_sa_user[0]
}

moved {
  from = google_project_service.enabled["serviceusage.googleapis.com"]
  to   = module.platform.google_project_service.enabled["serviceusage.googleapis.com"]
}

moved {
  from = google_project_service.enabled["artifactregistry.googleapis.com"]
  to   = module.platform.google_project_service.enabled["artifactregistry.googleapis.com"]
}

moved {
  from = google_project_service.enabled["run.googleapis.com"]
  to   = module.platform.google_project_service.enabled["run.googleapis.com"]
}

moved {
  from = google_project_service.enabled["cloudbuild.googleapis.com"]
  to   = module.platform.google_project_service.enabled["cloudbuild.googleapis.com"]
}

moved {
  from = google_project_service.enabled["iam.googleapis.com"]
  to   = module.platform.google_project_service.enabled["iam.googleapis.com"]
}

moved {
  from = google_project_service.enabled["sts.googleapis.com"]
  to   = module.platform.google_project_service.enabled["sts.googleapis.com"]
}

moved {
  from = google_project_service.enabled["iamcredentials.googleapis.com"]
  to   = module.platform.google_project_service.enabled["iamcredentials.googleapis.com"]
}

moved {
  from = google_project_service.enabled["storage.googleapis.com"]
  to   = module.platform.google_project_service.enabled["storage.googleapis.com"]
}
