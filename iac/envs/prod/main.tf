module "environment" {
  source = "../../modules/environment"

  project_id = var.project_id
  region     = var.region

  cloud_run_service_name          = var.cloud_run_service_name
  container_port                  = var.container_port
  cpu                             = var.cpu
  memory                          = var.memory
  min_instances                   = var.min_instances
  max_instances                   = var.max_instances
  allow_unauthenticated           = var.allow_unauthenticated
  cloud_run_service_account_email = var.cloud_run_service_account_email
  env                             = var.env

  create_profile_photos_bucket = var.create_profile_photos_bucket
  profile_photos_bucket_name   = var.profile_photos_bucket_name
  profile_photos_cors_origins  = var.profile_photos_cors_origins
  custom_domain                = var.custom_domain
}

module "openwa" {
  count  = var.enable_openwa_vm ? 1 : 0
  source = "../../modules/openwa-vm"

  project_id = var.project_id
  region     = var.region
  zone       = var.openwa_zone

  name              = var.openwa_instance_name
  machine_type      = var.openwa_machine_type
  boot_disk_size_gb = var.openwa_boot_disk_size_gb
  data_disk_size_gb = var.openwa_data_disk_size_gb

  labels = {
    environment = "prod"
  }
}
