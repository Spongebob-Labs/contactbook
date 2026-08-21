locals {
  name_prefix = "cb-${var.env}"
}

module "vm" {
  source = "../../modules/vm"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  zone        = var.zone
  vm_name     = var.vm_name
}

module "identity" {
  source = "../../modules/identity"

  project_id         = var.project_id
  name_prefix        = local.name_prefix
  vm_service_account = module.vm.vm_service_account
}

module "queues" {
  source = "../../modules/queues"

  region      = var.region
  name_prefix = local.name_prefix

  invoker_service_account        = module.identity.invoker_service_account
  outbound_dispatches_per_second = var.outbound_dispatches_per_second
}

module "monitoring" {
  source = "../../modules/monitoring"

  project_id    = var.project_id
  name_prefix   = local.name_prefix
  vm_name       = var.vm_name
  uptime_host   = replace(replace(var.api_base_url, "https://", ""), "http://", "")
  alert_email   = var.alert_email
  enable_alerts = var.enable_alerts
}

# ---- Copy these into the app's .env (via GitHub secrets) ----
output "vm_external_ip" { value = module.vm.vm_external_ip }
output "vm_service_account" { value = module.vm.vm_service_account }

output "app_env_values" {
  description = "Non-secret config the app needs in order to create and verify Cloud Tasks."
  value = {
    GCP_PROJECT_ID        = var.project_id
    GCP_REGION            = var.region
    TASKS_QUEUE_OUTBOUND  = module.queues.queue_outbound
    TASKS_QUEUE_PRIORITY  = module.queues.queue_priority
    TASKS_INVOKER_SA      = module.identity.invoker_service_account
    TASKS_OIDC_AUDIENCE   = var.api_base_url
    TASKS_TARGET_BASE_URL = var.api_base_url
  }
}
