#!/bin/sh
# Backup the Chrome profile Docker volume to a tarball.
# Run periodically via cron to preserve the Twitter login session.
#
# Usage:
#   sh deploy/backup-chrome-profile.sh
#
# Restore:
#   docker compose -f deploy/docker-compose.yml stop chrome
#   docker run --rm -v deploy_chrome-profile:/data -v /opt/backups:/backup alpine \
#     sh -c 'cd /data && tar xzf /backup/chrome-profile-latest.tar.gz'
#   docker compose -f deploy/docker-compose.yml up chrome -d

BACKUP_DIR="/opt/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

docker run --rm \
  -v deploy_chrome-profile:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/chrome-profile-${TIMESTAMP}.tar.gz" -C /data .

# Keep a "latest" symlink for easy restore
ln -sf "chrome-profile-${TIMESTAMP}.tar.gz" "$BACKUP_DIR/chrome-profile-latest.tar.gz"

# Prune backups older than 7 days
find "$BACKUP_DIR" -name "chrome-profile-*.tar.gz" -mtime +7 -delete 2>/dev/null

echo "[backup] Chrome profile saved: chrome-profile-${TIMESTAMP}.tar.gz"
