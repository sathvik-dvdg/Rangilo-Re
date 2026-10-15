output "log_group_name" {
  value = aws_cloudwatch_log_group.app.name
}

output "log_group_arn" {
  value = aws_cloudwatch_log_group.app.arn
}

output "alert_topic_arn" {
  description = "GitHub variable ALERT_TOPIC_ARN."
  value       = aws_sns_topic.alerts.arn
}
