#!/usr/bin/env bash
# Waits for an Auto Scaling instance refresh to finish.
#   wait-instance-refresh.sh <asg-name> <refresh-id> [timeout-seconds]
# Exits 0 when the refresh is Successful, 1 when it ends any other way or times out.
set -euo pipefail

asg="$1"
refresh_id="$2"
timeout="${3:-1800}"
deadline=$(( $(date +%s) + timeout ))

while true; do
  status=$(aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name "$asg" --instance-refresh-ids "$refresh_id" \
    --query 'InstanceRefreshes[0].Status' --output text)
  percent=$(aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name "$asg" --instance-refresh-ids "$refresh_id" \
    --query 'InstanceRefreshes[0].PercentageComplete' --output text)
  echo "$(date -u +%H:%M:%S) refresh $refresh_id: $status ($percent%)"

  case "$status" in
    Successful)
      exit 0
      ;;
    Pending | InProgress | Cancelling | Baking | RollbackInProgress)
      ;;
    *)
      echo "Refresh ended as $status"
      exit 1
      ;;
  esac

  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Timed out after ${timeout}s waiting for refresh $refresh_id"
    exit 1
  fi
  sleep 20
done
