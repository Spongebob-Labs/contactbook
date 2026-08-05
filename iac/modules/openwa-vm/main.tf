locals {
  labels = merge(
    {
      app        = "openwa"
      managed-by = "opentofu"
    },
    var.labels,
  )
}

resource "google_service_account" "openwa" {
  project      = var.project_id
  account_id   = substr(replace(var.name, "_", "-"), 0, 30)
  display_name = "ContactBook OpenWA VM"
}

resource "google_project_iam_member" "artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.openwa.email}"
}

resource "google_project_iam_member" "log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.openwa.email}"
}

resource "google_compute_address" "openwa" {
  project      = var.project_id
  name         = "${var.name}-ip"
  region       = var.region
  address_type = "EXTERNAL"
}

resource "google_compute_disk" "data" {
  project = var.project_id
  name    = "${var.name}-data"
  zone    = var.zone
  type    = "pd-balanced"
  size    = var.data_disk_size_gb
  labels  = local.labels

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_compute_resource_policy" "daily_snapshot" {
  project = var.project_id
  name    = "${var.name}-daily-snapshot"
  region  = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "02:00"
      }
    }

    retention_policy {
      max_retention_days    = var.snapshot_retention_days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      labels            = local.labels
      storage_locations = [var.region]
      guest_flush       = false
    }
  }
}

resource "google_compute_disk_resource_policy_attachment" "daily_snapshot" {
  project = var.project_id
  name    = google_compute_resource_policy.daily_snapshot.name
  disk    = google_compute_disk.data.name
  zone    = var.zone
}

resource "google_compute_instance" "openwa" {
  project      = var.project_id
  name         = var.name
  zone         = var.zone
  machine_type = var.machine_type
  labels       = local.labels
  tags         = ["openwa-gateway"]

  allow_stopping_for_update = true
  deletion_protection       = true

  boot_disk {
    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64"
      size  = var.boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = "openwa-data"
  }

  network_interface {
    network    = var.network
    subnetwork = var.subnetwork

    access_config {
      nat_ip = google_compute_address.openwa.address
    }
  }

  metadata = {
    enable-oslogin = "TRUE"
    startup-script = file("${path.module}/startup.sh.tftpl")
  }

  service_account {
    email  = google_service_account.openwa.email
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
  }

  depends_on = [
    google_project_iam_member.artifact_reader,
    google_project_iam_member.log_writer,
  ]
}

resource "google_compute_firewall" "web" {
  project = var.project_id
  name    = "${var.name}-web"
  network = var.network

  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["openwa-gateway"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_firewall" "iap_ssh" {
  project = var.project_id
  name    = "${var.name}-iap-ssh"
  network = var.network

  direction     = "INGRESS"
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["openwa-gateway"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
