export const TOKEN_PLACEHOLDER = "ps_live_…";

export function machineSetupCommand(url: string, token = TOKEN_PLACEHOLDER): string {
  const config = JSON.stringify({ url, token }, null, 2);
  return `mkdir -p ~/.config/plan-saver
cat > ~/.config/plan-saver/config.json <<'EOF'
${config}
EOF`;
}
