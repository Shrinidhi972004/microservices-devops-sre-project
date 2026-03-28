output "repository_urls" {
  description = "ECR repository URLs keyed by service name"
  value = {
    for name, repo in aws_ecr_repository.services :
    name => repo.repository_url
  }
}