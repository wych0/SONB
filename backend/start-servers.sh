function startSonbServers() {
  echo "Starting 6 servers in new Terminal tabs..."

  SERVER_PATH="/Users/gb/projects/sonb-grzesik-wychowaniec"

  for i in {0..6}
  do
    PORT=$((3001 + i))
    osascript <<EOF
tell application "Terminal"
  do script "cd \"$SERVER_PATH\" && PORT=$PORT npm run start"
end tell
EOF

  done
}